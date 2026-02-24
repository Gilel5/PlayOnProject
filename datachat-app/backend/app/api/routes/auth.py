# Defines the HTTP endpoints under /auth

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import RegisterIn, LoginIn, TokenOut
from app.schemas.user import UserOut
from app.models.user import User
from app.core.security import decode_token
from app.core.config import settings
from app.services.auth_services import (
    register_user,
    authenticate_user,
    issue_tokens,
    rotate_refresh,
    revoke_refresh,
)

router = APIRouter(prefix="/auth", tags=["auth"])

bearer = HTTPBearer(auto_error=False)

REFRESH_COOKIE = "refresh_token"

def set_refresh_cookie(resp: Response, refresh: str):
    #refresh tokens should be httpOnly so JS can't read them
    resp.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        domain=settings.COOKIE_DOMAIN,
        path="/auth",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60, 
    )

def clear_refresh_cookie(resp: Response):
    #Delete refresh cookie on logout
    resp.delete_cookie(
        key=REFRESH_COOKIE,
        domain=settings.COOKIE_DOMAIN,
        path="/auth"
    )
    
@router.post("/register", response_model=TokenOut)
def register(data: RegisterIn, resp: Response, db: Session = Depends(get_db)):
    ##Register:
        #create user row in DB
        # issue tokens
        # set refresh token cookie
        # return access token JSON
    try:
        user = register_user(db, data.email, data.password)
    except ValueError as e:
        #400 for user-created error (already registered)
        raise HTTPException(status_code=400, detail=str(e))
    
    access, refresh = issue_tokens(db, user)
    set_refresh_cookie(resp, refresh)
    return TokenOut(access_token=access)

@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, resp: Response, db: Session = Depends(get_db)):
    #Login:
    # verify email/password
    # issue tokens
    # set refresh token cookie
    # return access token JSON

    user = authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access, refresh = issue_tokens(db, user)
    set_refresh_cookie(resp, refresh)
    return TokenOut(access_token=access)


@router.post("/refresh", response_model=TokenOut)
def refresh(req: Request, resp: Response, db: Session = Depends(get_db)):
    #refresh:
        # reading refresh token from cookie
        # validate and rotate refresh token
        # set new refresh cookie 
        # return new access token
    token = req.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, DETAIL="Missing refresh token")
    try:
        access, new_refresh = rotate_refresh(db, token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    set_refresh_cookie(resp, new_refresh)
    return TokenOut(access_token=access)


@router.post("/logout")

def logout(req: Request, resp: Response, db: Session = Depends(get_db)):
    # Logout:
        # revoke refresh token in DB
        #clear refresh cookie

    token = req.cookies.get(REFRESH_COOKIE)
    if token:
        revoke_refresh(db, token)
    clear_refresh_cookie(resp)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    #Current user endpoint
        # requires authorization
        #decode token and load user from DB
    if not creds:
        raise HTTPException(status_code=401, detail="Missing access token")
    try:
        payload = decode_token(creds.credentials)
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid access token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user