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
    return {"reply": reply}


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
