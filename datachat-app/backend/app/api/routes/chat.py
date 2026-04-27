import asyncio
import io
from concurrent.futures import ThreadPoolExecutor
import logging
import traceback

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

# Thread pool for CPU/IO-bound work so we don't block the event loop
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
    """Return the name of the database table being queried."""
    return {"table": TABLE}


# Data-aware chat endpoint
@router.post("/", response_model=dict)
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """Send the user's message to OpenAI with finance-data context."""
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(_executor, get_data_chat_response, request.message)
        reply = result["text"]
        chart_data = result.get("chart_data")
        follow_up_questions = result.get("follow_up_questions")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")

    if request.session_id:
        #save the user's message
        db.add(ChatMessage(session_id=request.session_id, role="user", text=request.message))
        #Save chatbot response (with chart data and follow-up questions if present)
        db.add(ChatMessage(session_id=request.session_id, role="bot", text=reply, chart_data=chart_data, follow_up_questions=follow_up_questions))
        session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()
        if session:
            session.last_message_at = datetime.now(timezone.utc)
            db.commit()
        
        # Re-query all messages for this session in chronological order
        try:
            messages = (
                db.query(ChatMessage)
                .filter(ChatMessage.session_id == request.session_id)
                .order_by(ChatMessage.created_at.asc())
                .all()
            )

            message_count = len(messages)
            generated_title = None  
            generated_summary = None  
            if message_count <= 4 or message_count % 6 == 0:
                metadata = generate_chat_summary_and_title(messages)
                generated_title = metadata.get("title")
                generated_summary = metadata.get("summary")

            # Save summary if your ChatSession model has this column
            if generated_summary:
                session.chat_summary = generated_summary

            # Only auto-update title if it's still the default title
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


# Summary report -> downloadable Excel file
@router.post("/summary")
async def summary(request: SummaryReportRequest):
    """Generate an Excel workbook based on annual, single-month, or multi-month report selection."""
    try:
        logger.error(
            "Summary request received: report_type=%s year=%s month=%s start_month=%s end_month=%s",
            request.report_type,
            request.year,
            request.month,
            request.start_month,
            request.end_month,
        )

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
        logger.exception("Detailed summary report failure")
        raise HTTPException(status_code=500, detail=f"Report generation error: {str(e)}")