#Engine for separate financial Supabase database

from sqlalchemy import create_engine
from app.core.config import settings


def _normalize_postgres_url(url: str) -> str:
    # Supabase often provides postgresql:// URLs; force psycopg driver explicitly.
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url

finance_engine = create_engine(
    _normalize_postgres_url(settings.FINANCE_DATABASE_URL),
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=2,
)