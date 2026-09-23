import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Worker Master Schemas
# ---------------------------------------------------------------------------

class WorkerCreate(BaseModel):
    badge_number: str = Field(..., max_length=64, description="Unique badge number or worker ID")
    name: str = Field(..., max_length=255, description="Full worker name")
    role: str = Field(default="General Miner", max_length=128, description="Role / Designation")
    contractor_id: Optional[uuid.UUID] = Field(None, description="Contractor User ID if outsourced worker")
    mine_site_id: uuid.UUID = Field(..., description="Operational mine site ID")
    is_active: bool = Field(default=True, description="Whether worker is currently active")


class WorkerUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = Field(None, max_length=128)
    contractor_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None


class WorkerOut(BaseModel):
    id: uuid.UUID
    badge_number: str
    name: str
    role: str
    contractor_id: Optional[uuid.UUID] = None
    contractor_name: Optional[str] = None
    mine_site_id: uuid.UUID
    mine_site_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Attendance Schemas
# ---------------------------------------------------------------------------

class AttendanceCreate(BaseModel):
    worker_id: uuid.UUID = Field(..., description="Foreign key to workers.id")
    shift_date: datetime
    shift_type: str = Field(default="day", description="Shift type: day, night, morning, evening")
    clock_in: datetime
    clock_out: Optional[datetime] = None
    hours_worked: Optional[float] = None
    overtime_hours: Optional[float] = None


class AttendanceBulkCreate(BaseModel):
    worker_ids: List[uuid.UUID] = Field(..., min_length=1, description="List of worker IDs to log on this shift")
    mine_site_id: uuid.UUID
    shift_date: datetime
    shift_type: str = Field(default="day")
    clock_in: datetime
    clock_out: Optional[datetime] = None


class AttendanceOut(BaseModel):
    id: uuid.UUID
    worker_id: uuid.UUID
    worker_badge_number: str
    worker_name: str
    worker_role: Optional[str] = None
    contractor_id: Optional[uuid.UUID] = None
    contractor_name: Optional[str] = None
    mine_site_id: uuid.UUID
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


# ---------------------------------------------------------------------------
# Labour Rules & Violations Summary
# ---------------------------------------------------------------------------

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
