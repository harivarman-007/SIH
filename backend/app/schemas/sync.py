from datetime import datetime
from typing import List
from uuid import UUID
from pydantic import BaseModel
from app.schemas.observation import ObservationCreate


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
