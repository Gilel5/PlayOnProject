import json
import logging
import math
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
        model="gpt-5.4",
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
- Numeric columns (base_amount, retail_amount) may contain NaN values. When
  aggregating (SUM, AVG, etc.), exclude NaN rows by adding a WHERE or CASE
  filter, e.g.: SUM(CASE WHEN base_amount = base_amount THEN base_amount ELSE 0 END)
  (NaN != NaN in IEEE 754, so base_amount = base_amount is false for NaN rows).
- Always aggregate, group, or filter results so the output is concise (ideally under 50 rows).
- Never use SELECT * — always select only the columns relevant to the question.
- If the question asks for a list, limit to the most relevant results with ORDER BY and LIMIT.
"""

_ANSWER_SYSTEM_PROMPT = """\
You are a helpful financial data analyst. The user asked a question about their
financial data. Below are the SQL query results. Provide a clear, concise answer
in English. Format monetary values with $ and commas.

Rules:
- Do NOT reprint the raw JSON data.
- Do NOT show the SQL query in your response.
- If the results are tabular, format them as a clean markdown table.
- Lead with a 1-2 sentence summary before any table.
- After the table, add a short interpretation or key takeaways.
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
    try:
        schema = get_table_schema()
        logger.info("Schema fetched OK")

        # Step 1 — ask GPT to write SQL
        sql_resp = client.chat.completions.create(
            model="gpt-5.4",
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
            rows = [
                {k: (0 if isinstance(v, float) and (math.isnan(v) or math.isinf(v)) else v)
                 for k, v in zip(columns, row)}
                for row in result.fetchall()
            ]
        logger.info("Query returned %d rows", len(rows))

        # Step 3 — ask GPT to answer in English
        answer_resp = client.chat.completions.create(
            model="gpt-5.4",
            messages=[
                {"role": "system", "content": _ANSWER_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"User question: {message}\n\n"
                        f"SQL used:\n{sql}\n\n"
                        f"Results ({len(rows)} rows):\n{json.dumps(rows[:200], default=str, ensure_ascii=True)}"
                    ),
                },
            ],
        )
        return answer_resp.choices[0].message.content

    except Exception as e:
        logger.exception("get_data_chat_response failed: %s", e)
        raise