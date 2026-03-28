import json
import logging
import re

from openai import OpenAI
from sqlalchemy import text

from app.core.config import settings
from app.db.finance_session import finance_engine

client = OpenAI(api_key=settings.OPENAI_API_KEY)
logger = logging.getLogger(__name__)

TABLE = settings.FINANCE_TABLE_NAME

# Schema helper -> one query, cached for the lifetime of the process
_CACHED_SCHEMA: str | None = None


def get_table_schema() -> str:
    """Return a concise description of every column in the finance table."""
    global _CACHED_SCHEMA
    if _CACHED_SCHEMA:
        return _CACHED_SCHEMA

    with finance_engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name   = :tbl
                ORDER BY ordinal_position
            """),
            {"tbl": TABLE},
        ).fetchall()

    lines = [f"Table: {TABLE}", "Columns:"]
    for name, dtype in rows:
        lines.append(f"  - {name} ({dtype})")
    _CACHED_SCHEMA = "\n".join(lines)
    return _CACHED_SCHEMA

# Original simple chat (no data context)
def get_chat_response(message: str) -> str:
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": message}],
    )
    return completion.choices[0].message.content


# Data-aware chat with two-step SQL generation
_SQL_SYSTEM_PROMPT = """\
You are a SQL assistant. Given a user question and a PostgreSQL table schema,
write a single SELECT query that answers the question.

Rules:
- Return ONLY the raw SQL, no markdown fences, no explanation.
- Use only columns that exist in the schema.
- Always reference the table as: {table}
- Limit results to 200 rows max unless the user explicitly asks for more.
- For monetary values, the columns base_amount and retail_amount are numeric (doubles).
- processor_fee is stored as TEXT; cast to NUMERIC when doing math with it.
- transaction_date is a timestamptz column.
- processor_transaction_type has values: Charge, Dispute, Fee, Refund
- transaction_type has values: New Purchase, Rebill, and various fee/radar types.
- pass_name has values: Month, Annual, Media, Season, and others.
- Use EXTRACT or DATE_TRUNC for date-based grouping.
- Never use DELETE, UPDATE, INSERT, DROP, ALTER, TRUNCATE, or CREATE.
"""

_ANSWER_SYSTEM_PROMPT = """\
You are a helpful financial data analyst. The user asked a question about their
financial data. Below are the SQL query results. Provide a clear, concise answer
in English. Format monetary values with $ and commas. Use markdown for any tables
if appropriate.
"""


def _extract_sql(raw: str) -> str:
    """Strip optional markdown fencing from GPT output."""
    match = re.search(r"```(?:sql)?\s*\n?(.*?)```", raw, re.DOTALL)
    if match:
        return match.group(1).strip()
    return raw.strip()


def _validate_sql(sql: str) -> None:
    """Reject any obviously dangerous SQL."""
    forbidden = r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b"
    if re.search(forbidden, sql, re.IGNORECASE):
        raise ValueError("Query contains forbidden statements.")


def get_data_chat_response(message: str) -> str:
    """
    Two-step data-aware chat:
      1. GPT generates SQL from the user's question + schema.
      2. Execute the SQL read-only against the finance DB.
      3. GPT summarises the results in plain English.
    """
    schema = get_table_schema()

    # Step 1 — ask GPT to write SQL
    sql_resp = client.chat.completions.create(
        model="gpt-4o",
        temperature=0,
        messages=[
            {"role": "system", "content": _SQL_SYSTEM_PROMPT.format(table=TABLE)},
            {"role": "user", "content": f"Schema:\n{schema}\n\nQuestion: {message}"},
        ],
    )
    raw_sql = sql_resp.choices[0].message.content
    sql = _extract_sql(raw_sql)
    _validate_sql(sql)
    logger.info("Generated SQL: %s", sql)

    # Step 2 — execute the query
    with finance_engine.connect() as conn:
        result = conn.execute(text(sql))
        columns = list(result.keys())
        rows = [dict(zip(columns, row)) for row in result.fetchall()]

    # Step 3 — ask GPT to answer in English
    answer_resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _ANSWER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"User question: {message}\n\n"
                    f"SQL used:\n{sql}\n\n"
                    f"Results ({len(rows)} rows):\n{json.dumps(rows[:200], default=str)}"
                ),
            },
        ],
    )
    return answer_resp.choices[0].message.content
