"""
Authentication business logic.

Implements the core auth operations that route handlers delegate to:
  - User registration with duplicate-email detection.
  - Credential verification for login.
  - Access + refresh token issuance and rotation.
  - Refresh token revocation on logout or password change.

Refresh tokens are stored as SHA-256 hashes — the raw token is never
persisted, so a database breach does not expose usable tokens.
"""

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
    """
    Return the SHA-256 hex digest of a refresh token.

    Tokens are hashed before being stored so that a database read cannot
    yield a token that can be replayed against the /auth/refresh endpoint.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def register_user(db: Session, email: str, password: str) -> User:
    """
    Create a new user if the email isn't already taken.

    The display name defaults to the local part of the email address
    (everything before the @) as a sensible first-run name.

    Raises ValueError if the email is already registered.
    """
    if db.query(User).filter(User.email == email).first():
        raise ValueError("Email already registered")

    default_name = email.split("@", 1)[0].strip() or "User"
    user = User(email=email, display_name=default_name, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """
    Verify email + password and return the User, or None on failure.

    Returns None (rather than raising) so the caller controls the HTTP status.
    Inactive accounts are rejected the same way as a wrong password to avoid
    leaking account-existence information.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def issue_tokens(db: Session, user: User) -> tuple[str, str]:
    """
    Mint a new access token and refresh token for a user.

    The refresh token hash is persisted to the database so it can be
    validated and revoked later. Returns (access_token, refresh_token).
    """
    access = create_access_token(sub=str(user.id))
    refresh, refresh_exp = create_refresh_token(sub=str(user.id))

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=_hash_token(refresh),
            expires_at=refresh_exp,
        )
    )
    db.commit()
    return access, refresh


def rotate_refresh(db: Session, refresh_token: str) -> tuple[str, str]:
    """
    Validate a refresh token, revoke it, and issue a new token pair.

    Rotation means each refresh token can only be used once, limiting the
    blast radius of a stolen token to a single use before it's invalidated.

    Raises ValueError if the token is invalid, revoked, or expired.
    Returns (new_access_token, new_refresh_token).
    """
    payload = decode_token(refresh_token)

    if payload.get("typ") != "refresh":
        raise ValueError("Invalid refresh token")

    user_id = payload["sub"]

    row = db.query(RefreshToken).filter(
        RefreshToken.token_hash == _hash_token(refresh_token)
    ).first()

    if not row:
        raise ValueError("Refresh token not found")
    if row.revoked_at is not None:
        raise ValueError("Refresh token revoked")
    if row.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise ValueError("Refresh token expired")

    # Revoke the old token before issuing the new pair
    row.revoked_at = datetime.now(timezone.utc)
    db.commit()

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")
    return issue_tokens(db, user)


def revoke_refresh(db: Session, refresh_token: str) -> None:
    """
    Mark a refresh token as revoked (logout).

    No-ops silently if the token isn't found or is already revoked,
    so logout is idempotent from the caller's perspective.
    """
    row = db.query(RefreshToken).filter(
        RefreshToken.token_hash == _hash_token(refresh_token)
    ).first()

    if row and row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)
        db.commit()


def change_user_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    """
    Update a user's password after verifying the current one.

    On success, all active refresh tokens for this user are revoked so
    other logged-in sessions (e.g., on other devices) are invalidated.

    Raises ValueError if the current password is wrong or the new password
    is the same as the current one.
    """
    if not verify_password(current_password, user.password_hash):
        raise ValueError("Current password is incorrect")
    if verify_password(new_password, user.password_hash):
        raise ValueError("New password must be different from the current password")

    user.password_hash = hash_password(new_password)

    # Revoke all active sessions — the user will need to log in again everywhere
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": datetime.now(timezone.utc)})

    db.commit()