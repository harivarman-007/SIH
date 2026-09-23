import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.audit.chain import append_audit_entry
from app.authz.scope import visible_mine_ids
from app.database import get_db
from app.models import LabourAttendance, LabourComplianceRule, MineSite, User, UserRole, Worker
from app.schemas.labour import (
    AttendanceBulkCreate,
    AttendanceCreate,
    AttendanceOut,
    LabourRuleOut,
    LabourRuleUpdate,
    LabourViolationsSummary,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/labour", tags=["labour"])

# Mines Act 1952 statutory defaults
DEFAULT_MAX_SHIFT = 8.0
DEFAULT_MAX_OT = 2.0
DEFAULT_MIN_REST = 16.0

ALLOWED_LABOUR_ROLES = {
    UserRole.super_admin,
    UserRole.mine_official,
    UserRole.corporate_management,
    UserRole.regulator,
}


def _verify_labour_role(user: User):
    """Enforce fail-closed role-gating for statutory labour endpoints."""
    if user.role not in ALLOWED_LABOUR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to statutory labour register is restricted to mine officials, corporate management, regulators, and administrators.",
        )


async def _get_effective_rule(db: AsyncSession, mine_site_id: uuid.UUID) -> tuple[float, float, float]:
    """Retrieve mine-site specific labour rule, falling back to global rule or statutory defaults."""
    stmt = select(LabourComplianceRule).where(
        (LabourComplianceRule.mine_site_id == mine_site_id) | (LabourComplianceRule.mine_site_id.is_(None))
    ).order_by(LabourComplianceRule.mine_site_id.desc().nullslast())
    res = await db.execute(stmt)
    rule = res.scalars().first()
    if rule:
        return (rule.max_shift_hours, rule.max_overtime_hours, rule.min_rest_hours_between_shifts)
    return (DEFAULT_MAX_SHIFT, DEFAULT_MAX_OT, DEFAULT_MIN_REST)


def _to_attendance_out(att: LabourAttendance) -> AttendanceOut:
    worker = att.worker
    contractor = worker.contractor if worker else None
    return AttendanceOut(
        id=att.id,
        worker_id=att.worker_id,
        worker_badge_number=worker.badge_number if worker else "UNKNOWN",
        worker_name=worker.name if worker else "Unknown Worker",
        worker_role=worker.role if worker else None,
        contractor_id=worker.contractor_id if worker else None,
        contractor_name=contractor.full_name if contractor else None,
        mine_site_id=att.mine_site_id,
        shift_date=att.shift_date,
        shift_type=att.shift_type,
        clock_in=att.clock_in,
        clock_out=att.clock_out,
        hours_worked=att.hours_worked,
        overtime_hours=att.overtime_hours,
        is_violation=att.is_violation,
        violation_reason=att.violation_reason,
        created_at=att.created_at,
    )


@router.get("/attendance", response_model=List[AttendanceOut])
async def list_attendance(
    mine_site_id: Optional[uuid.UUID] = Query(None),
    is_violation: Optional[bool] = Query(None),
    query: Optional[str] = Query(None, description="Search by worker name or badge number"),
    worker_id: Optional[str] = Query(None, description="Filter by worker badge or id string"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List labour attendance register entries scoped to caller's authorized mines."""
    _verify_labour_role(current_user)

    allowed_sites = await visible_mine_ids(db, current_user)
    stmt = (
        select(LabourAttendance)
        .join(Worker, LabourAttendance.worker_id == Worker.id)
        .options(
            selectinload(LabourAttendance.worker).selectinload(Worker.contractor),
            selectinload(LabourAttendance.mine_site),
        )
    )

    if allowed_sites is not None:
        stmt = stmt.where(LabourAttendance.mine_site_id.in_(allowed_sites))

    if mine_site_id:
        if allowed_sites is not None and mine_site_id not in allowed_sites:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mine site is outside your authorized operational scope.",
            )
        stmt = stmt.where(LabourAttendance.mine_site_id == mine_site_id)

    if is_violation is not None:
        stmt = stmt.where(LabourAttendance.is_violation == is_violation)

    search_term = query or worker_id
    if search_term:
        term = search_term.strip()
        stmt = stmt.where(
            or_(
                Worker.name.ilike(f"%{term}%"),
                Worker.badge_number.ilike(f"%{term}%"),
                Worker.role.ilike(f"%{term}%"),
            )
        )

    stmt = stmt.order_by(desc(LabourAttendance.shift_date), desc(LabourAttendance.clock_in)).offset(offset).limit(limit)
    res = await db.execute(stmt)
    records = res.scalars().all()
    return [_to_attendance_out(r) for r in records]


async def _evaluate_shift_and_create(
    db: AsyncSession,
    worker: Worker,
    shift_date: datetime,
    shift_type: str,
    clock_in: datetime,
    clock_out: Optional[datetime],
    hours_worked_in: Optional[float] = None,
    overtime_hours_in: Optional[float] = None,
) -> LabourAttendance:
    """Core evaluation engine for shift hours and Mines Act 1952 statutory violations."""
    # 1. Compute hours worked
    hours_worked = hours_worked_in
    if hours_worked is None and clock_out:
        diff_sec = (clock_out - clock_in).total_seconds()
        hours_worked = max(0.0, round(diff_sec / 3600.0, 2))
    elif hours_worked is None:
        hours_worked = 8.0

    max_shift, max_ot, min_rest = await _get_effective_rule(db, worker.mine_site_id)

    overtime_hours = overtime_hours_in
    if overtime_hours is None:
        overtime_hours = max(0.0, round(hours_worked - max_shift, 2))

    # 2. Check for statutory violations
    violations: List[str] = []

    # A. Shift & Overtime limits (Mines Act 1952 Sections 28, 30 & 35)
    if hours_worked > (max_shift + max_ot):
        violations.append(
            f"Daily shift of {hours_worked:.1f}h exceeds statutory limit of {max_shift + max_ot:.1f}h (Mines Act 1952 Sec 28/30)"
        )
    elif overtime_hours > max_ot:
        violations.append(
            f"Overtime of {overtime_hours:.1f}h exceeds statutory ceiling of {max_ot:.1f}h"
        )

    # B. Rest interval between shifts (Mines Act 1952 Section 31: min 16h rest)
    prev_stmt = (
        select(LabourAttendance)
        .where(
            LabourAttendance.worker_id == worker.id,
            LabourAttendance.clock_out.isnot(None),
            LabourAttendance.clock_out <= clock_in,
        )
        .order_by(desc(LabourAttendance.clock_out))
        .limit(1)
    )
    prev_shift = (await db.execute(prev_stmt)).scalars().first()
    if prev_shift and prev_shift.clock_out:
        rest_duration_hours = (clock_in - prev_shift.clock_out).total_seconds() / 3600.0
        if rest_duration_hours < min_rest:
            violations.append(
                f"Insufficient rest period of {rest_duration_hours:.1f}h between shifts (statutory minimum is {min_rest:.1f}h per Mines Act Sec 31)"
            )

    is_violation = len(violations) > 0
    violation_reason = "; ".join(violations) if is_violation else None

    attendance = LabourAttendance(
        worker_id=worker.id,
        mine_site_id=worker.mine_site_id,
        shift_date=shift_date,
        shift_type=shift_type.lower(),
        clock_in=clock_in,
        clock_out=clock_out,
        hours_worked=hours_worked,
        overtime_hours=overtime_hours,
        is_violation=is_violation,
        violation_reason=violation_reason,
    )
    db.add(attendance)
    return attendance


@router.post("/attendance", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
async def create_attendance(
    req: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Log worker shift attendance by worker_id FK with automatic Mines Act 1952 statutory violation detection.
    Worker identity (name, role, contractor) is resolved from the master directory.
    """
    _verify_labour_role(current_user)

    # 1. Fetch worker
    stmt = (
        select(Worker)
        .options(selectinload(Worker.contractor), selectinload(Worker.mine_site))
        .where(Worker.id == req.worker_id)
    )
    worker = (await db.execute(stmt)).scalars().first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker not found in master directory.",
        )

    if not worker.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Worker '{worker.name}' ({worker.badge_number}) is inactive.",
        )

    allowed_sites = await visible_mine_ids(db, current_user)
    if allowed_sites is not None and worker.mine_site_id not in allowed_sites:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot record attendance for a worker at an unauthorized mine site.",
        )

    attendance = await _evaluate_shift_and_create(
        db=db,
        worker=worker,
        shift_date=req.shift_date,
        shift_type=req.shift_type,
        clock_in=req.clock_in,
        clock_out=req.clock_out,
        hours_worked_in=req.hours_worked,
        overtime_hours_in=req.overtime_hours,
    )
    await db.flush()

    # Append to cryptographic audit chain
    await append_audit_entry(
        db,
        action="labour.attendance_logged",
        actor_id=current_user.id,
        payload={
            "attendance_id": str(attendance.id),
            "worker_id": str(worker.id),
            "worker_badge": worker.badge_number,
            "mine_site_id": str(attendance.mine_site_id),
            "hours_worked": attendance.hours_worked,
            "is_violation": attendance.is_violation,
            "violation_reason": attendance.violation_reason,
        },
    )

    await db.commit()
    await db.refresh(attendance)
    attendance.worker = worker
    return _to_attendance_out(attendance)


@router.post("/attendance/bulk", response_model=List[AttendanceOut], status_code=status.HTTP_201_CREATED)
async def bulk_create_attendance(
    req: AttendanceBulkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Log attendance for an entire shift crew at once.
    All selected workers are marked on the same shift date/time with individual violation evaluation.
    """
    _verify_labour_role(current_user)

    allowed_sites = await visible_mine_ids(db, current_user)
    if allowed_sites is not None and req.mine_site_id not in allowed_sites:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mine site is outside your authorized operational scope.",
        )

    # Fetch all workers in batch
    stmt = (
        select(Worker)
        .options(selectinload(Worker.contractor), selectinload(Worker.mine_site))
        .where(Worker.id.in_(req.worker_ids))
    )
    workers = (await db.execute(stmt)).scalars().all()
    worker_map = {w.id: w for w in workers}

    created_records: List[LabourAttendance] = []
    for w_id in req.worker_ids:
        worker = worker_map.get(w_id)
        if not worker or not worker.is_active:
            continue
        if worker.mine_site_id != req.mine_site_id:
            continue

        attendance = await _evaluate_shift_and_create(
            db=db,
            worker=worker,
            shift_date=req.shift_date,
            shift_type=req.shift_type,
            clock_in=req.clock_in,
            clock_out=req.clock_out,
        )
        created_records.append(attendance)

    await db.flush()

    # Append single aggregated audit entry
    await append_audit_entry(
        db,
        action="labour.bulk_attendance_logged",
        actor_id=current_user.id,
        payload={
            "mine_site_id": str(req.mine_site_id),
            "total_crew_logged": len(created_records),
            "shift_date": req.shift_date.isoformat(),
            "shift_type": req.shift_type,
        },
    )

    await db.commit()

    results: List[AttendanceOut] = []
    for att in created_records:
        await db.refresh(att)
        att.worker = worker_map[att.worker_id]
        results.append(_to_attendance_out(att))

    return results


@router.get("/violations", response_model=LabourViolationsSummary)
async def get_labour_violations(
    mine_site_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregated statutory compliance overview for labour and attendance."""
    _verify_labour_role(current_user)

    allowed_sites = await visible_mine_ids(db, current_user)
    stmt = select(LabourAttendance)

    if allowed_sites is not None:
        stmt = stmt.where(LabourAttendance.mine_site_id.in_(allowed_sites))

    if mine_site_id:
        if allowed_sites is not None and mine_site_id not in allowed_sites:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mine site is outside your authorized operational scope.",
            )
        stmt = stmt.where(LabourAttendance.mine_site_id == mine_site_id)

    res = await db.execute(stmt)
    records = res.scalars().all()

    total_shifts = len(records)
    active_workers = len(set(r.worker_id for r in records))
    violation_shifts = sum(1 for r in records if r.is_violation)
    overtime_breaches = sum(
        1 for r in records if r.violation_reason and "overtime" in r.violation_reason.lower()
    )
    rest_breaches = sum(
        1 for r in records if r.violation_reason and "rest" in r.violation_reason.lower()
    )

    compliance_rate = (
        round(((total_shifts - violation_shifts) / total_shifts) * 100.0, 1)
        if total_shifts > 0
        else 100.0
    )

    return LabourViolationsSummary(
        total_shifts=total_shifts,
        active_workers=active_workers,
        violation_shifts=violation_shifts,
        overtime_breaches=overtime_breaches,
        rest_breaches=rest_breaches,
        compliance_rate_pct=compliance_rate,
    )


@router.get("/rules", response_model=LabourRuleOut)
async def get_labour_rules(
    mine_site_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve active statutory labour compliance rules for a mine site."""
    _verify_labour_role(current_user)

    stmt = select(LabourComplianceRule).where(
        (LabourComplianceRule.mine_site_id == mine_site_id) | (LabourComplianceRule.mine_site_id.is_(None))
    ).order_by(LabourComplianceRule.mine_site_id.desc().nullslast())
    res = await db.execute(stmt)
    rule = res.scalars().first()
    if not rule:
        rule = LabourComplianceRule(
            mine_site_id=None,
            max_shift_hours=DEFAULT_MAX_SHIFT,
            max_overtime_hours=DEFAULT_MAX_OT,
            min_rest_hours_between_shifts=DEFAULT_MIN_REST,
        )
        db.add(rule)
        await db.commit()
        await db.refresh(rule)
    return rule


@router.put("/rules", response_model=LabourRuleOut)
async def update_labour_rules(
    req: LabourRuleUpdate,
    mine_site_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update statutory labour thresholds (Mines Act 1952 limits). Role-gated to managers and admins."""
    if current_user.role not in [UserRole.super_admin, UserRole.mine_official, UserRole.corporate_management]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only mine officials and administrators can configure statutory labour rules.",
        )

    stmt = select(LabourComplianceRule).where(LabourComplianceRule.mine_site_id == mine_site_id)
    res = await db.execute(stmt)
    rule = res.scalars().first()

    if not rule:
        rule = LabourComplianceRule(
            mine_site_id=mine_site_id,
            max_shift_hours=req.max_shift_hours or DEFAULT_MAX_SHIFT,
            max_overtime_hours=req.max_overtime_hours or DEFAULT_MAX_OT,
            min_rest_hours_between_shifts=req.min_rest_hours_between_shifts or DEFAULT_MIN_REST,
        )
        db.add(rule)
    else:
        if req.max_shift_hours is not None:
            rule.max_shift_hours = req.max_shift_hours
        if req.max_overtime_hours is not None:
            rule.max_overtime_hours = req.max_overtime_hours
        if req.min_rest_hours_between_shifts is not None:
            rule.min_rest_hours_between_shifts = req.min_rest_hours_between_shifts

    await db.commit()
    await db.refresh(rule)
    return rule
