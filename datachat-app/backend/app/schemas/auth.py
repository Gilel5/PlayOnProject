#Pydantic schemas for request/response validation
    #FastAPI uses these to validate incoming JSON bodies automatically.
    #Generates OpenAPI docs.

from pydantic import BaseModel, EmailStr, Field, ConfigDict

class RegisterIn(BaseModel):
    email: EmailStr
    password: str=Field(min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    #access token returned to frontend
    access_token: str

    token_type: str = "bearer"
