"""inspections.py

Pydantic v2 schemas for Inspections and Workflow Transitions (Phase 25).
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models import InspectionStatus


class InspectionCreate(BaseModel):
    mine_site_id: UUID
    zone_id: Optional[UUID] = None
    title: str = Field(..., min_length=3, max_length=255)
    assigned_inspector_id: UUID
    scheduled_for: datetime
    due_at: datetime
    notes: Optional[str] = None


class InspectionStatusUpdate(BaseModel):
    notes: Optional[str] = None
    reason: Optional[str] = None


class InspectionOut(BaseModel):
    id: UUID
    code: str
    mine_site_id: UUID
    zone_id: Optional[UUID] = None
    title: str
    assigned_inspector_id: UUID
    created_by_id: UUID
    scheduled_for: datetime
    due_at: datetime
    status: InspectionStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InspectionDetailOut(InspectionOut):
    observation_count: int = 0
    assigned_inspector_name: Optional[str] = None
    created_by_name: Optional[str] = None
    mine_site_name: Optional[str] = None
    zone_name: Optional[str] = None


class WorkflowTransitionOut(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    from_state: str
    to_state: str
    actor_id: Optional[UUID] = None
    actor_role: str
    actor_type: str
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
