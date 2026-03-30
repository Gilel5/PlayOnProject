#Define the "users" table.
#What we store:
#email (unique)
#display_name (editable profile name)
#password_hash (bcrypt hash, never store raw password)
#is_active flag
#created_at timestamp

import uuid
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    #Primary key UUID
    id: Mapped[uuid.UUID] = mapped_column (
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    #User email must be unique and indexed for fast lookups
    email: Mapped[str] = mapped_column(
        String(320),
        unique=True,
        index=True,
        nullable=False
    )

    display_name: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True
    )

    #store hashed password
    password_hash: Mapped[str] = mapped_column(
        String,
        nullable=False
    )

    #Account Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    #timestamp when row is created
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )