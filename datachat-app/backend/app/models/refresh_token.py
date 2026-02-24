#Defines the "refresh_tokens" table used to manage sessions
#Why?
    # Allows logout, refresh token rotation, auditing and invalidating sessions


import uuid
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    #link refresh tokens to user
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
        nullable=False
    )

    #Store hash of refresh token
    token_hash: Mapped[str] = mapped_column(
        String,
        nullable=False
    )

    #column for when the refresh token expires
    expires_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    #when refresh token is revoked
    revoked_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )