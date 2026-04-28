"""
FastAPI application entry point.

Configures the app instance, CORS middleware, and router registration.
Also runs a one-time idempotent migration to add the display_name column
to the users table in environments that pre-date that schema change.
"""

from fastapi import FastAPI
import logging
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.api.routes.upload import router as upload_router
from app.db.session import engine
from app.db.base import Base
from app.api.routes.auth import router as auth_router
from app.api.routes.chat import router as chat_router
from app.api.chat_sessions import router as chat_sessions_router

# Import all models so SQLAlchemy registers them with Base.metadata before
# create_all is called. Without these imports the tables would be missing.
from app.models import user, refresh_token, chat_session  # noqa: F401

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

app = FastAPI(title="Chat Analytics API")

# CORS — the React dev server (port 5173) and the FastAPI server (port 8000)
# are different origins, so explicit origins must be listed.
# allow_credentials=True is required for the HttpOnly refresh-token cookie
# to be sent cross-origin; this means allow_origins cannot be ["*"].
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(chat_sessions_router)
app.include_router(upload_router)


@app.get("/health")
def health():
    """Lightweight liveness probe — confirms the server process is running."""
    return {"ok": True}


# Create all ORM-managed tables if they don't exist yet.
# In production this is typically handled by Alembic migrations;
# here it's left in place to simplify local dev setup.
Base.metadata.create_all(bind=engine)


def ensure_user_display_name_column() -> None:
    """
    Idempotent migration: add the display_name column to the users table.

    This handles environments where the users table was created before
    display_name was added to the ORM model. It runs at startup and is a
    no-op if the column already exists, so it is safe to leave in place.
    In a migration-managed project this would be an Alembic revision instead.
    """
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "users" not in table_names:
        return

    column_names = {col["name"] for col in inspector.get_columns("users")}
    if "display_name" in column_names:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN display_name VARCHAR(120)"))


ensure_user_display_name_column()