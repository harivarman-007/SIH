from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Observation, ObservationCategory, ObservationStatus, RiskFlag, User, UserRole
from app.schemas.kpi import KPISummaryResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/kpi", tags=["kpi"])


@router.get("/", response_model=KPISummaryResponse)
async def get_kpis(
    mine_site_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Observation)
    # Role-based restriction
    if current_user.role == UserRole.inspector:
        stmt = stmt.where(Observation.inspector_id == current_user.id)
    elif current_user.role in (UserRole.mine_official, UserRole.contractor):
        if current_user.mine_site_id:
            stmt = stmt.where(Observation.mine_site_id == current_user.mine_site_id)
        elif mine_site_id:
            stmt = stmt.where(Observation.mine_site_id == mine_site_id)
    elif current_user.role == UserRole.regulator and mine_site_id:
        stmt = stmt.where(Observation.mine_site_id == mine_site_id)

    result = await db.execute(stmt)
    observations = result.scalars().all()

    total = len(observations)
    if total == 0:
        return KPISummaryResponse(
            total_observations=0,
            open_count=0,
            in_progress_count=0,
            closed_count=0,
            escalated_count=0,
            open_high_risk_count=0,
            avg_time_to_closure_hours=None,
            sync_rate_pct=100.0,
            by_category={"safety": 0, "environment": 0, "labour": 0},
            by_risk={"low": 0, "medium": 0, "high": 0},
        )

    open_c = 0
    in_prog_c = 0
    closed_c = 0
    escalated_c = 0
    open_high_risk = 0
    synced_c = 0
    closure_durations = []

    by_cat = {"safety": 0, "environment": 0, "labour": 0}
    by_risk = {"low": 0, "medium": 0, "high": 0}

    for obs in observations:
        # Category
        cat_key = obs.category.value if obs.category else "safety"
        by_cat[cat_key] = by_cat.get(cat_key, 0) + 1

        # Effective Risk (cloud or edge)
        eff_risk = obs.cloud_flag or obs.edge_flag
        risk_key = eff_risk.value if eff_risk else "low"
        by_risk[risk_key] = by_risk.get(risk_key, 0) + 1

        # Synced
        if obs.synced_at is not None:
            synced_c += 1

        # Status counts
        if obs.status == ObservationStatus.open:
            open_c += 1
            if risk_key == "high":
                open_high_risk += 1
        elif obs.status == ObservationStatus.in_progress:
            in_prog_c += 1
            if risk_key == "high":
                open_high_risk += 1
        elif obs.status == ObservationStatus.escalated:
            escalated_c += 1
            if risk_key == "high":
                open_high_risk += 1
        elif obs.status == ObservationStatus.closed:
            closed_c += 1
            if obs.closed_at and obs.created_at:
                diff_seconds = (obs.closed_at - obs.created_at).total_seconds()
                if diff_seconds >= 0:
                    closure_durations.append(diff_seconds / 3600.0)

    avg_closure_hours = None
    if closure_durations:
        avg_closure_hours = round(sum(closure_durations) / len(closure_durations), 2)

    sync_pct = round((synced_c / total) * 100, 2)

    return KPISummaryResponse(
        total_observations=total,
        open_count=open_c,
        in_progress_count=in_prog_c,
        closed_count=closed_c,
        escalated_count=escalated_c,
        open_high_risk_count=open_high_risk,
        avg_time_to_closure_hours=avg_closure_hours,
        sync_rate_pct=sync_pct,
        by_category=by_cat,
        by_risk=by_risk,
    )
