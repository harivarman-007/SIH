"""actions.py

Pydantic v2 schemas for Corrective Actions and Evidence (Phase 26).
"""
from datetime import datetime
from typing import List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import ActionPriority, ActionStatus, EvidenceKind


class ActionCreate(BaseModel):
    observation_id: UUID
    title: str = Field(..., min_length=3, max_length=255)
    description: str
    assigned_to_user_id: UUID
    priority: ActionPriority = ActionPriority.medium
    due_at: datetime
    safety_standards_referenced: Optional[Union[List[str], str]] = None

    @field_validator("safety_standards_referenced", mode="before")
    @classmethod
    def normalize_safety_standards(cls, v):
        if isinstance(v, str):
            trimmed = v.strip()
            return [trimmed] if trimmed else None
        return v


class ActionRejectRequest(BaseModel):
    reason: str = Field(..., min_length=10, description="Detailed rejection reason required (min 10 chars)")


class EvidenceCreate(BaseModel):
    kind: EvidenceKind = EvidenceKind.before_photo
    file_url: str = Field(..., min_length=5)
    description: Optional[str] = None
    hash_sha256: Optional[str] = None
    file_size_bytes: Optional[int] = None

    @field_validator("kind", mode="before")
    @classmethod
    def normalize_kind(cls, v):
        if isinstance(v, str):
            vl = v.lower()
            if vl in ("after", "after_photo"):
                return EvidenceKind.after_photo
            if vl in ("before", "before_photo"):
                return EvidenceKind.before_photo
            if vl in ("document", "doc"):
                return EvidenceKind.document
            if vl in ("note", "notes"):
                return EvidenceKind.note
        return v


class EvidenceOut(BaseModel):
    id: UUID
    action_id: UUID
    kind: EvidenceKind
    file_url: str
    hash_sha256: Optional[str] = None
    file_size_bytes: Optional[int] = None
    uploaded_by_id: UUID
    uploaded_at: datetime
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ActionOut(BaseModel):
    id: UUID
    code: str
    observation_id: UUID
    mine_site_id: UUID
    title: str
    description: str
    assigned_to_user_id: UUID
    assigned_by_user_id: UUID
    priority: ActionPriority
    status: ActionStatus
    due_at: datetime
    accepted_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    verified_by_user_id: Optional[UUID] = None
    closed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    submission_round: int
    safety_standards_referenced: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActionDetailOut(ActionOut):
    evidences: List[EvidenceOut] = []
    assigned_to_name: Optional[str] = None
    assigned_by_name: Optional[str] = None
    verified_by_name: Optional[str] = None
