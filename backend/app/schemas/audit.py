from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel


class AuditLogEntryOut(BaseModel):
    id: int
    entry_hash: str
    prev_hash: str
    actor_id: Optional[UUID] = None
    action: str
    payload: Dict[str, Any]
    ts: datetime

    class Config:
        from_attributes = True


class AuditVerifyResponse(BaseModel):
    is_valid: bool
    total_checked: int
    broken_at_id: Optional[int] = None
    message: str
