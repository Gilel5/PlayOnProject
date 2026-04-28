"""
OpenAI integration for data-aware chat.

Pipeline (for every user question):
  1. Fetch the finance table schema (process-level cache after first call).
  2. Generate SQL via Tree-of-Thought (ToT): branch → evaluate → select.
     Falls back to single-shot generation when ToT produces < 2 valid candidates.
  3. Execute the chosen SQL read-only against the finance database.
  4. Ask GPT to summarise the rows in plain English.
  5. Ask GPT to produce a Recharts-compatible chart spec (non-blocking).
  6. Ask GPT to generate 3 contextual follow-up questions (non-blocking).
"""

import json
import logging
import math
import re

from openai import OpenAI
from sqlalchemy import text
from typing import Optional

from app.core.config import settings
from app.db.finance_session import finance_engine

client = OpenAI(api_key=settings.OPENAI_API_KEY)
logger = logging.getLogger(__name__)

TABLE = settings.FINANCE_TABLE_NAME

# ── Tree-of-Thought configuration ────────────────────────────────────────────
TOT_NUM_CANDIDATES = 3   # Number of SQL branches to explore per question
TOT_ENABLED = True       # Set False to revert to single-shot SQL generation

# ── Schema cache ─────────────────────────────────────────────────────────────
# The schema is fetched once per process and reused for every request.
# This avoids a round-trip to information_schema on every user message.
# If the schema changes, restart the server to invalidate the cache.
_CACHED_SCHEMA: str | None = None


def get_table_schema() -> str:
    """
    Return a concise description of every column in the finance table.

    Queries information_schema on the first call and caches the result
    in-process so subsequent calls are free. Thread-safe for read-only
    access; the GIL protects the single assignment to _CACHED_SCHEMA.
    """
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


def get_chat_response(message: str) -> str:
    """Simple, schema-free GPT response — used for non-data questions."""
    completion = client.chat.completions.create(
        model="gpt-5.4",
        messages=[{"role": "user", "content": message}],
    )
    return completion.choices[0].message.content


# ── Shared SQL rules injected into both SQL generation prompts ────────────────
# Keeping these in one place means a single edit propagates to both the
# single-shot fallback and the ToT branch generator automatically.
_SQL_RULES = """\
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
- Numeric columns (base_amount, retail_amount) may contain NaN stored as the text
  string 'NaN' or as an IEEE 754 NaN float. ALWAYS use the NULLIF cast pattern when
  reading these columns so non-numeric values are treated as NULL:
    NULLIF(col::text, 'NaN')::double precision
  For aggregations wrap that in COALESCE so the result is never NULL:
    COALESCE(SUM(NULLIF(retail_amount::text, 'NaN')::double precision), 0)
    COALESCE(SUM(NULLIF(base_amount::text, 'NaN')::double precision), 0)
  Use this pattern for every reference to base_amount or retail_amount, including
  SELECT, WHERE, ORDER BY, and GROUP BY clauses.
- Always aggregate, group, or filter results so the output is concise (ideally under 50 rows).
- Never use SELECT * — always select only the columns relevant to the question.
- If the question asks for a list, limit to the most relevant results with ORDER BY and LIMIT.
"""

# ── System prompts ────────────────────────────────────────────────────────────

_SQL_SYSTEM_PROMPT = (
    "You are a SQL assistant. Given a user question and a PostgreSQL table schema,\n"
    "write a single SELECT query that answers the question.\n\n"
    + _SQL_RULES
)

_TOT_SQL_CANDIDATES_PROMPT = (
    "You are a SQL expert. Given a user question and a PostgreSQL schema,\n"
    "produce {n} DISTINCT SQL SELECT queries that each attempt to answer the question\n"
    "from a different angle or with a different interpretation.\n\n"
    "Schema " + _SQL_RULES + "\n"
    "Output format:\n"
    "Return ONLY a valid JSON array of {n} SQL strings - no markdown, no explanation.\n"
    'Example: ["SELECT ...", "SELECT ...", "SELECT ..."]'
)

# The evaluate prompt asks the model to act as a judge and score all N candidates
# comparatively. temperature=0 in the call makes the judgment deterministic.
_TOT_SQL_EVALUATE_PROMPT = """\
You are a SQL review expert. A user asked a financial data question and {n}
candidate SQL queries were generated. Pick the BEST one.

Evaluation criteria (in order of importance):
1. Correctly answers the user's question — right columns, filters, aggregation.
2. Handles edge cases — NaN guard on numeric columns, proper date truncation.
3. Efficiency and clarity.

Return ONLY a valid JSON object, no markdown:
{{
  "best_index": <0-based index of the best candidate>,
  "scores": [<score 1-10 for candidate 0>, <score for candidate 1>, ...],
  "reason": "<one sentence explaining why the chosen candidate is best>"
}}
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

_CHART_SYSTEM_PROMPT = """\
You are a data visualization expert. Given SQL query results, decide whether the
data is suitable for charting and, if so, produce a JSON chart specification.

Rules:
- Return ONLY valid JSON, no markdown fences, no explanation.
- If the data is NOT suitable for a chart (e.g., a single scalar value, text-heavy
  results, or only 1 data point), return exactly: null
- The JSON must follow this exact schema:
{
  "chart_type": "<one of: bar, line, area, pie>",
  "title": "<short descriptive chart title>",
  "labels": ["label1", "label2", ...],
  "datasets": [
    {
      "label": "<dataset name>",
      "data": [number1, number2, ...]
    }
  ],
  "suggested_types": ["bar", "line", "area", "pie"]
}

Guidelines for choosing chart_type:
- "bar": comparisons across categories (e.g., revenue by pass type, counts by category)
- "line": trends over time (e.g., monthly revenue, daily transactions)
- "area": same as line but when you want to emphasize volume/magnitude over time
- "pie": proportional breakdowns with 2-7 categories (never use for >7 categories)

Guidelines for suggested_types:
- Always include the primary chart_type you chose.
- Include alternatives that also make sense. For example, time-based data should
  suggest ["line", "bar", "area"]. Categorical data should suggest ["bar", "pie"].
- Do NOT suggest "pie" if there are more than 7 categories.

Data rules:
- All values in "data" arrays MUST be numbers (not strings, not null).
- "labels" must match the length of each "data" array.
- For monetary values, use raw numbers (no $ or commas).
- Round numbers to 2 decimal places max.
- If multiple numeric columns exist, create multiple datasets.
"""

_FOLLOW_UP_PROMPT = """\
You are a financial data analyst assistant. A user asked a question about their
revenue data and received an answer. Generate exactly 3 concise follow-up questions
a financial analyst would naturally ask next, based on the context of the answer.

Rules:
- Return ONLY a valid JSON array of 3 strings, no markdown, no explanation.
- Questions should be specific to the data context, not generic.
- Each question should be under 12 words.
- Questions should uncover actionable insights (trends, comparisons, breakdowns).
Example: ["How does this compare to last year?", "Which pass type drives this?", "What caused the spike in March?"]
"""


# ── SQL utility helpers ───────────────────────────────────────────────────────

def _extract_sql(raw: str) -> str:
    """Strip optional markdown code fencing from GPT output (e.g. ```sql ... ```)."""
    match = re.search(r"```(?:sql)?\s*\n?(.*?)```", raw, re.DOTALL)
    if match:
        return match.group(1).strip()
    return raw.strip()


def _validate_sql(sql: str) -> None:
    """
    Reject SQL containing data-mutating or schema-altering statements.

    Raises ValueError if any forbidden keyword is found. This is a safety
    guard against prompt injection — the SQL is also executed on a read-only
    database connection, but rejecting early gives a cleaner error message.
    """
    forbidden = r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b"
    if re.search(forbidden, sql, re.IGNORECASE):
        raise ValueError("Query contains forbidden statements.")


def _strip_json_fence(raw: str) -> str:
    """
    Strip markdown JSON fencing from a string if present.

    GPT sometimes wraps JSON responses in ```json ... ``` blocks despite
    being instructed not to. This helper normalises the output.
    """
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)```", raw, re.DOTALL)
    if fence_match:
        return fence_match.group(1).strip()
    return raw


# ── Chart generation ──────────────────────────────────────────────────────────

def _generate_chart_data(message: str, sql: str, rows: list) -> dict | None:
    """
    Ask GPT to produce a Recharts-compatible chart spec from SQL results.

    Returns the parsed chart dict, or None if:
    - There are fewer than 2 rows (not enough data for a meaningful chart).
    - GPT determines the data isn't chartable and returns null.
    - GPT output fails JSON parsing or schema validation.

    This call is non-blocking in the sense that failures return None and
    never raise — the rest of the response is always returned to the user.
    """
    if not rows or len(rows) < 2:
        return None

    try:
        chart_resp = client.chat.completions.create(
            model="gpt-5.4",
            temperature=0,
            messages=[
                {"role": "system", "content": _CHART_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"User question: {message}\n\n"
                        f"SQL used:\n{sql}\n\n"
                        f"Results ({len(rows)} rows):\n"
                        # Cap at 100 rows so the prompt doesn't balloon
                        f"{json.dumps(rows[:100], default=str, ensure_ascii=True)}"
                    ),
                },
            ],
        )
        raw_chart = _strip_json_fence(chart_resp.choices[0].message.content.strip())

        if raw_chart.lower() == "null":
            return None

        chart_data = json.loads(raw_chart)

        # Validate the required top-level keys before returning
        if not isinstance(chart_data, dict):
            return None
        required_keys = {"chart_type", "labels", "datasets"}
        if not required_keys.issubset(chart_data.keys()):
            return None
        if not chart_data.get("datasets") or not chart_data.get("labels"):
            return None

        return chart_data

    except Exception as e:
        logger.warning("Chart generation failed (non-fatal): %s", e)
        return None


# ── Follow-up question generation ─────────────────────────────────────────────

def _generate_follow_up_questions(user_message: str, bot_reply: str) -> list[str]:
    """
    Generate 3 contextual follow-up questions for the current conversation turn.

    Truncates bot_reply to 1,000 characters so the prompt stays small.
    Returns a hardcoded fallback list on any failure — this step must never
    block or degrade the main chat response.
    """
    try:
        resp = client.chat.completions.create(
            model="gpt-5.4",
            # Slight temperature for variety across questions without going off-topic
            temperature=0.7,
            messages=[
                {"role": "system", "content": _FOLLOW_UP_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"User question: {user_message}\n\n"
                        f"Assistant answer: {bot_reply[:1000]}"
                    ),
                },
            ],
        )
        raw = _strip_json_fence(resp.choices[0].message.content.strip())
        questions = json.loads(raw)
        if isinstance(questions, list) and all(isinstance(q, str) for q in questions):
            logger.info("Follow-up questions generated: %s", questions)
            return questions[:3]
    except Exception as e:
        logger.warning("Follow-up question generation failed (non-fatal): %s", e)

    # Fallback questions are generic but still useful
    return [
        "How does this compare to other months?",
        "Can you break this down further?",
        "What is driving this result?",
    ]


# ── Tree-of-Thought SQL pipeline ──────────────────────────────────────────────

def _generate_sql_candidates(message: str, schema: str, n: int = TOT_NUM_CANDIDATES) -> list[str]:
    """
    ToT Branch step: ask the model to generate N distinct SQL queries in one call.

    Temperature 0.4 is deliberately non-zero so the model explores different
    interpretations of the question rather than repeating the same query N times.

    Returns a list of raw SQL strings, or an empty list if parsing fails.
    """
    prompt = _TOT_SQL_CANDIDATES_PROMPT.format(n=n, table=TABLE)
    resp = client.chat.completions.create(
        model="gpt-5.4",
        temperature=0.4,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Schema:\n{schema}\n\nQuestion: {message}"},
        ],
    )
    raw = _strip_json_fence(resp.choices[0].message.content.strip())
    try:
        candidates = json.loads(raw)
        if isinstance(candidates, list) and all(isinstance(c, str) for c in candidates):
            logger.info("ToT generated %d SQL candidates", len(candidates))
            return candidates
    except json.JSONDecodeError:
        pass
    logger.warning("ToT candidate generation returned unparseable output; falling back")
    return []


def _select_best_sql(message: str, schema: str, candidates: list[str]) -> tuple[str, str]:
    """
    ToT Evaluate step: present all N candidates to the model and select the best.

    The model acts as a judge, scoring each candidate 1-10 and picking the winner.
    Temperature 0 makes the judgment deterministic (same input → same choice).

    Returns (best_sql, reason_string).
    """
    candidates_text = "\n\n".join(
        f"Candidate {i}:\n{sql}" for i, sql in enumerate(candidates)
    )
    eval_prompt = _TOT_SQL_EVALUATE_PROMPT.format(n=len(candidates))
    resp = client.chat.completions.create(
        model="gpt-5.4",
        temperature=0,
        messages=[
            {"role": "system", "content": eval_prompt},
            {
                "role": "user",
                "content": (
                    f"User question: {message}\n\n"
                    f"Schema:\n{schema}\n\n"
                    f"Candidates:\n{candidates_text}"
                ),
            },
        ],
    )
    raw = _strip_json_fence(resp.choices[0].message.content.strip())
    try:
        result = json.loads(raw)
        best_idx = int(result.get("best_index", 0))
        reason = result.get("reason", "")
        scores = result.get("scores", [])
        # Clamp to valid range in case the model returns an out-of-bounds index
        best_idx = max(0, min(best_idx, len(candidates) - 1))
        logger.info("ToT selected candidate %d (scores=%s) — %s", best_idx, scores, reason)
        return candidates[best_idx], reason
    except (json.JSONDecodeError, KeyError, ValueError):
        logger.warning("ToT evaluation failed to parse; using candidate 0")
        return candidates[0], "fallback to first candidate"


def _generate_sql_single_shot(message: str, schema: str) -> str:
    """
    Single-shot SQL generation — the original approach before ToT was added.

    Used as a fallback when ToT produces fewer than 2 valid candidates.
    Temperature 0 ensures deterministic output for the same question.
    """
    resp = client.chat.completions.create(
        model="gpt-5.4",
        temperature=0,
        messages=[
            {"role": "system", "content": _SQL_SYSTEM_PROMPT.format(table=TABLE)},
            {"role": "user", "content": f"Schema:\n{schema}\n\nQuestion: {message}"},
        ],
    )
    sql = _extract_sql(resp.choices[0].message.content)
    _validate_sql(sql)
    return sql


def _generate_sql_with_tot(message: str, schema: str) -> str:
    """
    Full Tree-of-Thought pipeline: Branch → Validate → Evaluate → Select.

    Degrades gracefully at each step:
    - If TOT_ENABLED is False, skip straight to single-shot.
    - If fewer than 2 valid candidates survive validation, use single-shot.
    - If the evaluation step fails to parse, pick candidate 0.
    """
    if not TOT_ENABLED:
        return _generate_sql_single_shot(message, schema)

    candidates = _generate_sql_candidates(message, schema)

    if len(candidates) < 2:
        logger.warning("ToT produced fewer than 2 candidates; falling back to single-shot")
        return _generate_sql_single_shot(message, schema)

    # Discard any candidates that contain forbidden DML/DDL statements
    clean_candidates: list[str] = []
    for raw_sql in candidates:
        try:
            sql = _extract_sql(raw_sql)
            _validate_sql(sql)
            clean_candidates.append(sql)
        except ValueError:
            logger.warning("ToT discarded unsafe candidate: %s", raw_sql[:80])

    if len(clean_candidates) < 2:
        logger.warning("Too few safe ToT candidates; falling back to single-shot")
        return _generate_sql_single_shot(message, schema)

    best_sql, reason = _select_best_sql(message, schema, clean_candidates)
    logger.info("ToT winning SQL:\n%s", best_sql)
    logger.info("ToT winner reason: %s", reason)
    return best_sql


# ── Public entry point ────────────────────────────────────────────────────────

def get_data_chat_response(message: str) -> dict:
    """
    Run the full multi-step data-aware chat pipeline for a user question.

    Steps:
      1. Fetch (or return cached) table schema.
      2. Generate SQL via the ToT pipeline (falls back to single-shot).
      3. Execute the SQL read-only and sanitise NaN / Inf float values.
      4. Ask GPT to summarise the rows in plain English with markdown formatting.
      5. Generate a chart spec (non-blocking; None on failure).
      6. Generate follow-up questions (non-blocking; hardcoded fallback on failure).

    Returns:
        {
            "text": str,                   # GPT's plain-English answer
            "chart_data": dict | None,     # Recharts-compatible spec, or None
            "follow_up_questions": list[str]
        }

    Raises:
        Any exception from the SQL execution or GPT answer step propagates up
        to the route handler, which converts it to a 500 response.
    """
    try:
        schema = get_table_schema()
        logger.info("Schema fetched OK")

        # Step 1 — Tree-of-Thought SQL generation
        sql = _generate_sql_with_tot(message, schema)
        logger.info("Final SQL (ToT): %s", sql)

        # Step 2 — Execute the query and sanitise floating-point edge cases.
        # PostgreSQL can return IEEE 754 NaN/Inf which json.dumps cannot serialise,
        # so we replace them with 0 before handing the rows to GPT.
        with finance_engine.connect() as conn:
            result = conn.execute(text(sql))
            columns = list(result.keys())
            rows = [
                {k: (0 if isinstance(v, float) and (math.isnan(v) or math.isinf(v)) else v)
                 for k, v in zip(columns, row)}
                for row in result.fetchall()
            ]
        logger.info("Query returned %d rows", len(rows))

        # Step 3 — Ask GPT to answer in plain English
        answer_resp = client.chat.completions.create(
            model="gpt-5.4",
            messages=[
                {"role": "system", "content": _ANSWER_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"User question: {message}\n\n"
                        f"SQL used:\n{sql}\n\n"
                        # Cap at 200 rows; the prompt would be too large otherwise
                        f"Results ({len(rows)} rows):\n{json.dumps(rows[:200], default=str, ensure_ascii=True)}"
                    ),
                },
            ],
        )
        text_reply = answer_resp.choices[0].message.content

        # Steps 4 & 5 — Chart and follow-ups are best-effort; failures return defaults
        chart_data = _generate_chart_data(message, sql, rows)
        logger.info("Chart data generated: %s", "yes" if chart_data else "no")

        follow_up_questions = _generate_follow_up_questions(message, text_reply)

        return {"text": text_reply, "chart_data": chart_data, "follow_up_questions": follow_up_questions}

    except Exception as e:
        logger.exception("get_data_chat_response failed: %s", e)
        raise