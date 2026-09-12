from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field
from app.models import UserRole


class LoginRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class RegisterRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")
    full_name: str = Field(..., description="Full name")
    role: UserRole
    mine_site_id: Optional[UUID] = None


class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: UserRole
    mine_site_id: Optional[UUID] = None
    is_active: bool

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
