from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
import uuid

from app.db.session import get_db
from app.models.chat_session import ChatSession

router = APIRouter(prefix="/chat_sessions", tags=["chat_sessions"])


@router.post("/create")
def create_chat_session(user_id: uuid.UUID, db: Session = Depends(get_db)):
    new_session = ChatSession(
        user_id=user_id,
        chat_title="New Chat",
        is_pinned=False,
        is_archived=False
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return new_session

'only non-archived chats'
@router.get("/user/{user_id}")
def get_user_sessions(user_id: uuid.UUID, db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .filter(
            and_(
                ChatSession.user_id == user_id,
                ChatSession.is_archived == False
            )
        )
        .order_by(ChatSession.is_pinned.desc(), ChatSession.last_message_at.desc())
        .all()
    )

    return sessions

'returns all archived chats for a user'
@router.get("/user/{user_id}/archived")
def get_archived_sessions(user_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        sessions = db.query(ChatSession).filter(
            and_(
                ChatSession.user_id == user_id,
                ChatSession.is_archived == True
            )
        ).order_by(ChatSession.last_message_at.desc()).all()
        
        return sessions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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

'archive selected chat'
@router.put("/{session_id}/archive")
def archive_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session.is_archived = True
        db.commit()
        db.refresh(session)
        
        return session
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

'restore selected chat'
@router.put("/{session_id}/restore")
def restore_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session.is_archived = False
        db.commit()
        db.refresh(session)
        
        return session
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{session_id}")
def delete_chat_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()

    if not session:
        return {"deleted": False}

    db.delete(session)
    db.commit()
    return {"deleted": True}