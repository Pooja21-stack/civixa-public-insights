from __future__ import annotations
from typing import Optional
from pydantic import BaseModel
from pydantic import ConfigDict
from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: UserRole
    constituency: Optional[str]
