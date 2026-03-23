import uuid
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FileUpload(Base):
    __tablename__ = "files"

    # Unique identifier for each upload record
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # The user who uploaded the file
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Original filename as provided by the user
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    # Number of rows successfully inserted into the finance table
    rows_inserted: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    # Size of the uploaded file in megabytes (MB), rounded to 2 decimal places
    file_size: Mapped[float] = mapped_column(
        Numeric(precision=10, scale=2),
        nullable=False
    )

    # Timestamp when the upload completed
    uploaded_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
