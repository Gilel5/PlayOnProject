#Engine for separate financial Supabase database

from sqlalchemy import create_engine
from app.core.config import settings

finance_engine = create_engine(
    settings.FINANCE_DATABASE_URL,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=2,
)