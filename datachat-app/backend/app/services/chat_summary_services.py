import json
import logging
from typing import Any

from openai import OpenAI

from app.core.config import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY)
logger = logging.getLogger(__name__)


def build_chat_transcript(messages: list[Any], max_messages: int = 20) -> str:
    """
    Convert chat message ORM objects into a compact transcript string.
    Expects each message to have:
      - role
      - text

    Only the most recent max_messages are included.
    """
    trimmed = messages[-max_messages:]
    lines: list[str] = []

    for msg in trimmed:
        role = getattr(msg, "role", "unknown")
        text = (getattr(msg, "text", "") or "").strip()

        if not text:
            continue

        lines.append(f"{str(role).upper()}: {text}")

    return "\n".join(lines)


_SUMMARY_SYSTEM_PROMPT = """\
You generate metadata for chat sessions in a financial data assistant.

Return ONLY valid JSON with exactly these keys:
{
  "title": "string",
  "summary": "string"
}

Rules for title:
- Must be concise, specific, and 3 to 7 words
- Do not use generic titles like "New Chat", "Conversation", or "Financial Data Chat"

Rules for summary:
- Write a detailed, insight-focused summary of 150 to 250 words
- Structure it in clearly separated sections using plain text (no markdown, no code fences)
- Include the following sections where applicable:

  OVERVIEW: One or two sentences describing what the user was investigating.

  KEY INSIGHTS: Bullet points (use a dash "-") listing the most important findings,
  specific numbers, comparisons, or trends discovered. Include actual figures from
  the conversation (e.g. revenue totals, top performers, anomalies).

  NOTABLE PATTERNS: Any trends, anomalies, or comparisons surfaced during the session
  (e.g. month-over-month changes, pass type performance differences, outlier months).

  NEXT STEPS: 1 to 2 recommendations or natural next questions based on what was learned.

- Use plain text only. No markdown headers, no asterisks, no code fences.
- Write in present tense ("Revenue shows...", "The data reveals...").
- Be specific — reference actual values, dates, and categories from the conversation.
"""


def _safe_parse_metadata(raw_text: str) -> dict[str, str | None]:
    """
    Parse model output as JSON if possible.
    If parsing fails, fall back to a simple line-based parse.
    """
    raw_text = (raw_text or "").strip()

    try:
        data = json.loads(raw_text)

        title = data.get("title")
        summary = data.get("summary")

        if not isinstance(title, str):
            title = None
        else:
            title = title.strip()

        if not isinstance(summary, str):
            summary = None
        else:
            summary = summary.strip()

        return {
            "title": title,
            "summary": summary,
        }

    except Exception:
        logger.warning("Failed to parse summary metadata as JSON. Raw output: %s", raw_text)

        title = None
        summary = None

        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        for line in lines:
            upper = line.upper()
            if upper.startswith("TITLE:"):
                title = line.split(":", 1)[1].strip()
            elif upper.startswith("SUMMARY:"):
                summary = line.split(":", 1)[1].strip()

        if not title and lines:
            title = lines[0][:80]

        if not summary and len(lines) > 1:
            summary = " ".join(lines[1:])[:500]

        return {
            "title": title,
            "summary": summary,
        }


def generate_chat_summary_and_title(messages: list[Any]) -> dict[str, str | None]:
    """
    Generate an automatic title and summary for a chat session.

    Returns:
        {
            "title": str | None,
            "summary": str | None
        }
    """
    transcript = build_chat_transcript(messages)

    if not transcript.strip():
        return {
            "title": None,
            "summary": None,
        }

    completion = client.chat.completions.create(
        model="gpt-5.4",
        temperature=0.2,
        messages=[
            {"role": "system", "content": _SUMMARY_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Generate a title and summary for this chat session.\n\n"
                    f"Transcript:\n{transcript}"
                ),
            },
        ],
    )

    raw_output = completion.choices[0].message.content or ""
    parsed = _safe_parse_metadata(raw_output)

    logger.info(
        "Generated chat metadata: title=%s summary=%s",
        parsed.get("title"),
        parsed.get("summary"),
    )

    return parsed


def generate_chat_title(messages: list[Any]) -> str | None:
    """
    Convenience helper if you only want the title.
    """
    result = generate_chat_summary_and_title(messages)
    return result.get("title")


def generate_chat_summary(messages: list[Any]) -> str | None:
    """
    Convenience helper if you only want the summary.
    """
    result = generate_chat_summary_and_title(messages)
    return result.get("summary")