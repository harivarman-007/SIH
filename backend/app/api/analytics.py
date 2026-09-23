import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import case, cast, Date, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.authz.scope import visible_mine_ids
from app.database import get_db
from app.models import (
    ActionStatus,
    CorrectiveAction,
    MineSite,
    Observation,
    RiskFlag,
    User,
    UserRole,
    Zone,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


class ZoneHotspotItem(BaseModel):
    zone_id: str
    zone_name: str
    mine_site_id: str
    mine_name: str
    count_14d: int
    count_30d: int
    count_90d: int
    total_violations: int
    recent_trend: str  # "rising", "stable", "declining"


class ContractorRankingItem(BaseModel):
    contractor_id: str
    contractor_name: str
    rejected_count_14d: int
    rejected_count_30d: int
    rejected_count_90d: int
    total_assigned: int
    rework_rate_pct: float


class DailyTimeSeriesPoint(BaseModel):
    date: str
    violations_count: int
    high_risk_count: int
    compliant_count: int


class TrendsAnalyticsResponse(BaseModel):
    mine_site_id: Optional[str] = None
    zone_id: Optional[str] = None
    generated_at: str
    zone_hotspots: List[ZoneHotspotItem]
    contractor_rankings: List[ContractorRankingItem]
    time_series: List[DailyTimeSeriesPoint]
    summary: Dict[str, Any]


@router.get("/trends", response_model=TrendsAnalyticsResponse)
async def get_recurring_failure_trends(
    mine_site_id: Optional[uuid.UUID] = Query(None),
    zone_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Item 3: Recurring Failure & Trend Analytics.
    Role-gated endpoint returning:
    - 14/30/90-day rolling counts of high-risk/violation observations per zone and mine site.
    - Repeat-offender contractor rankings (rejected corrective action rework counts).
    - 30-day time-series data for trend visualization.
    """
    # 1. Role gating: only authorized supervisory and statutory roles
    allowed_roles = {
        UserRole.super_admin,
        UserRole.corporate_management,
        UserRole.mine_official,
        UserRole.regulator,
    }
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Trend analytics is restricted to supervisory and regulatory roles.",
        )

    # 2. Scope to authorized mines
    allowed_sites = await visible_mine_ids(db, current_user)
    if mine_site_id and allowed_sites is not None and mine_site_id not in allowed_sites:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this mine site.",
        )

    now_utc = datetime.now(timezone.utc)
    t14 = now_utc - timedelta(days=14)
    t30 = now_utc - timedelta(days=30)
    t90 = now_utc - timedelta(days=90)

    # 3. Zone Hotspots Aggregation (14d, 30d, 90d rolling counts)
    # Filter for high-risk / violation / escalated observations
    is_violation_cond = (
        (Observation.edge_flag == RiskFlag.high)
        | (Observation.cloud_flag == RiskFlag.high)
        | (Observation.compliance_status == "violation")
        | (Observation.status == "escalated")
    )

    hotspot_stmt = (
        select(
            Zone.id.label("zone_id"),
            Zone.name.label("zone_name"),
            MineSite.id.label("mine_site_id"),
            MineSite.name.label("mine_name"),
            func.coalesce(
                func.sum(
                    case((is_violation_cond & (Observation.created_at >= t14), 1), else_=0)
                ),
                0,
            ).label("count_14d"),
            func.coalesce(
                func.sum(
                    case((is_violation_cond & (Observation.created_at >= t30), 1), else_=0)
                ),
                0,
            ).label("count_30d"),
            func.coalesce(
                func.sum(
                    case((is_violation_cond & (Observation.created_at >= t90), 1), else_=0)
                ),
                0,
            ).label("count_90d"),
            func.coalesce(
                func.sum(case((is_violation_cond, 1), else_=0)),
                0,
            ).label("total_violations"),
        )
        .select_from(Zone)
        .join(MineSite, MineSite.id == Zone.mine_site_id)
        .outerjoin(Observation, Observation.zone_id == Zone.id)
    )

    if allowed_sites is not None:
        hotspot_stmt = hotspot_stmt.where(Zone.mine_site_id.in_(allowed_sites))
    if mine_site_id:
        hotspot_stmt = hotspot_stmt.where(Zone.mine_site_id == mine_site_id)
    if zone_id:
        hotspot_stmt = hotspot_stmt.where(Zone.id == zone_id)

    hotspot_stmt = (
        hotspot_stmt.group_by(Zone.id, Zone.name, MineSite.id, MineSite.name)
        .order_by(desc("count_30d"), desc("count_14d"))
    )

    hotspot_rows = (await db.execute(hotspot_stmt)).all()

    zone_hotspots: List[ZoneHotspotItem] = []
    for r in hotspot_rows:
        c14 = int(r.count_14d)
        c30 = int(r.count_30d)
        c90 = int(r.count_90d)
        tot = int(r.total_violations)

        # Trend trajectory estimation
        # If last 14 days represent >60% of last 30 days, trend is rising
        if c14 > 0 and (c30 == 0 or (c14 / max(c30, 1)) > 0.55):
            recent_trend = "rising"
        elif c14 == 0 and c30 > 0:
            recent_trend = "declining"
        else:
            recent_trend = "stable"

        zone_hotspots.append(
            ZoneHotspotItem(
                zone_id=str(r.zone_id),
                zone_name=r.zone_name,
                mine_site_id=str(r.mine_site_id),
                mine_name=r.mine_name,
                count_14d=c14,
                count_30d=c30,
                count_90d=c90,
                total_violations=tot,
                recent_trend=recent_trend,
            )
        )

    # 4. Contractor Repeat-Offender Rankings (Count of REJECTED corrective actions)
    is_rejected_cond = (
        (CorrectiveAction.status == ActionStatus.REJECTED)
        | (CorrectiveAction.status == ActionStatus.rejected)
        | (CorrectiveAction.rejection_reason.is_not(None))
    )

    contractor_stmt = (
        select(
            User.id.label("contractor_id"),
            User.full_name.label("contractor_name"),
            func.coalesce(
                func.sum(
                    case((is_rejected_cond & (CorrectiveAction.created_at >= t14), 1), else_=0)
                ),
                0,
            ).label("rejected_14d"),
            func.coalesce(
                func.sum(
                    case((is_rejected_cond & (CorrectiveAction.created_at >= t30), 1), else_=0)
                ),
                0,
            ).label("rejected_30d"),
            func.coalesce(
                func.sum(
                    case((is_rejected_cond & (CorrectiveAction.created_at >= t90), 1), else_=0)
                ),
                0,
            ).label("rejected_90d"),
            func.count(CorrectiveAction.id).label("total_assigned"),
        )
        .select_from(CorrectiveAction)
        .join(User, User.id == CorrectiveAction.contractor_id)
    )

    if allowed_sites is not None:
        contractor_stmt = contractor_stmt.where(CorrectiveAction.mine_site_id.in_(allowed_sites))
    if mine_site_id:
        contractor_stmt = contractor_stmt.where(CorrectiveAction.mine_site_id == mine_site_id)

    contractor_stmt = (
        contractor_stmt.group_by(User.id, User.full_name)
        .order_by(desc("rejected_30d"), desc("rejected_90d"))
    )

    contractor_rows = (await db.execute(contractor_stmt)).all()

    contractor_rankings: List[ContractorRankingItem] = []
    for cr in contractor_rows:
        tot_assigned = int(cr.total_assigned)
        rej_90 = int(cr.rejected_90d)
        rework_pct = round((rej_90 / tot_assigned) * 100, 1) if tot_assigned > 0 else 0.0

        contractor_rankings.append(
            ContractorRankingItem(
                contractor_id=str(cr.contractor_id),
                contractor_name=cr.contractor_name,
                rejected_count_14d=int(cr.rejected_14d),
                rejected_count_30d=int(cr.rejected_30d),
                rejected_count_90d=rej_90,
                total_assigned=tot_assigned,
                rework_rate_pct=rework_pct,
            )
        )

    # 5. Daily Time-Series (Last 30 days)
    ts_stmt = (
        select(
            cast(Observation.created_at, Date).label("obs_date"),
            func.sum(case((is_violation_cond, 1), else_=0)).label("violations_count"),
            func.sum(
                case(
                    ((Observation.edge_flag == RiskFlag.high) | (Observation.cloud_flag == RiskFlag.high), 1),
                    else_=0,
                )
            ).label("high_risk_count"),
            func.sum(
                case(
                    (Observation.compliance_status == "compliant", 1),
                    else_=0,
                )
            ).label("compliant_count"),
        )
        .where(Observation.created_at >= t30)
    )

    if allowed_sites is not None:
        ts_stmt = ts_stmt.where(Observation.mine_site_id.in_(allowed_sites))
    if mine_site_id:
        ts_stmt = ts_stmt.where(Observation.mine_site_id == mine_site_id)
    if zone_id:
        ts_stmt = ts_stmt.where(Observation.zone_id == zone_id)

    ts_stmt = ts_stmt.group_by(cast(Observation.created_at, Date)).order_by("obs_date")

    ts_rows = (await db.execute(ts_stmt)).all()
    time_series = [
        DailyTimeSeriesPoint(
            date=str(row.obs_date),
            violations_count=int(row.violations_count or 0),
            high_risk_count=int(row.high_risk_count or 0),
            compliant_count=int(row.compliant_count or 0),
        )
        for row in ts_rows
    ]

    # Overall Summary
    total_active_hotspots = sum(1 for z in zone_hotspots if z.count_30d > 0)
    total_rising_zones = sum(1 for z in zone_hotspots if z.recent_trend == "rising")
    total_30d_violations = sum(z.count_30d for z in zone_hotspots)

    summary_data = {
        "active_hotspots": total_active_hotspots,
        "rising_zones": total_rising_zones,
        "total_30d_violations": total_30d_violations,
        "contractors_evaluated": len(contractor_rankings),
    }

    return TrendsAnalyticsResponse(
        mine_site_id=str(mine_site_id) if mine_site_id else None,
        zone_id=str(zone_id) if zone_id else None,
        generated_at=now_utc.isoformat(),
        zone_hotspots=zone_hotspots,
        contractor_rankings=contractor_rankings,
        time_series=time_series,
        summary=summary_data,
    )
