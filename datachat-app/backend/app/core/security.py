# Helper methods for password hashing and verification
# - JWT creation and decoding

from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

#CryptContext manages password hashing algorithms

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    #hash a plaintext password using bcrypt and store in database
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

def create_access_token(sub: str) -> str:
    #Create a short-lived JWT access token
    # sub - subject
    # exp : expiration time
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": sub, "exp": exp}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)

def create_refresh_token(sub: str):
    exp = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": sub, "exp": exp, "typ": "refresh"}
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)
    return token, exp

def decode_token(token: str) -> dict:
    #Decode and verify jwt signature
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])