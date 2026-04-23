## FastAPI application entry point

#Tasks
    # create app instance
    #configure CORS
    # include routers
    # create DB tables (local)

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

# Import models so SQLAlchemy "sees" them when creating metadata.
# Without importing, Base.metadata might be missing tables.
from app.models import user, refresh_token, chat_session  # noqa: F401

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

app = FastAPI(title="Chat Analytics API")

# CORS configuration:
    # react dev server runs on http://localhost:5173
    # backend runs on http://localhost:8000

    #cookies across origins requirements
        #allow_credentials=tRUE
        #allow_origins must be explicit

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
    ## endpoint to confirm server is up

    return {"ok": True}

#Local Table Creation
Base.metadata.create_all(bind=engine)


def ensure_user_display_name_column() -> None:
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