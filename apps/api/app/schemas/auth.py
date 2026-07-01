from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, ConfigDict
from pydantic import EmailStr
from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = "staff"
    constituency: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: UserRole
    constituency: Optional[str] = None
