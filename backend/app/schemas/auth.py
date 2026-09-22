from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, field_validator
from app.models import UserRole


class LoginRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class RegisterRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")
    full_name: str = Field(..., description="Full name")
    role: UserRole = Field(
        default=UserRole.inspector,
        description="Public self-registration role: inspector or contractor only",
    )
    mine_site_id: Optional[UUID] = None

    @field_validator("role")
    @classmethod
    def validate_public_registration_role(cls, v: UserRole) -> UserRole:
        allowed_public_roles = {UserRole.inspector, UserRole.contractor}
        if v not in allowed_public_roles:
            raise ValueError(
                f"Public self-registration is restricted to {[r.value for r in allowed_public_roles]} only. "
                f"Role '{v.value}' requires administrative provisioning."
            )
        return v


class UserOut(BaseModel):
    """
    MUST #2: Backward-compatible response. All original fields at top level.
    Added: permissions (List[str]) and scope (Dict[str, Any]) — additive, not nested.
    """
    id: UUID
    email: str
    full_name: str
    role: UserRole
    mine_site_id: Optional[UUID] = None
    is_active: bool
    created_at: Optional[datetime] = None
    # Phase 24 additions (additive, non-breaking)
    permissions: List[str] = Field(default_factory=list)
    scope: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AdminUserCreateRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")
    full_name: str = Field(..., description="Full name")
    role: UserRole = Field(..., description="Any of the 6 valid roles")
    mine_site_id: Optional[UUID] = None
    corporate_mine_ids: Optional[list[UUID]] = None


class AccessDeniedReportRequest(BaseModel):
    path: str = Field(..., max_length=200, description="Client route path where access was denied")
