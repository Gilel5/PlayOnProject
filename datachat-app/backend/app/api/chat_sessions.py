"""
Chat session CRUD route handlers (/chat_sessions prefix).

Manages the lifecycle of user chat sessions:
  - Create, list, search, pin, archive, restore, and delete sessions.
  - Fetch and clear messages within a session.

All routes accept a user_id path or query parameter. In a future hardened
version these should be replaced with token-based auth (like the /auth routes)
so users cannot access each other's sessions by guessing a UUID.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import uuid

from app.db.session import get_db
from app.models.chat_session import ChatSession
from app.models.chat_messages import ChatMessage

router = APIRouter(prefix="/chat_sessions", tags=["chat_sessions"])


@router.post("/create")
def create_chat_session(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Create a new chat session for the given user.

    New sessions default to title "New Chat", unpinned, and unarchived.
    The auto-title is overwritten by the background summarisation job after
    the first few messages.
    """
    new_session = ChatSession(
        user_id=user_id,
        chat_title="New Chat",
        is_pinned=False,
        is_archived=False,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@router.get("/user/{user_id}")
def get_user_sessions(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Return all non-archived sessions for a user, sorted by pinned-first then
    most-recently-active. Archived sessions are excluded; use /archived for those.
    """
    sessions = (
        db.query(ChatSession)
        .filter(
            and_(
                ChatSession.user_id == user_id,
                ChatSession.is_archived == False,  # noqa: E712
            )
        )
        .order_by(ChatSession.is_pinned.desc(), ChatSession.last_message_at.desc())
        .all()
    )
    return sessions


@router.get("/user/{user_id}/archived")
def get_archived_sessions(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return all archived sessions for a user, newest first."""
    try:
        sessions = (
            db.query(ChatSession)
            .filter(
                and_(
                    ChatSession.user_id == user_id,
                    ChatSession.is_archived == True,  # noqa: E712
                )
            )
            .order_by(ChatSession.last_message_at.desc())
            .all()
        )
        return sessions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/search")
def search_user_sessions(user_id: uuid.UUID, q: str, db: Session = Depends(get_db)):
    """
    Full-text search across non-archived session titles and message content.

    Returns a list of matching session ID strings (not full session objects)
    so the caller can look up only the sessions it needs. Returns an empty
    list when q is blank rather than loading every session.
    """
    if not q:
        return []

    search_pattern = f"%{q}%"
    matches = (
        db.query(ChatSession.id)
        .outerjoin(ChatMessage, ChatSession.id == ChatMessage.session_id)
        .filter(
            and_(
                ChatSession.user_id == user_id,
                ChatSession.is_archived == False,  # noqa: E712
                or_(
                    ChatSession.chat_title.ilike(search_pattern),
                    ChatMessage.text.ilike(search_pattern),
                ),
            )
        )
        .distinct()
        .all()
    )
    return [str(match[0]) for match in matches]


@router.put("/{session_id}/title")
def update_chat_title(session_id: uuid.UUID, title: str, db: Session = Depends(get_db)):
    """
    Rename a session and mark it as user-edited.

    Once title_is_user_edited is True the auto-summariser will no longer
    overwrite the title, preserving the user's custom name.
    """
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if session:
        session.chat_title = title
        session.title_is_user_edited = True
        db.commit()
        db.refresh(session)
    return session


@router.put("/{session_id}/pin")
def toggle_pin(session_id: uuid.UUID, db: Session = Depends(get_db)):
    """Toggle the pinned state of a session (pinned sessions sort to the top)."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if session:
        session.is_pinned = not session.is_pinned
        db.commit()
        db.refresh(session)
    return session


@router.put("/{session_id}/archive")
def archive_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Move a session to the archive.

    Archived sessions are hidden from the main session list but remain
    in the database and can be restored via /restore.
    """
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


@router.put("/{session_id}/restore")
def restore_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    """Move a previously archived session back into the active session list."""
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
    """
    Permanently delete a session and all its messages.

    Returns {"deleted": False} rather than a 404 when the session doesn't
    exist, so idempotent deletes from the frontend don't cause errors.
    """
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        return {"deleted": False}
    db.delete(session)
    db.commit()
    return {"deleted": True}


@router.get("/{session_id}/messages")
def get_session_messages(session_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Return all messages in a session in chronological order.

    Messages are serialised to plain dicts so FastAPI can JSON-encode them
    without needing a full Pydantic schema for the ChatMessage ORM model.
    """
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
    """Delete all messages in a session without deleting the session itself."""
    db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
    db.commit()
    return {"cleared": True}