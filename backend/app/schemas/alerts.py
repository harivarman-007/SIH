"""
alerts.py
Pydantic schemas for in-app alert notifications.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AlertOut(BaseModel):
    id: UUID
    recipient_role: str
    mine_site_id: Optional[UUID] = None
    observation_id: Optional[UUID] = None
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
