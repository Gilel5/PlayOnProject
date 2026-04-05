#Creates database engine and session.

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


def _normalize_postgres_url(url: str) -> str:
    # Supabase often provides postgresql:// URLs; force psycopg driver explicitly.
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url

#Creating the engine using the local Database URL
#pool_pre_ping=True checks connections
engine = create_engine(_normalize_postgres_url(settings.DATABASE_URL), pool_pre_ping=True)

#SessionLocal creates new DB sessions
#autocommit=False means you control commits
#autoflush=False means SQLAlchemy won't auto-push changes before queries
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    # FastAPI dependency that yields a DB session for each request
    #   Create session
    #   yield to route handler
    #   close session afterward 
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
