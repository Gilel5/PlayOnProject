"""
Chat and summary-report route handlers.

Routes:
  GET  /chat/datasource       — Return the name of the active finance table.
  POST /chat/                 — Send a user message through the OpenAI pipeline.
  POST /chat/summary          — Generate a downloadable Excel summary report.
"""

import asyncio
import io
from concurrent.futures import ThreadPoolExecutor
import logging

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uuid
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from app.services.chat_summary_services import generate_chat_summary_and_title
from app.services.openai_services import get_data_chat_response, TABLE
from app.services.summary_report_services import generate_summary_reports
from app.db.session import get_db
from app.models.chat_session import ChatSession
from app.models.chat_messages import ChatMessage

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

# Thread pool for CPU/IO-bound OpenAI and pandas work.
# Running these synchronous calls in an executor prevents them from blocking
# the FastAPI event loop, keeping other requests responsive during long queries.
_executor = ThreadPoolExecutor(max_workers=4)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[uuid.UUID] = None


class SummaryReportRequest(BaseModel):
    report_type: str
    year: Optional[int] = None
    month: Optional[str] = None
    start_month: Optional[str] = None
    end_month: Optional[str] = None


@router.get("/datasource")
def get_datasource():
    """Return the name of the database table currently being queried."""
    return {"table": TABLE}


@router.post("/", response_model=dict)
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """
    Send the user's message through the full OpenAI data-chat pipeline.

    The synchronous OpenAI + SQL work runs in a thread-pool executor so the
    event loop stays free for other requests while waiting on network I/O.

    If a session_id is provided, the user message and bot reply are persisted
    to the database and the session's last_message_at timestamp is updated.
    The chat title and summary are auto-generated on the first few exchanges
    (≤ 4 messages) and then refreshed every 6 messages to keep them current
    without making an extra OpenAI call on every single turn.

    Returns:
        reply (str): GPT's plain-English answer.
        chart_data (dict | None): Recharts-compatible chart spec, if applicable.
        follow_up_questions (list[str]): Three suggested follow-up questions.
        session_id (str | None): Echo of the session ID for the client.
        chat_title (str | None): Auto-generated or user-edited session title.
        chat_summary (str | None): Auto-generated session summary.
    """
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(_executor, get_data_chat_response, request.message)
        reply = result["text"]
        chart_data = result.get("chart_data")
        follow_up_questions = result.get("follow_up_questions")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")

    if request.session_id:
        # Persist the conversation turn to the database
        db.add(ChatMessage(session_id=request.session_id, role="user", text=request.message))
        db.add(ChatMessage(
            session_id=request.session_id,
            role="bot",
            text=reply,
            chart_data=chart_data,
            follow_up_questions=follow_up_questions,
        ))
        session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()
        if session:
            session.last_message_at = datetime.now(timezone.utc)
            db.commit()

        try:
            messages = (
                db.query(ChatMessage)
                .filter(ChatMessage.session_id == request.session_id)
                .order_by(ChatMessage.created_at.asc())
                .all()
            )

            # Generate metadata on the first few turns and every 6th turn after that.
            # Early generation catches short sessions; periodic refresh keeps longer
            # sessions accurate without calling OpenAI on every single message.
            message_count = len(messages)
            generated_title = None
            generated_summary = None
            if message_count <= 4 or message_count % 6 == 0:
                metadata = generate_chat_summary_and_title(messages)
                generated_title = metadata.get("title")
                generated_summary = metadata.get("summary")

            if generated_summary:
                session.chat_summary = generated_summary

            # Only overwrite the title if the user has not manually renamed it
            if generated_title and not session.title_is_user_edited and session.chat_title in [None, "", "New Chat"]:
                session.chat_title = generated_title

            db.commit()
            db.refresh(session)

        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Chat save/summary error: {str(e)}")

    return {
        "reply": reply,
        "chart_data": chart_data,
        "follow_up_questions": follow_up_questions,
        "session_id": str(session.id) if request.session_id and session else None,
        "chat_title": session.chat_title if request.session_id and session else None,
        "chat_summary": session.chat_summary if request.session_id and session else None,
    }


@router.post("/summary")
async def summary(request: SummaryReportRequest):
    """
    Generate a multi-sheet Excel workbook from the finance data.

    Runs the heavy pandas + openpyxl work in a thread pool to avoid blocking
    the event loop. The generated bytes are streamed back as an attachment so
    the client receives a proper file download.

    Supported report_type values:
      "annual"       — full year; requires `year`.
      "single_month" — one calendar month; requires `month` (YYYY-MM).
      "multimonth"   — range of months; requires `start_month` and `end_month`.

    Returns a streaming XLSX response with a descriptive filename.
    """
    logger.info(
        "Summary report requested: report_type=%s year=%s month=%s start_month=%s end_month=%s",
        request.report_type,
        request.year,
        request.month,
        request.start_month,
        request.end_month,
    )

    try:
        loop = asyncio.get_event_loop()
        xlsx_bytes = await loop.run_in_executor(
            _executor,
            generate_summary_reports,
            request.report_type,
            request.year,
            request.month,
            request.start_month,
            request.end_month,
        )

        # Build a descriptive filename from the report parameters
        filename = "summary_reports.xlsx"
        if request.report_type == "annual" and request.year:
            filename = f"annual_summary_{request.year}.xlsx"
        elif request.report_type == "single_month" and request.month:
            filename = f"monthly_summary_{request.month}.xlsx"
        elif request.report_type == "multimonth" and request.start_month and request.end_month:
            filename = f"multimonth_summary_{request.start_month}_to_{request.end_month}.xlsx"

        return StreamingResponse(
            io.BytesIO(xlsx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        logger.exception("Summary report generation failed")
        raise HTTPException(status_code=500, detail=f"Report generation error: {str(e)}")