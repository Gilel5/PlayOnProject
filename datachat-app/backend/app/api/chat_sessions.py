from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
import uuid

from app.db.session import get_db
from app.models.chat_session import ChatSession
from app.models.chat_messages import ChatMessage

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


@router.get("/user/{user_id}/search")
def search_user_sessions(user_id: uuid.UUID, q: str, db: Session = Depends(get_db)):
    from sqlalchemy import or_, and_
    if not q:
        return []

    search_pattern = f"%{q}%"
    matches = (
        db.query(ChatSession.id)
        .outerjoin(ChatMessage, ChatSession.id == ChatMessage.session_id)
        .filter(
            and_(
                ChatSession.user_id == user_id,
                ChatSession.is_archived == False,
                or_(
                    ChatSession.chat_title.ilike(search_pattern),
                    ChatMessage.text.ilike(search_pattern)
                )
            )
        )
        .distinct()
        .all()
    )
    return [str(match[0]) for match in matches]

@router.put("/{session_id}/title")
def update_chat_title(session_id: uuid.UUID, title: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()

    if session:
        session.chat_title = title
        session.title_is_user_edited = True
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

@router.get("/{session_id}/messages")
def get_session_messages(session_id: uuid.UUID, db: Session = Depends(get_db)):
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        {
            "id": str(m.id),
            "session_id": str(m.session_id),
            "role": m.role,
            "text": m.text,
            "chart_data": m.chart_data,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]

@router.delete("/{session_id}/messages")
def clear_session_messages(session_id: uuid.UUID, db: Session = Depends(get_db)):
    db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
    db.commit()
    return {"cleared": True}