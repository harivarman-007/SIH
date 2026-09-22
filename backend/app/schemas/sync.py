from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from app.schemas.observation import ObservationCreate, ObservationOut
from app.schemas.inspections import InspectionOut
from app.schemas.actions import ActionOut


class SyncBatchRequest(BaseModel):
    observations: List[ObservationCreate]


class SyncBatchResponse(BaseModel):
    synced_count: int
    created_ids: List[UUID]
    synced_at: datetime


class SyncStatusResponse(BaseModel):
    total_observations: int
    synced_observations: int
    unsynced_observations: int
    sync_rate_pct: float


class SyncPullResponse(BaseModel):
    watermark: datetime
    inspections: List[InspectionOut] = []
    observations: List[ObservationOut] = []
    actions: List[ActionOut] = []
