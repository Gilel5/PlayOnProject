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

Rules:
- title must be concise, specific, and 3 to 7 words
- do not use generic titles like "New Chat", "Conversation", or "Financial Data Chat"
- summary must be 1 to 3 sentences
- summary must stay under 80 words
- mention the main user goal, dataset, report, metric, or analysis if clear
- do not include markdown
- do not include code fences
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