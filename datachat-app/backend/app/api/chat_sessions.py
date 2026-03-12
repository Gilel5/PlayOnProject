from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import uuid

from app.db.session import get_db
from app.models.chat_session import ChatSession

router = APIRouter(prefix="/chat_sessions", tags=["chat_sessions"])


@router.post("/create")
def create_chat_session(user_id: uuid.UUID, db: Session = Depends(get_db)):
    new_session = ChatSession(
        user_id=user_id,
        chat_title="New Chat"
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return new_session


@router.get("/user/{user_id}")
def get_user_sessions(user_id: uuid.UUID, db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user_id)
        .order_by(ChatSession.last_message_at.desc())
        .all()
    )

    return sessions


@router.put("/{session_id}/title")
def update_chat_title(session_id: uuid.UUID, title: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()

    if session:
        session.chat_title = title
        db.commit()
        db.refresh(session)

    return session


@router.put("/{session_id}/pin")
def toggle_pin(session_id: uuid.UUID, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()

    if session:
        session.is_pinned = not session.is_pinned
        db.commit()
        db.refresh(session)

    return session


@router.delete("/{session_id}")
def delete_chat_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()

    if not session:
        return {"deleted": False}

    db.delete(session)
    db.commit()
    return {"deleted": True}