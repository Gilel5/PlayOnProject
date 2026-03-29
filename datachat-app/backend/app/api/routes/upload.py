import asyncio
import io
import logging
import re

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import decode_token
from app.db.finance_session import finance_engine
from app.db.session import get_db
from app.models.file_upload import FileUpload

router = APIRouter(prefix="/upload", tags=["upload"])
bearer = HTTPBearer()
logger = logging.getLogger(__name__)

# How many rows are processed at a time during the CSV read/clean phase.
# This keeps memory usage flat regardless of file size.
CHUNK_SIZE = 100_000

# Maximum number of uploads allowed to write to Supabase at the same time.
# Keeps disk I/O on the database from being overwhelmed by concurrent uploads.
MAX_CONCURRENT = 3

# Semaphore that enforces the MAX_CONCURRENT limit across all incoming requests.
_upload_semaphore = asyncio.Semaphore(MAX_CONCURRENT)


def _require_auth(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    """Verify the Bearer token on the request. Rejects unauthenticated callers."""
    payload = decode_token(creds.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


def _get_table_columns(table_name: str) -> set[str]:
    """
    Query PostgreSQL's information_schema to get the column names of the
    finance table. Used to validate the CSV before any data is inserted.
    Returns a set of lowercase column name strings.
    """
    with finance_engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name   = :table_name
                """
            ),
            {"table_name": table_name},
        )
        columns = {row[0].lower() for row in result}

    # If the set is empty, the table doesn't exist in the finance database.
    if not columns:
        raise HTTPException(
            status_code=500,
            detail=f"Table '{table_name}' not found in the finance database.",
        )
    return columns


def _normalize_col(c: str) -> str:
    """
    Standardize a column name so it matches the Supabase table schema:
      - Lowercase and strip whitespace
      - Spaces → underscores        (e.g. 'transaction date'  → 'transaction_date')
      - % → pct                     (e.g. 'revenue share %'   → 'revenue_share_pct')
      - $ → usd                     (e.g. 'revenue share $'   → 'revenue_share_usd')
      - Hyphens → underscores       (e.g. 'sub-type'          → 'sub_type')
    """
    return (
        c.lower().strip()
        .replace(" ", "_")
        .replace("%", "pct")
        .replace("$", "usd")
        .replace("-", "_")
    )


def _friendly_error(e: Exception) -> str:
    """
    Parse a psycopg2 database error and return a user-friendly message.
    The full technical error is logged separately on the server.
    """
    msg = str(e)

    # NOT NULL violation — e.g. null value in column "processor_transaction_id"
    match = re.search(r'null value in column "(.+?)"', msg)
    if match:
        return f"Please check the '{match.group(1)}' column - it contains empty values that are required."

    # Type mismatch — e.g. column "transaction_date" is of type timestamp but expression is of type double precision
    match = re.search(r'column "(.+?)" is of type (.+?) but expression is of type (.+?)[\n\.]', msg)
    if match:
        return f"Please check the '{match.group(1)}' column — expected {match.group(2)} but received {match.group(3)}."

    # Invalid input syntax — e.g. invalid input syntax for type bigint: "NE"
    match = re.search(r'invalid input syntax for type (.+?): "(.+?)"', msg)
    if match:
        return f"Please check your data — value '{match.group(2)}' is not valid for a {match.group(1)} column."

    return "Upload failed due to a database error. Please verify your data and try again."


@router.post("/csv")
async def upload_csv(
    request: Request,
    file: UploadFile = File(...),
    user=Depends(_require_auth),
    db: Session = Depends(get_db),
):
    # Step 1 — Reject anything that isn't a CSV before doing any work.
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    table_name = settings.FINANCE_TABLE_NAME

    # Step 2 — Read the entire file into a memory buffer (io.BytesIO).
    # This avoids writing to disk on the backend server, which reduces disk I/O
    # and speeds up concurrent uploads significantly.
    contents = await file.read()
    buf = io.BytesIO(contents)

    # Step 3 — Read only the header row to get the column names.
    # We normalize them and compare against the Supabase table columns.
    # If the CSV contains any unknown columns, we reject it before touching the DB.
    header_df = pd.read_csv(buf, nrows=0)
    csv_columns = {_normalize_col(c) for c in header_df.columns}
    table_columns = _get_table_columns(table_name)
    unknown = csv_columns - table_columns
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"CSV contains columns not found in table '{table_name}': {sorted(unknown)}. Upload rejected.",
        )

    # Step 4 — Acquire the semaphore before writing to Supabase.
    # If MAX_CONCURRENT uploads are already running, this request waits here
    # until a slot opens up, preventing database disk I/O from being overloaded.
    async with _upload_semaphore:

        # If the user cancelled while waiting for the semaphore, bail out early.
        if await request.is_disconnected():
            return {"rows_inserted": 0, "table": table_name, "cancelled": True}

        buf.seek(0)
        rows_inserted = 0
        cols = None

        # Open a raw psycopg2 connection directly from the engine.
        raw_conn = finance_engine.raw_connection()
        try:
            with raw_conn.cursor() as cursor:

                # Step 5 — Create a temporary staging table
                cursor.execute(
                    f"CREATE TEMP TABLE staging AS SELECT * FROM {table_name} WHERE FALSE"
                )

                # Step 6 — Process the CSV in chunks and COPY each chunk into staging.
                for chunk in pd.read_csv(buf, chunksize=CHUNK_SIZE):

                    # Stop processing if the client disconnected mid-upload.
                    if await request.is_disconnected():
                        break

                    # Normalize column names to match the table schema.
                    chunk.columns = [_normalize_col(c) for c in chunk.columns]

                    # Drop completely blank rows (empty lines in the CSV).
                    chunk = chunk.dropna(how="all")

                    # Strip any leading $ from currency columns so they can be
                    # stored as numeric without causing a type error.
                    for col in ("retail_amount", "base_amount", "sales_tax_amount"):
                        if col in chunk.columns:
                            chunk[col] = (
                                chunk[col].astype(str)
                                .str.replace("$", "", regex=False)
                                .str.strip()
                            )
                            # Coerce unparseable values to NaN (NULL) instead of crashing.
                            chunk[col] = pd.to_numeric(chunk[col], errors="coerce")

                    # Parse known date/timestamp columns into Python datetime objects.
                    for col in ("transaction_date", "date"):
                        if col in chunk.columns:
                            chunk[col] = pd.to_datetime(
                                chunk[col], format="%b %d %Y %I:%M %p", errors="coerce"
                            )

                    # Replace every NaN/NaT with None so pandas writes them as
                    # empty strings in the CSV buffer, which COPY treats as NULL.
                    chunk = chunk.astype(object).where(pd.notnull(chunk), None)

                    # Capture the normalized column list from the first chunk.
                    if cols is None:
                        cols = ", ".join(chunk.columns)

                    # Serialize the chunk to an in-memory CSV string and stream
                    # it into the staging table via COPY.
                    csv_buf = io.StringIO()
                    chunk.to_csv(csv_buf, index=False, header=False, na_rep="")
                    csv_buf.seek(0)
                    cursor.copy_expert(
                        f"COPY staging ({cols}) FROM STDIN WITH (FORMAT CSV, NULL '')",
                        csv_buf,
                    )
                    rows_inserted += len(chunk)

                # Step 7 — Move all staged rows into the main table in one statement.
                # ON CONFLICT DO NOTHING silently skips any duplicate rows.
                if cols:
                    cursor.execute(f"""
                        INSERT INTO {table_name} ({cols})
                        SELECT {cols} FROM staging
                        ON CONFLICT DO NOTHING
                    """)

            # Commit the transaction — this is the only commit in the entire upload.
            raw_conn.commit()

        except Exception as e:
            # Roll back everything if any step fails.
            raw_conn.rollback()
            logger.error("CSV Upload error: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail=_friendly_error(e))
        finally:
            # Always return the connection to the pool, even if an error occurred.
            raw_conn.close()

    # Step 8 — Log the upload to the main database so it appears in upload history.
    db.add(FileUpload(
        user_id=user["sub"],
        filename=file.filename,
        rows_inserted=rows_inserted,
        file_size=round(len(contents) / (1024 * 1024), 2),
    ))
    db.commit()

    return {"rows_inserted": rows_inserted, "table": table_name}
