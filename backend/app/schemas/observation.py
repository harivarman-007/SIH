from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field
from app.models import ObservationCategory, ObservationStatus, RiskFlag


class ObservationCreate(BaseModel):
    category: ObservationCategory
    description: str
    mine_site_id: UUID
    zone_id: UUID
    photo_url: Optional[str] = None
    has_photo: bool = False
    lat: Optional[float] = None
    lng: Optional[float] = None
    beacon_id: Optional[str] = None
    edge_score: Optional[float] = None
    edge_flag: Optional[RiskFlag] = None
    edge_reasons: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None  # Client capture timestamp


class ObservationCloseRequest(BaseModel):
    closure_note: str
    closure_photo_url: Optional[str] = None


class ObservationOut(BaseModel):
    id: UUID
    created_at: datetime
    synced_at: Optional[datetime] = None
    inspector_id: UUID
    mine_site_id: UUID
    zone_id: UUID
    category: ObservationCategory
    description: str
    photo_url: Optional[str] = None
    has_photo: bool
    lat: Optional[float] = None
    lng: Optional[float] = None
    beacon_id: Optional[str] = None
    edge_score: Optional[float] = None
    edge_flag: Optional[RiskFlag] = None
    edge_reasons: Optional[Dict[str, Any]] = None
    cloud_score: Optional[float] = None
    cloud_flag: Optional[RiskFlag] = None
    cloud_reasons: Optional[Dict[str, Any]] = None
    suggested_action: Optional[str] = None
    enriched_at: Optional[datetime] = None
    status: ObservationStatus
    closed_at: Optional[datetime] = None
    closed_by_id: Optional[UUID] = None
    closure_photo_url: Optional[str] = None
    closure_note: Optional[str] = None
    escalated_at: Optional[datetime] = None
    version: int

    class Config:
        from_attributes = True


class RiskCardOut(BaseModel):
    observation_id: UUID
    category: ObservationCategory
    description: str
    status: ObservationStatus
    edge_score: Optional[float] = None
    edge_flag: Optional[RiskFlag] = None
    edge_reasons: Optional[Dict[str, Any]] = None
    cloud_score: Optional[float] = None
    cloud_flag: Optional[RiskFlag] = None
    cloud_reasons: Optional[Dict[str, Any]] = None
    suggested_action: Optional[str] = None
    created_at: datetime
    synced_at: Optional[datetime] = None
    mine_site_id: UUID
    zone_id: UUID
    beacon_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class ContractorAssignRequest(BaseModel):
    contractor_id: UUID
    notes: Optional[str] = None


class ContractorAssignmentOut(BaseModel):
    id: UUID
    contractor_id: UUID
    observation_id: UUID
    assigned_at: datetime
    notes: Optional[str] = None

    class Config:
        from_attributes = True
