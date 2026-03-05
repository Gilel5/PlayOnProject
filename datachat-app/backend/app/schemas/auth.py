#Pydantic schemas for request/response validation
    #FastAPI uses these to validate incoming JSON bodies automatically.
    #Generates OpenAPI docs.

from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if len(value) > 128:
            raise ValueError("Password must be no more than 128 characters long")
        if not any(char.isupper() for char in value):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(char.islower() for char in value):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(char.isdigit() for char in value):
            raise ValueError("Password must contain at least one number")
        if not any(not char.isalnum() for char in value):
            raise ValueError("Password must contain at least one special character")
        return value


class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    #access token returned to frontend
    access_token: str

    token_type: str = "bearer"
