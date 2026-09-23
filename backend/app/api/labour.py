import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.chain import append_audit_entry
from app.authz.scope import visible_mine_ids
from app.database import get_db
from app.models import LabourAttendance, LabourComplianceRule, MineSite, User, UserRole
from app.schemas.labour import (
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


@router.get("/attendance", response_model=List[AttendanceOut])
async def list_attendance(
    mine_site_id: Optional[uuid.UUID] = Query(None),
    is_violation: Optional[bool] = Query(None),
    worker_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List labour attendance register entries scoped to caller's authorized mines."""
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

    if is_violation is not None:
        stmt = stmt.where(LabourAttendance.is_violation == is_violation)

    if worker_id:
        stmt = stmt.where(LabourAttendance.worker_id.ilike(f"%{worker_id}%"))

    stmt = stmt.order_by(desc(LabourAttendance.shift_date), desc(LabourAttendance.clock_in)).offset(offset).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/attendance", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
async def create_attendance(
    req: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Log worker shift attendance with automatic Mines Act 1952 statutory violation detection.
    Flags: excessive daily shift duration, overtime cap breach, or insufficient rest between shifts.
    """
    allowed_sites = await visible_mine_ids(db, current_user)
    if allowed_sites is not None and req.mine_site_id not in allowed_sites:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot record attendance for an unauthorized mine site.",
        )

    # 1. Compute hours worked
    hours_worked = req.hours_worked
    if hours_worked is None and req.clock_out:
        diff_sec = (req.clock_out - req.clock_in).total_seconds()
        hours_worked = max(0.0, round(diff_sec / 3600.0, 2))
    elif hours_worked is None:
        hours_worked = 8.0  # default ongoing or standard shift

    max_shift, max_ot, min_rest = await _get_effective_rule(db, req.mine_site_id)

    overtime_hours = req.overtime_hours
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
            LabourAttendance.worker_id == req.worker_id,
            LabourAttendance.clock_out.isnot(None),
            LabourAttendance.clock_out <= req.clock_in,
        )
        .order_by(desc(LabourAttendance.clock_out))
        .limit(1)
    )
    prev_shift = (await db.execute(prev_stmt)).scalars().first()
    if prev_shift and prev_shift.clock_out:
        rest_duration_hours = (req.clock_in - prev_shift.clock_out).total_seconds() / 3600.0
        if rest_duration_hours < min_rest:
            violations.append(
                f"Insufficient rest period of {rest_duration_hours:.1f}h between shifts (statutory minimum is {min_rest:.1f}h per Mines Act Sec 31)"
            )

    is_violation = len(violations) > 0
    violation_reason = "; ".join(violations) if is_violation else None

    attendance = LabourAttendance(
        worker_id=req.worker_id.strip(),
        worker_name=req.worker_name.strip(),
        mine_site_id=req.mine_site_id,
        contractor_id=req.contractor_id,
        shift_date=req.shift_date,
        shift_type=req.shift_type.lower(),
        clock_in=req.clock_in,
        clock_out=req.clock_out,
        hours_worked=hours_worked,
        overtime_hours=overtime_hours,
        is_violation=is_violation,
        violation_reason=violation_reason,
    )
    db.add(attendance)
    await db.flush()

    # Append to cryptographic audit chain
    await append_audit_entry(
        db,
        action="labour.attendance_logged",
        actor_id=current_user.id,
        payload={
            "attendance_id": str(attendance.id),
            "worker_id": attendance.worker_id,
            "mine_site_id": str(attendance.mine_site_id),
            "hours_worked": attendance.hours_worked,
            "is_violation": attendance.is_violation,
            "violation_reason": attendance.violation_reason,
        },
    )

    await db.commit()
    await db.refresh(attendance)
    return attendance


@router.get("/violations", response_model=LabourViolationsSummary)
async def get_labour_violations(
    mine_site_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregated statutory compliance overview for labour and attendance."""
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
    stmt = select(LabourComplianceRule).where(
        (LabourComplianceRule.mine_site_id == mine_site_id) | (LabourComplianceRule.mine_site_id.is_(None))
    ).order_by(LabourComplianceRule.mine_site_id.desc().nullslast())
    res = await db.execute(stmt)
    rule = res.scalars().first()
    if not rule:
        # Create global default rule if absent
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
