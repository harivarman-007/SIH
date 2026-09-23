import uuid
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AttendanceCreate(BaseModel):
    worker_id: str = Field(..., max_length=64, description="Worker identifier or badge number")
    worker_name: str = Field(..., max_length=255, description="Worker full name")
    mine_site_id: uuid.UUID
    contractor_id: Optional[uuid.UUID] = None
    shift_date: datetime
    shift_type: str = Field(default="day", description="Shift type: day, night, morning, evening")
    clock_in: datetime
    clock_out: Optional[datetime] = None
    hours_worked: Optional[float] = None
    overtime_hours: Optional[float] = None


class AttendanceOut(BaseModel):
    id: uuid.UUID
    worker_id: str
    worker_name: str
    mine_site_id: uuid.UUID
    contractor_id: Optional[uuid.UUID] = None
    shift_date: datetime
    shift_type: str
    clock_in: datetime
    clock_out: Optional[datetime] = None
    hours_worked: float
    overtime_hours: float
    is_violation: bool
    violation_reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LabourRuleOut(BaseModel):
    id: uuid.UUID
    mine_site_id: Optional[uuid.UUID] = None
    max_shift_hours: float
    max_overtime_hours: float
    min_rest_hours_between_shifts: float
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LabourRuleUpdate(BaseModel):
    max_shift_hours: Optional[float] = Field(None, ge=4.0, le=16.0)
    max_overtime_hours: Optional[float] = Field(None, ge=0.0, le=8.0)
    min_rest_hours_between_shifts: Optional[float] = Field(None, ge=8.0, le=24.0)


class LabourViolationsSummary(BaseModel):
    total_shifts: int
    active_workers: int
    violation_shifts: int
    overtime_breaches: int
    rest_breaches: int
    compliance_rate_pct: float
