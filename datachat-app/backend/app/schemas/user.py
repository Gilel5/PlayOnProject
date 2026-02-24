#Defines what user data is safe to return to client

import uuid
from pydantic import BaseModel, EmailStr, ConfigDict, Field

class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    is_active: bool

    class Config:
        #Allows Pydantic to read from ORM objects
        from_attributes = True
