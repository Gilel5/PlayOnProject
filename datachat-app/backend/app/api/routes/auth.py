"""
Authentication route handlers (/auth prefix).

Implements a stateless access-token + rotating refresh-token scheme:
  - Access tokens are short-lived JWTs returned in the JSON response body.
  - Refresh tokens are longer-lived JWTs stored as HttpOnly cookies so
    JavaScript cannot read them (XSS mitigation).
  - Each refresh rotates the token — the old one is revoked and a new one
    is issued, limiting the damage window if a token is stolen.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.models.refresh_token import RefreshToken
from app.models.chat_session import ChatSession
from app.db.session import get_db
from app.schemas.auth import RegisterIn, LoginIn, TokenOut, ChangePasswordIn
from app.schemas.user import UserOut, UpdateDisplayNameIn
from app.models.user import User
from app.core.security import decode_token
from app.core.config import settings
from app.services.auth_services import (
    register_user,
    authenticate_user,
    issue_tokens,
    rotate_refresh,
    revoke_refresh,
    change_user_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# auto_error=False so we can return a custom 401 instead of FastAPI's default
bearer = HTTPBearer(auto_error=False)

REFRESH_COOKIE = "refresh_token"


def set_refresh_cookie(resp: Response, refresh: str) -> None:
    """
    Write the refresh token into a secure, HttpOnly cookie.

    HttpOnly prevents client-side JavaScript from reading the token,
    which is the primary XSS mitigation for refresh tokens.
    The cookie is scoped to /auth so it isn't sent on every API request.
    """
    resp.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        domain=settings.COOKIE_DOMAIN,
        path="/auth",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


def clear_refresh_cookie(resp: Response) -> None:
    """Delete the refresh token cookie on the client (logout / account deletion)."""
    resp.delete_cookie(
        key=REFRESH_COOKIE,
        domain=settings.COOKIE_DOMAIN,
        path="/auth",
    )


def get_current_user(
    creds: HTTPAuthorizationCredentials | None,
    db: Session,
) -> User:
    """
    Resolve the Bearer token from the Authorization header to a User row.

    Raises HTTPException 401 if the token is missing, invalid, or the
    corresponding user no longer exists in the database.
    """
    if not creds:
        raise HTTPException(status_code=401, detail="Missing access token")
    try:
        payload = decode_token(creds.credentials)
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid access token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/register", response_model=TokenOut)
def register(data: RegisterIn, resp: Response, db: Session = Depends(get_db)):
    """
    Create a new user account and return an access token.

    On success: creates the user row, issues an access + refresh token pair,
    sets the refresh token as an HttpOnly cookie, and returns the access token.
    Returns 400 if the email is already registered.
    """
    try:
        user = register_user(db, data.email, data.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    access, refresh = issue_tokens(db, user)
    set_refresh_cookie(resp, refresh)
    return TokenOut(access_token=access)


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, resp: Response, db: Session = Depends(get_db)):
    """
    Authenticate with email + password and return a new access token.

    Returns 401 if the credentials are invalid or the account is inactive.
    """
    user = authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access, refresh = issue_tokens(db, user)
    set_refresh_cookie(resp, refresh)
    return TokenOut(access_token=access)


@router.post("/refresh", response_model=TokenOut)
def refresh(req: Request, resp: Response, db: Session = Depends(get_db)):
    """
    Exchange a valid refresh-token cookie for a new access + refresh token pair.

    The old refresh token is revoked immediately (rotation), limiting the
    window of exposure if a token is ever compromised.
    Returns 401 if the cookie is missing or the token is invalid/revoked.
    """
    token = req.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        access, new_refresh = rotate_refresh(db, token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    set_refresh_cookie(resp, new_refresh)
    return TokenOut(access_token=access)


@router.post("/logout")
def logout(req: Request, resp: Response, db: Session = Depends(get_db)):
    """
    Revoke the current refresh token and clear the cookie.

    Safe to call even if the cookie is already gone — no-ops gracefully.
    """
    token = req.cookies.get(REFRESH_COOKIE)
    if token:
        revoke_refresh(db, token)
    clear_refresh_cookie(resp)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    """Return the profile of the currently authenticated user."""
    return get_current_user(creds, db)


@router.delete("/me")
def delete_my_account(
    resp: Response,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    """
    Permanently delete the current user's account and all associated data.

    Deletes in order: refresh tokens → chat sessions (cascades messages) → user row.
    Clears the refresh cookie so the client is immediately signed out.
    """
    user = get_current_user(creds, db)

    try:
        db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
        # Chat messages are deleted via DB-level cascade from chat_sessions
        db.query(ChatSession).filter(ChatSession.user_id == user.id).delete()
        db.delete(user)
        db.commit()
        clear_refresh_cookie(resp)
        return {"deleted": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")


@router.patch("/me/name", response_model=UserOut)
def update_my_display_name(
    body: UpdateDisplayNameIn,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    """Update the display name for the current user. Minimum 2 characters."""
    user = get_current_user(creds, db)
    new_name = body.display_name.strip()
    if len(new_name) < 2:
        raise HTTPException(status_code=400, detail="Display name must be at least 2 characters")

    user.display_name = new_name
    db.commit()
    db.refresh(user)
    return user


@router.post("/me/password")
def change_my_password(
    body: ChangePasswordIn,
    resp: Response,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    """
    Change the password for the current user.

    Requires the existing password for verification. On success, revokes all
    active refresh tokens (signing out all other sessions) and clears the
    current refresh cookie so the user must log in again.
    """
    user = get_current_user(creds, db)
    try:
        change_user_password(db, user, body.current_password, body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    clear_refresh_cookie(resp)
    return {"ok": True}