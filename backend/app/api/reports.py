"""
reports.py
Statutory Compliance Reports Engine (Phase 30):
- Point-in-time snapshot report generation (compliance_summary, violations, closure_performance)
- Scoped report archives
- CSV export streaming with tamper-evident REPORT_EXPORTED audit tracking
"""
import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.chain import append_audit_entry
from app.authz.deps import require_permission
from app.authz.permissions import Permission
from app.authz.scope import visible_mine_ids
from app.database import get_db
from app.models import (
    ActionPriority,
    ActionStatus,
    CorrectiveAction,
    MineSite,
    Observation,
    ObservationCategory,
    ObservationStatus,
    Report,
    User,
    UserRole,
)
from app.schemas.admin import ReportCreateRequest, ReportOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def generate_report(
    req: ReportCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REPORT_CREATE)),
):
    """
    POST /reports
    Generates a point-in-time statutory report snapshot.
    Available types: compliance_summary, violations, closure_performance.
    Scoped strictly to caller's authorized mines.
    """
    allowed_mine_ids = await visible_mine_ids(db, current_user)
    target_mine_ids = allowed_mine_ids

    if req.mine_site_id:
        if allowed_mine_ids is not None and req.mine_site_id not in allowed_mine_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Mine site is outside your authorized operational scope.", "detail": "Mine site is outside your authorized operational scope."},
            )
        target_mine_ids = [req.mine_site_id]

    now_utc = datetime.now(timezone.utc)
    scope_meta = {
        "target_mines": [str(m) for m in target_mine_ids] if target_mine_ids else "all",
        "date_from": req.date_from.isoformat() if req.date_from else None,
        "date_to": req.date_to.isoformat() if req.date_to else None,
        "generated_by": current_user.email,
    }

    payload: Dict[str, Any] = {}

    if req.type == "compliance_summary":
        # 1. Total observations & status breakdown
        stmt = select(Observation)
        if target_mine_ids:
            stmt = stmt.where(Observation.mine_site_id.in_(target_mine_ids))
        if req.date_from:
            stmt = stmt.where(Observation.created_at >= req.date_from)
        if req.date_to:
            stmt = stmt.where(Observation.created_at <= req.date_to)

        obs_list = (await db.execute(stmt)).scalars().all()
        total_obs = len(obs_list)

        by_status = {}
        for s in ObservationStatus:
            by_status[s.value] = sum(1 for o in obs_list if o.status == s)

        by_cat = {}
        for c in ObservationCategory:
            by_cat[c.value] = sum(1 for o in obs_list if o.category == c)

        resolved_count = by_status.get("closed", 0)
        compliance_pct = round((resolved_count / total_obs) * 100.0, 1) if total_obs > 0 else 100.0

        payload = {
            "summary_title": "Statutory Mine Compliance Overview",
            "total_observations": total_obs,
            "compliance_rate_pct": compliance_pct,
            "status_breakdown": by_status,
            "category_breakdown": by_cat,
        }

    elif req.type == "violations":
        # High and critical hazards + rejected actions
        stmt = select(Observation).where(Observation.edge_score >= 0.70)
        if target_mine_ids:
            stmt = stmt.where(Observation.mine_site_id.in_(target_mine_ids))
        if req.date_from:
            stmt = stmt.where(Observation.created_at >= req.date_from)
        if req.date_to:
            stmt = stmt.where(Observation.created_at <= req.date_to)

        violations = (await db.execute(stmt.order_by(Observation.created_at.desc()))).scalars().all()

        violation_records = []
        for v in violations:
            violation_records.append({
                "observation_id": str(v.id),
                "category": v.category.value,
                "description": v.description,
                "risk_score": v.edge_score,
                "status": v.status.value,
                "created_at": v.created_at.isoformat() if v.created_at else "",
            })

        payload = {
            "summary_title": "DGMS High-Risk Violations Ledger",
            "total_violations": len(violations),
            "records": violation_records,
        }

    elif req.type == "closure_performance":
        # Remediation closure times and rejection rates
        stmt = select(CorrectiveAction)
        if target_mine_ids:
            stmt = stmt.where(CorrectiveAction.mine_site_id.in_(target_mine_ids))
        if req.date_from:
            stmt = stmt.where(CorrectiveAction.created_at >= req.date_from)
        if req.date_to:
            stmt = stmt.where(CorrectiveAction.created_at <= req.date_to)

        actions = (await db.execute(stmt)).scalars().all()
        total_actions = len(actions)
        closed_actions = [a for a in actions if a.status == ActionStatus.CLOSED and a.closed_at and a.created_at]

        avg_hours = 0.0
        if closed_actions:
            total_duration = sum((a.closed_at - a.created_at).total_seconds() for a in closed_actions)
            avg_hours = round((total_duration / len(closed_actions)) / 3600.0, 1)

        rejected_actions = [a for a in actions if a.submission_round > 1 or a.status == ActionStatus.REJECTED]
        rejection_pct = round((len(rejected_actions) / total_actions) * 100.0, 1) if total_actions > 0 else 0.0

        on_time_actions = [a for a in closed_actions if a.deadline and a.closed_at <= a.deadline]
        on_time_pct = round((len(on_time_actions) / len(closed_actions)) * 100.0, 1) if closed_actions else 100.0

        payload = {
            "summary_title": "Contractor Remediation & SLA Performance",
            "total_actions": total_actions,
            "closed_actions_count": len(closed_actions),
            "avg_closure_hours": avg_hours,
            "rejection_rate_pct": rejection_pct,
            "contractor_on_time_pct": on_time_pct,
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_REPORT_TYPE", "message": f"Unsupported report type '{req.type}'.", "detail": f"Unsupported report type '{req.type}'."},
        )

    # Persist report
    report = Report(
        type=req.type,
        scope=scope_meta,
        payload=payload,
        generated_by_id=current_user.id,
        generated_at=now_utc,
    )
    db.add(report)
    await db.flush()

    await append_audit_entry(
        db=db,
        action="REPORT_GENERATED",
        payload={
            "report_id": str(report.id),
            "type": report.type,
            "scope": scope_meta,
        },
        actor_id=current_user.id,
    )

    return report


@router.get("", response_model=List[ReportOut])
async def list_reports(
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REPORT_VIEW)),
):
    """
    GET /reports
    Lists previously generated statutory reports.
    """
    stmt = select(Report)
    if type:
        stmt = stmt.where(Report.type == type)
    stmt = stmt.order_by(Report.generated_at.desc())

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{report_id}", response_model=ReportOut)
async def get_report_detail(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REPORT_VIEW)),
):
    """
    GET /reports/{report_id}
    Retrieves full payload of a statutory report.
    """
    stmt = select(Report).where(Report.id == report_id)
    report = (await db.execute(stmt)).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Report not found.", "detail": "Report not found."})
    return report


@router.get("/{report_id}/export")
async def export_report_csv(
    report_id: uuid.UUID,
    format: str = Query("csv", pattern="^(csv)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REPORT_EXPORT)),
):
    """
    GET /reports/{report_id}/export?format=csv
    Exports report payload to CSV file.
    Audited with REPORT_EXPORTED event.
    """
    stmt = select(Report).where(Report.id == report_id)
    report = (await db.execute(stmt)).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Report not found.", "detail": "Report not found."})

    output = io.StringIO()
    writer = csv.writer(output)

    # Header section
    writer.writerow(["REPORT TYPE", report.type.upper()])
    writer.writerow(["REPORT ID", str(report.id)])
    writer.writerow(["GENERATED AT", report.generated_at.isoformat() if report.generated_at else ""])
    writer.writerow([])

    # Payload section
    payload = report.payload or {}
    if report.type == "violations" and "records" in payload:
        records = payload.get("records", [])
        if records:
            headers = list(records[0].keys())
            writer.writerow(headers)
            for r in records:
                writer.writerow([r.get(h, "") for h in headers])
        else:
            writer.writerow(["No violations recorded in this period."])
    else:
        writer.writerow(["METRIC", "VALUE"])
        for k, v in payload.items():
            if isinstance(v, dict):
                for subk, subv in v.items():
                    writer.writerow([f"{k} -> {subk}", str(subv)])
            else:
                writer.writerow([k, str(v)])

    csv_data = output.getvalue()

    await append_audit_entry(
        db=db,
        action="REPORT_EXPORTED",
        payload={
            "report_id": str(report.id),
            "type": report.type,
            "format": "csv",
            "exported_by": str(current_user.id),
        },
        actor_id=current_user.id,
    )

    filename = f"report-{report.type}-{str(report.id)[:8]}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{report_id}/pdf")
async def export_report_pdf(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REPORT_VIEW)),
):
    """
    GET /reports/{report_id}/pdf
    Generates or streams a formatted statutory PDF report return.
    """
    from pathlib import Path
    from app.config import settings
    from app.services.pdf_generator import generate_compliance_pdf

    stmt = select(Report).where(Report.id == report_id)
    report = (await db.execute(stmt)).scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Report not found.", "detail": "Report not found."},
        )

    # Check if pre-rendered PDF exists on disk
    file_path = report.scope.get("file_path") if report.scope else None
    if file_path and Path(file_path).exists():
        pdf_bytes = Path(file_path).read_bytes()
    else:
        # Generate on the fly
        pdf_bytes = generate_compliance_pdf(
            report_id=str(report.id),
            report_type=report.type,
            scope_meta=report.scope or {},
            payload=report.payload or {},
            generated_at=report.generated_at or datetime.now(timezone.utc),
        )

    await append_audit_entry(
        db=db,
        action="REPORT_EXPORTED_PDF",
        payload={
            "report_id": str(report.id),
            "type": report.type,
            "format": "pdf",
            "exported_by": str(current_user.id),
        },
        actor_id=current_user.id,
    )

    filename = f"statutory-return-{report.type}-{str(report.id)[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Content-Type": "application/pdf",
        },
    )


@router.get("/scheduled/list")
async def list_scheduled_reports(
    mine_site_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REPORT_VIEW)),
):
    """
    GET /reports/scheduled/list
    Lists automated weekly scheduled PDF reports.
    """
    allowed_mine_ids = await visible_mine_ids(db, current_user)
    stmt = select(Report).order_by(Report.generated_at.desc())

    reports = (await db.execute(stmt)).scalars().all()

    scheduled_reports = []
    for r in reports:
        scope = r.scope or {}
        if scope.get("is_scheduled") or scope.get("frequency") == "weekly":
            site_id = scope.get("mine_site_id")
            if mine_site_id and site_id != str(mine_site_id):
                continue
            if allowed_mine_ids is not None and site_id:
                try:
                    if uuid.UUID(site_id) not in allowed_mine_ids:
                        continue
                except ValueError:
                    pass

            scheduled_reports.append(
                {
                    "id": str(r.id),
                    "type": r.type,
                    "mine_name": scope.get("mine_name", "All Mines"),
                    "frequency": scope.get("frequency", "weekly"),
                    "filename": scope.get("filename", f"report-{str(r.id)[:8]}.pdf"),
                    "generated_at": r.generated_at.isoformat() if r.generated_at else None,
                    "download_url": f"/reports/{r.id}/pdf",
                    "date_from": scope.get("date_from"),
                    "date_to": scope.get("date_to"),
                    "compliance_rate_pct": r.payload.get("compliance_rate_pct", 100.0),
                    "total_observations": r.payload.get("total_observations", 0),
                }
            )

    return scheduled_reports


@router.post("/scheduled/trigger")
async def trigger_scheduled_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REPORT_CREATE)),
):
    """
    POST /reports/scheduled/trigger
    Manually triggers a weekly report generation cycle on demand.
    """
    from app.scheduler import generate_weekly_compliance_reports

    count = await generate_weekly_compliance_reports()
    return {"status": "success", "reports_generated": count}
