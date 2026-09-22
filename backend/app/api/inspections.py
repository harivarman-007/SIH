"""inspections.py

API router for Mine Inspection lifecycle management (Phase 25).
Binding Decisions: D1, D3, D5, D9, D12, D19, D21, D22.

Lifecycle: SCHEDULED -> IN_PROGRESS -> (COMPLETED) -> SUBMITTED
                      \\-> CANCELLED
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.authz.deps import require_permission
from app.authz.errors import forbidden
from app.authz.permissions import Permission
from app.authz.scope import apply_inspection_scope, assert_can_access_inspection
from app.authz.state_machine import execute_transition
from app.database import get_db
from app.models import (
    Alert,
    Inspection,
    InspectionStatus,
    MineSite,
    Observation,
    User,
    UserRole,
    Zone,
)
from app.schemas.inspections import (
    InspectionCreate,
    InspectionDetailOut,
    InspectionOut,
    InspectionStatusUpdate,
)

router = APIRouter(prefix="/inspections", tags=["inspections"])


async def _generate_inspection_code(db: AsyncSession) -> str:
    """Generates sequential code INS-0001 per Decision D21."""
    stmt = select(func.count(Inspection.id))
    result = await db.execute(stmt)
    count = result.scalar() or 0
    return f"INS-{count + 1:04d}"


@router.post("", response_model=InspectionOut, status_code=status.HTTP_201_CREATED)
async def create_inspection(
    req: InspectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INSPECTION_CREATE)),
):
    """
    Schedules and assigns a new mine inspection.
    Restricted to managers with INSPECTION_CREATE permission.
    Generates INS-xxxx human-readable ID and alerts the assigned inspector.
    """
    # Manager scope validation
    if current_user.role == UserRole.mine_official:
        if not current_user.mine_site_id or current_user.mine_site_id != req.mine_site_id:
            raise forbidden("Cannot schedule inspections outside your assigned mine site.")

    # Validate target mine site exists
    mine = await db.get(MineSite, req.mine_site_id)
    if not mine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mine site not found.")

    # Validate assigned inspector exists and has inspector role
    inspector = await db.get(User, req.assigned_inspector_id)
    if not inspector or inspector.role != UserRole.inspector:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned user must be an active field inspector.",
        )

    code = await _generate_inspection_code(db)
    inspection = Inspection(
        code=code,
        mine_site_id=req.mine_site_id,
        zone_id=req.zone_id,
        title=req.title,
        assigned_inspector_id=req.assigned_inspector_id,
        created_by_id=current_user.id,
        scheduled_for=req.scheduled_for,
        due_at=req.due_at,
        status=InspectionStatus.scheduled,
        notes=req.notes,
    )
    db.add(inspection)
    await db.flush()

    # Alert assigned inspector (D19)
    alert = Alert(
        recipient_role="inspector",
        recipient_user_id=req.assigned_inspector_id,
        mine_site_id=req.mine_site_id,
        message=f"New inspection assigned: {code} — {req.title}",
    )
    db.add(alert)

    # Initial transition record & audit ledger entry
    await execute_transition(
        db=db,
        entity_type="inspection",
        entity_id=inspection.id,
        from_state="CREATED",
        to_state=InspectionStatus.scheduled.value,
        actor=current_user,
        actor_type="user",
        audit_action="INSPECTION_ASSIGNED",
        audit_payload={
            "code": code,
            "title": req.title,
            "assigned_inspector_id": str(req.assigned_inspector_id),
            "mine_site_id": str(req.mine_site_id),
        },
    )

    await db.commit()
    await db.refresh(inspection)
    return inspection


@router.get("", response_model=List[InspectionOut])
async def list_inspections(
    status_filter: Optional[InspectionStatus] = Query(None, alias="status"),
    mine_site_id: Optional[UUID] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INSPECTION_VIEW)),
):
    """
    Lists inspections visible to current user based on centralized scope rules.
    """
    stmt = select(Inspection)
    stmt = await apply_inspection_scope(stmt, current_user, db)

    if status_filter:
        stmt = stmt.where(Inspection.status == status_filter)
    if mine_site_id:
        stmt = stmt.where(Inspection.mine_site_id == mine_site_id)

    stmt = stmt.order_by(desc(Inspection.scheduled_for)).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{inspection_id}", response_model=InspectionDetailOut)
async def get_inspection(
    inspection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INSPECTION_VIEW)),
):
    """
    Retrieves full inspection details including linked observation count.
    """
    inspection = await db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found.")

    await assert_can_access_inspection(inspection, current_user, db)

    # Observation count
    obs_stmt = select(func.count(Observation.id)).where(Observation.inspection_id == inspection_id)
    obs_res = await db.execute(obs_stmt)
    obs_count = obs_res.scalar() or 0

    # Load names
    mine = await db.get(MineSite, inspection.mine_site_id)
    zone = await db.get(Zone, inspection.zone_id) if inspection.zone_id else None
    inspector = await db.get(User, inspection.assigned_inspector_id)
    creator = await db.get(User, inspection.created_by_id)

    return InspectionDetailOut(
        id=inspection.id,
        code=inspection.code,
        mine_site_id=inspection.mine_site_id,
        zone_id=inspection.zone_id,
        title=inspection.title,
        assigned_inspector_id=inspection.assigned_inspector_id,
        created_by_id=inspection.created_by_id,
        scheduled_for=inspection.scheduled_for,
        due_at=inspection.due_at,
        status=inspection.status,
        started_at=inspection.started_at,
        completed_at=inspection.completed_at,
        submitted_at=inspection.submitted_at,
        notes=inspection.notes,
        created_at=inspection.created_at,
        updated_at=inspection.updated_at,
        observation_count=obs_count,
        assigned_inspector_name=inspector.full_name if inspector else None,
        created_by_name=creator.full_name if creator else None,
        mine_site_name=mine.name if mine else None,
        zone_name=zone.name if zone else None,
    )


@router.post("/{inspection_id}/start", response_model=InspectionOut)
async def start_inspection(
    inspection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INSPECTION_START)),
):
    """
    Field inspector begins assigned inspection.
    Advances status from SCHEDULED to IN_PROGRESS.
    Emits INSPECTION_STARTED audit event and alerts the mine manager.
    """
    inspection = await db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found.")

    # Guard: only assigned inspector can start (D5)
    if current_user.role == UserRole.inspector and inspection.assigned_inspector_id != current_user.id:
        raise forbidden("Only the assigned inspector may start this inspection.")

    now_utc = datetime.now(timezone.utc)
    old_state = inspection.status.value

    await execute_transition(
        db=db,
        entity_type="inspection",
        entity_id=inspection.id,
        from_state=old_state,
        to_state=InspectionStatus.in_progress.value,
        actor=current_user,
        actor_type="user",
        audit_action="INSPECTION_STARTED",
        audit_payload={"code": inspection.code, "started_at": now_utc.isoformat()},
    )

    inspection.status = InspectionStatus.in_progress
    inspection.started_at = now_utc
    inspection.updated_at = now_utc

    # Alert mine official
    alert = Alert(
        recipient_role="mine_official",
        mine_site_id=inspection.mine_site_id,
        message=f"Inspection started: {inspection.code} by {current_user.full_name}",
    )
    db.add(alert)

    await db.commit()
    await db.refresh(inspection)
    return inspection


@router.post("/{inspection_id}/complete", response_model=InspectionOut)
async def complete_inspection(
    inspection_id: UUID,
    req: Optional[InspectionStatusUpdate] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INSPECTION_START)),
):
    """
    Inspector marks inspection work completed on site.
    Advances status from IN_PROGRESS to COMPLETED.
    """
    inspection = await db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found.")

    if current_user.role == UserRole.inspector and inspection.assigned_inspector_id != current_user.id:
        raise forbidden("Only the assigned inspector may complete this inspection.")

    now_utc = datetime.now(timezone.utc)
    old_state = inspection.status.value

    await execute_transition(
        db=db,
        entity_type="inspection",
        entity_id=inspection.id,
        from_state=old_state,
        to_state=InspectionStatus.completed.value,
        actor=current_user,
        actor_type="user",
        audit_action="INSPECTION_COMPLETED",
        audit_payload={"code": inspection.code, "completed_at": now_utc.isoformat()},
    )

    inspection.status = InspectionStatus.completed
    inspection.completed_at = now_utc
    if req and req.notes:
        inspection.notes = (inspection.notes or "") + f"\n[Completed Note]: {req.notes}"
    inspection.updated_at = now_utc

    await db.commit()
    await db.refresh(inspection)
    return inspection


@router.post("/{inspection_id}/submit", response_model=InspectionOut)
async def submit_inspection(
    inspection_id: UUID,
    req: Optional[InspectionStatusUpdate] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INSPECTION_SUBMIT)),
):
    """
    Inspector submits inspection report for statutory review.
    Advances status to SUBMITTED.
    Emits INSPECTION_SUBMITTED audit event and alerts the mine manager.
    """
    inspection = await db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found.")

    # Guard: only assigned inspector can submit
    if current_user.role == UserRole.inspector and inspection.assigned_inspector_id != current_user.id:
        raise forbidden("Only the assigned inspector may submit this inspection.")

    # Phase 29: Check linked observation count. Zero-observation submission requires sign-off notes.
    obs_count_stmt = select(func.count(Observation.id)).where(Observation.inspection_id == inspection_id)
    obs_count = (await db.execute(obs_count_stmt)).scalar() or 0
    if obs_count == 0 and not (req and req.notes and req.notes.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission with zero observations requires mandatory sign-off notes.",
        )

    now_utc = datetime.now(timezone.utc)
    old_state = inspection.status.value

    await execute_transition(
        db=db,
        entity_type="inspection",
        entity_id=inspection.id,
        from_state=old_state,
        to_state=InspectionStatus.submitted.value,
        actor=current_user,
        actor_type="user",
        audit_action="INSPECTION_SUBMITTED",
        audit_payload={"code": inspection.code, "submitted_at": now_utc.isoformat()},
    )

    inspection.status = InspectionStatus.submitted
    inspection.submitted_at = now_utc
    if req and req.notes:
        inspection.notes = (inspection.notes or "") + f"\n[Submission Note]: {req.notes}"
    inspection.updated_at = now_utc

    # Alert mine manager
    alert = Alert(
        recipient_role="mine_official",
        mine_site_id=inspection.mine_site_id,
        message=f"Inspection submitted for review: {inspection.code} by {current_user.full_name}",
    )
    db.add(alert)

    await db.commit()
    await db.refresh(inspection)
    return inspection


@router.post("/{inspection_id}/cancel", response_model=InspectionOut)
async def cancel_inspection(
    inspection_id: UUID,
    req: Optional[InspectionStatusUpdate] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INSPECTION_CANCEL)),
):
    """
    Cancels a scheduled inspection.
    Requires INSPECTION_CANCEL permission.
    """
    inspection = await db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found.")

    await assert_can_access_inspection(inspection, current_user, db)

    now_utc = datetime.now(timezone.utc)
    old_state = inspection.status.value
    reason = req.reason if req else None

    await execute_transition(
        db=db,
        entity_type="inspection",
        entity_id=inspection.id,
        from_state=old_state,
        to_state=InspectionStatus.cancelled.value,
        actor=current_user,
        actor_type="user",
        reason=reason,
        audit_action="INSPECTION_CANCELLED",
        audit_payload={"code": inspection.code, "reason": reason},
    )

    inspection.status = InspectionStatus.cancelled
    if reason:
        inspection.notes = (inspection.notes or "") + f"\n[Cancelled]: {reason}"
    inspection.updated_at = now_utc

    await db.commit()
    await db.refresh(inspection)
    return inspection
