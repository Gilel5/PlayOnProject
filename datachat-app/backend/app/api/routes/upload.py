import asyncio
import io
import logging
import re


import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text
from app.core.config import settings
from app.core.security import decode_token
from app.db.finance_session import finance_engine

router = APIRouter(prefix="/upload", tags=["upload"])
bearer = HTTPBearer()
logger = logging.getLogger(__name__)

# How many rows are sent to Supabase in a single INSERT statement.
# Larger chunks = fewer round trips = faster uploads.
CHUNK_SIZE = 50_000

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
    finance table.
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
    Standardize a column name so it matches the Supabase table schema
    """
    return (
        c.lower().strip()
        .replace(" ", "_")
        .replace("%", "pct")
        .replace("$", "usd")
        .replace("-", "_")
    )

def _friendly_error(e: Exception) -> str:
    msg = str(e)

    #Not Null Violation
    match = re.search(r'null value in column "(.+?)"', msg)
    if match:
        return f"Please check the '{match.group(1)}' column - it contains empty values that are required."

    #Type mismatch
    match = re.search(r'column "(.+?)" is of type (.+?) but expression is of type (.+?)[\n\.]', msg)
    if match:
        return f"Please check the '{match.group(1)}' column — expected {match.group(2)} but received {match.group(3)}."
    
    # Invalid input syntax
    match = re.search(r'invalid input syntax for type (.+?): "(.+?)"', msg)
    if match:
        return f"Please check your data — value '{match.group(2)}' is not valid for a {match.group(1)} column."

    return "Upload failed due to a database error. Please verify your data and try again."

@router.post("/csv")
async def upload_csv(
    request: Request,
    file: UploadFile = File(...),
    _user=Depends(_require_auth),
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

        if await request.is_disconnected():
            return {"rows_inserted": 0, "table": table_name, "cancelled": True}

        from psycopg2.extras import execute_values

        # Rewind the buffer to the beginning so pandas can read the full file.
        buf.seek(0)
        rows_inserted = 0

        # Open a raw psycopg2 connection directly from the engine.

        raw_conn = finance_engine.raw_connection()
        try:
            # Step 5 — Read and insert the CSV in chunks of CHUNK_SIZE rows.
            for chunk in pd.read_csv(buf, chunksize=CHUNK_SIZE):

                if await request.is_disconnected():
                    break

                # Normalize column names in this chunk to match the table schema.
                chunk.columns = [_normalize_col(c) for c in chunk.columns]

                # Drop completely blank rows
                chunk = chunk.dropna(how="all")

                # Strip any leading "$" from currency columns so they can be stored
                for col in ("retail_amount", "base_amount", "sales_tax_amount"):
                    if col in chunk.columns:
                        chunk[col] = (
                            chunk[col].astype(str)
                            .str.replace("$", "", regex=False)
                            .str.strip()
                        )
                        chunk[col] = pd.to_numeric(chunk[col], errors="coerce")

                # Parse known date/timestamp columns into Python datetime objects.

                for col in ("transaction_date", "date"):
                    if col in chunk.columns:
                        chunk[col] = pd.to_datetime(chunk[col], format="%b %d %Y %I:%M %p", errors="coerce")

                # Replace every NaN/NaT value with Python None before building the
                # insert rows. 
                chunk = chunk.astype(object).where(pd.notnull(chunk), None)

                # Build the INSERT statement. execute_values fills in the VALUES
                # placeholder with all rows in the chunk in a single SQL statement.
                # ON CONFLICT DO NOTHING silently skips duplicate rows.
                cols = ", ".join(chunk.columns)
                sql = f"INSERT INTO {table_name} ({cols}) VALUES %s ON CONFLICT DO NOTHING"
                data = [tuple(row) for row in chunk.itertuples(index=False)]

                with raw_conn.cursor() as cursor:
                    execute_values(cursor, sql, data, page_size=10_000)

                # Commit after each chunk so PostgreSQL can free memory incrementally
                # rather than holding the entire upload in one transaction.
                raw_conn.commit()
                rows_inserted += len(chunk)

        except Exception as e:
            # Roll back any uncommitted rows from the current chunk on failure.
            raw_conn.rollback()
            logger.error("CSV Upload error: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail=_friendly_error(e))
        finally:
            # Always return the connection to the pool, even if an error occurred.
            raw_conn.close()

    # Step 6 — Return a summary of what was inserted.
    return {"rows_inserted": rows_inserted, "table": table_name}
