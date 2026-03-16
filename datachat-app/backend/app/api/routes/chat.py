from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import uuid
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from app.services.openai_services import get_chat_response
from app.db.session import get_db
from app.models.chat_session import ChatSession

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[uuid.UUID] = None

# OpenAI endpoint (for chatting)
@router.post("/", response_model=dict)
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    #Send the user's message to openAI
    try:
        reply = get_chat_response(request.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")
    
    if request.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == request.session_id).first()
        if session:
            session.last_message_at = datetime.now(timezone.utc)
            db.commit()
    return {"reply": reply}
