from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import verify_audit_chain
from app.authz.deps import require_permission
from app.authz.permissions import Permission
from app.database import get_db
from app.models import AuditLog, User
from app.schemas.audit import AuditLogEntryOut, AuditVerifyResponse

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/verify", response_model=AuditVerifyResponse)
async def verify_chain(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.AUDIT_VERIFY)),
):
    is_valid, count, broken_id, msg = await verify_audit_chain(db)
    return AuditVerifyResponse(
        is_valid=is_valid,
        total_checked=count,
        broken_at_id=broken_id,
        message=msg,
    )


@router.get("/log", response_model=List[AuditLogEntryOut])
async def get_audit_log(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.AUDIT_VIEW)),
):
    stmt = select(AuditLog).order_by(desc(AuditLog.id)).limit(limit).offset(offset)
    result = await db.execute(stmt)
    entries = result.scalars().all()
    return [AuditLogEntryOut.model_validate(e) for e in entries]
