# Logic for auth that routes can call

# Main Function
    # - store password hashes in user table
    # - use access token for /me
    # - use refresh token (cookie) for /refresh
    # - store refresh token hash in DB

import hashlib
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User
from app.models.refresh_token import RefreshToken

def _hash_token(token: str) -> str:
    #hash refresh token before storing in DB

    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def register_user(db: Session, email: str, password: str) -> User:
    #creates a new user if email is not taken
    if db.query(User).filter(User.email == email).first():
        raise ValueError("Email already registered")
    
    #hash password
    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

def issue_tokens(db: Session, user: User) -> tuple[str, str]:
    ## create access and refresh tokens
    access = create_access_token(sub=str(user.id))
    refresh, refresh_exp = create_refresh_token(sub=str(user.id))

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash = _hash_token(refresh),
            expires_at=refresh_exp,
        )
    )
    db.commit()
    return access, refresh

def rotate_refresh(db: Session, refresh_token: str) -> tuple[str, str]:
    #Rotate a refresh token:
    # validate, ensure it exists, revoke, issue a new pair
    payload = decode_token(refresh_token)

    if payload.get("typ") != "refresh":
        raise ValueError("Invalid refresh token")
    
    user_id = payload["sub"]

    #find refresh token record
    row = db.query(RefreshToken).filter(
        RefreshToken.token_hash == _hash_token(refresh_token)
    ).first()

    if not row:
        raise ValueError("Refresh token not found")
    if row.revoked_at is not None:
        raise ValueError("Refresh token revoked")
    
    if row.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise ValueError("Refresh token expired")
    
    row.revoked_at = datetime.now(timezone.utc)
    db.commit()

    #Load and issue new tokens
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")
    return issue_tokens(db, user)

def revoke_refresh(db: Session, refresh_token: str) -> None:
    row = db.query(RefreshToken).filter(
        RefreshToken.token_hash == _hash_token(refresh_token)
    ).first()

    if row and row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)
        db.commit()