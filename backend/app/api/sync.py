from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import append_audit_entry
from app.database import get_db
from app.enrichment.service import enrich_observation
from app.models import CorrectiveAction, Inspection, MineSite, Observation, ObservationStatus, RiskFlag, User, UserRole, Zone
from app.schemas.sync import SyncBatchRequest, SyncBatchResponse, SyncPullResponse, SyncStatusResponse
from app.schemas.inspections import InspectionOut
from app.schemas.observation import ObservationOut
from app.schemas.actions import ActionOut
from app.services.auth import get_current_user
from app.services.threshold_evaluator import evaluate_observation_compliance
from app.services.dgms_rules import apply_dgms_safety_floor

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/batch", response_model=SyncBatchResponse, status_code=status.HTTP_201_CREATED)
async def sync_batch(
    req: SyncBatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now_utc = datetime.now(timezone.utc)
    created_ids = []

    for item in req.observations:
        client_ts = item.created_at or now_utc

        site_id = item.mine_site_id
        if not site_id:
            site_id = (await db.execute(select(MineSite.id).limit(1))).scalar()

        zone_id = item.zone_id
        if not zone_id:
            zone_id = (await db.execute(select(Zone.id).where(Zone.mine_site_id == site_id).limit(1))).scalar()

        # Enforce DGMS Critical Safety Floor (roof fall, explosion, gas leak, etc.)
        source, score, flag_str, reasons, manual_reason = apply_dgms_safety_floor(
            description=item.description,
            requested_source=item.risk_score_source,
            requested_score=item.edge_score,
            requested_flag=item.edge_flag,
            requested_reasons=item.edge_reasons,
            manual_reason=item.manual_score_reason,
        )
        edge_flag_enum = RiskFlag(flag_str) if flag_str in ("low", "medium", "high") else None

        obs = Observation(
            created_at=client_ts,
            synced_at=now_utc,
            inspector_id=current_user.id,
            mine_site_id=site_id,
            zone_id=zone_id,
            inspection_id=item.inspection_id,
            category=item.category,
            description=item.description,
            photo_url=item.photo_url,
            has_photo=bool(item.has_photo or item.photo_url),
            gas_reading_value=item.gas_reading_value,
            gas_reading_unit=item.gas_reading_unit,
            lat=item.lat,
            lng=item.lng,
            beacon_id=item.beacon_id,
            edge_score=score,
            edge_flag=edge_flag_enum,
            edge_reasons=reasons,
            risk_score_source=source,
            manual_score_reason=manual_reason,
            status=ObservationStatus.open,
        )

        # Evaluate compliance against statutory thresholds
        await evaluate_observation_compliance(db, obs)

        db.add(obs)
        await db.flush()

        # Run cloud enrichment (Isolation Forest + action map)
        await enrich_observation(obs=obs, db=db)
        await db.flush()

        created_ids.append(obs.id)

        # Audit entry per synced observation
        await append_audit_entry(
            db=db,
            action="observation.synced",
            payload={
                "observation_id": str(obs.id),
                "category": obs.category.value,
                "mine_site_id": str(obs.mine_site_id),
                "edge_score": obs.edge_score,
                "edge_flag": obs.edge_flag.value if obs.edge_flag else None,
                "risk_score_source": obs.risk_score_source,
                "manual_score_reason": obs.manual_score_reason,
                "client_created_at": client_ts.isoformat(),
            },
            actor_id=current_user.id,
        )

    return SyncBatchResponse(
        synced_count=len(created_ids),
        created_ids=created_ids,
        synced_at=now_utc,
    )


@router.get("/status", response_model=SyncStatusResponse)
async def get_sync_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Total count
    stmt_total = select(func.count()).select_from(Observation)
    total = (await db.execute(stmt_total)).scalar_one() or 0

    # Synced count (synced_at is not null)
    stmt_synced = select(func.count()).select_from(Observation).where(Observation.synced_at.is_not(None))
    synced = (await db.execute(stmt_synced)).scalar_one() or 0

    unsynced = total - synced
    sync_pct = round((synced / total) * 100, 2) if total > 0 else 100.0

    return SyncStatusResponse(
        total_observations=total,
        synced_observations=synced,
        unsynced_observations=unsynced,
        sync_rate_pct=sync_pct,
    )


@router.get("/pull", response_model=SyncPullResponse)
async def sync_pull(
    since: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GET /sync/pull?since=<watermark>
    Two-way delta sync endpoint (Phase 29):
    Returns assigned inspections, caller's observations with updated statuses,
    and linked corrective actions since the specified watermark timestamp.
    Watermark advances to the server's current timestamp.
    """
    now_utc = datetime.now(timezone.utc)

    # 1. Assigned Inspections
    insp_stmt = select(Inspection)
    if current_user.role == UserRole.inspector:
        insp_stmt = insp_stmt.where(Inspection.assigned_inspector_id == current_user.id)
    elif current_user.role == UserRole.mine_official and current_user.mine_site_id:
        insp_stmt = insp_stmt.where(Inspection.mine_site_id == current_user.mine_site_id)
    elif current_user.role == UserRole.super_admin:
        pass
    else:
        insp_stmt = insp_stmt.where(Inspection.id == None)

    if since:
        insp_stmt = insp_stmt.where(Inspection.updated_at > since)

    insp_stmt = insp_stmt.order_by(Inspection.updated_at.asc())
    insp_res = await db.execute(insp_stmt)
    inspections = insp_res.scalars().all()

    # 2. Observations
    obs_stmt = select(Observation)
    if current_user.role == UserRole.inspector:
        obs_stmt = obs_stmt.where(Observation.inspector_id == current_user.id)
    elif current_user.role == UserRole.mine_official and current_user.mine_site_id:
        obs_stmt = obs_stmt.where(Observation.mine_site_id == current_user.mine_site_id)
    elif current_user.role == UserRole.super_admin:
        pass
    else:
        obs_stmt = obs_stmt.where(Observation.id == None)

    if since:
        effective_ts = func.coalesce(
            Observation.closed_at,
            Observation.escalated_at,
            Observation.synced_at,
            Observation.created_at,
        )
        obs_stmt = obs_stmt.where(effective_ts > since)

    obs_stmt = obs_stmt.order_by(Observation.created_at.asc())
    obs_res = await db.execute(obs_stmt)
    observations = obs_res.scalars().all()

    # 3. Corrective Actions linked to caller's observations
    action_items = []
    if current_user.role == UserRole.inspector:
        obs_ids_subquery = select(Observation.id).where(Observation.inspector_id == current_user.id)
        action_stmt = select(CorrectiveAction).where(CorrectiveAction.observation_id.in_(obs_ids_subquery))
        if since:
            action_stmt = action_stmt.where(CorrectiveAction.updated_at > since)
        action_stmt = action_stmt.order_by(CorrectiveAction.updated_at.asc())
        action_res = await db.execute(action_stmt)
        action_items = action_res.scalars().all()
    elif current_user.role == UserRole.mine_official and current_user.mine_site_id:
        action_stmt = select(CorrectiveAction).where(CorrectiveAction.mine_site_id == current_user.mine_site_id)
        if since:
            action_stmt = action_stmt.where(CorrectiveAction.updated_at > since)
        action_stmt = action_stmt.order_by(CorrectiveAction.updated_at.asc())
        action_res = await db.execute(action_stmt)
        action_items = action_res.scalars().all()
    elif current_user.role == UserRole.super_admin:
        action_stmt = select(CorrectiveAction)
        if since:
            action_stmt = action_stmt.where(CorrectiveAction.updated_at > since)
        action_stmt = action_stmt.order_by(CorrectiveAction.updated_at.asc())
        action_res = await db.execute(action_stmt)
        action_items = action_res.scalars().all()

    return SyncPullResponse(
        watermark=now_utc,
        inspections=[InspectionOut.model_validate(i) for i in inspections],
        observations=[ObservationOut.model_validate(o) for o in observations],
        actions=[ActionOut.model_validate(a) for a in action_items],
    )
