import asyncio
import io
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uuid
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from app.services.chat_summary_services import generate_chat_summary_and_title
from app.services.openai_services import get_data_chat_response
from app.services.summary_report_services import generate_summary_reports
from app.db.session import get_db
from app.models.chat_session import ChatSession
from app.models.chat_messages import ChatMessage

router = APIRouter(prefix="/chat", tags=["chat"])

# Thread pool for CPU/IO-bound work so we don't block the event loop
_executor = ThreadPoolExecutor(max_workers=4)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[uuid.UUID] = None


# Data-aware chat endpoint
@router.post("/", response_model=dict)
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """Send the user's message to OpenAI with finance-data context."""
    try:
        loop = asyncio.get_event_loop()
        reply = await loop.run_in_executor(_executor, get_data_chat_response, request.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")

    if request.session_id:
        #save the user's message
        db.add(ChatMessage(session_id=request.session_id, role="user", text=request.message))
        #Save chatbot response
        db.add(ChatMessage(session_id=request.session_id, role="bot", text=reply))
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
        "session_id": str(session.id) if request.session_id and session else None,
        "chat_title": session.chat_title if request.session_id and session else None,
        "chat_summary": session.chat_summary if request.session_id and session else None,
    }


# Summary report -> downloadable Excel file
@router.post("/summary")
async def summary():
    """Generate a 3-sheet Excel workbook from the finance database."""
    try:
        loop = asyncio.get_event_loop()
        xlsx_bytes = await loop.run_in_executor(_executor, generate_summary_reports)
        return StreamingResponse(
            io.BytesIO(xlsx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=summary_reports.xlsx"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation error: {str(e)}")
