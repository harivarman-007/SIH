"""
admin.py
Pydantic schemas for Phase 30 Super Admin Console, Roles & Permissions,
Governance Configuration, and Statutory Reports.
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models import UserRole


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserRoleUpdate(BaseModel):
    role: UserRole


class RolePermissionToggle(BaseModel):
    role: UserRole
    permission: str
    granted: bool


class RolePermissionsOut(BaseModel):
    role: UserRole
    label: str
    user_count: int
    permissions: List[str]
    hard_deny: List[str]
    scope_description: str


class SlaThresholds(BaseModel):
    high_hours: int = Field(ge=1, le=720, default=24)
    medium_hours: int = Field(ge=1, le=720, default=72)
    low_hours: int = Field(ge=1, le=720, default=168)


class RiskFlagThresholds(BaseModel):
    high: float = Field(ge=0.0, le=1.0, default=0.75)
    medium: float = Field(ge=0.0, le=1.0, default=0.45)
    low: float = Field(ge=0.0, le=1.0, default=0.20)


class SystemSettingsOut(BaseModel):
    sla_thresholds: SlaThresholds
    risk_flag_thresholds: RiskFlagThresholds
    updated_at: Optional[datetime] = None
    updated_by_id: Optional[uuid.UUID] = None


class SystemSettingsUpdate(BaseModel):
    sla_thresholds: Optional[SlaThresholds] = None
    risk_flag_thresholds: Optional[RiskFlagThresholds] = None


class ComplianceRuleCreate(BaseModel):
    category: str
    code: str
    description: str
    default_severity: str
    statutory_ref: Optional[str] = None


class ComplianceRuleUpdate(BaseModel):
    description: Optional[str] = None
    default_severity: Optional[str] = None
    statutory_ref: Optional[str] = None
    is_active: Optional[bool] = None


class ComplianceRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: str
    code: str
    description: str
    default_severity: str
    statutory_ref: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ReportCreateRequest(BaseModel):
    type: str = Field(description="compliance_summary, violations, closure_performance")
    mine_site_id: Optional[uuid.UUID] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    scope: Optional[Dict[str, Any]] = None
    payload: Dict[str, Any]
    generated_by_id: uuid.UUID
    generated_at: datetime


class ContractorProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    company_name: str
    license_no: Optional[str] = None
    cert_expiry: Optional[datetime] = None
    is_active: bool
    created_at: datetime


class ContractorProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    license_no: Optional[str] = None
    cert_expiry: Optional[datetime] = None
    is_active: Optional[bool] = None


class MineSiteCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    location_name: str = Field(min_length=2, max_length=255)
    lat: Optional[float] = None
    lng: Optional[float] = None


class MineSiteUpdate(BaseModel):
    name: Optional[str] = None
    location_name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_active: Optional[bool] = None


class MineSiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    location_name: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_active: bool = True
    created_at: datetime
    zones_count: Optional[int] = 0


class ZoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    mine_site_id: uuid.UUID
    name: str
    zone_type: str
    risk_baseline: float
    created_at: datetime

