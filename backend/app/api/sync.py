from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import append_audit_entry
from app.database import get_db
from app.enrichment.service import enrich_observation
from app.models import Observation, ObservationStatus, User
from app.schemas.sync import SyncBatchRequest, SyncBatchResponse, SyncStatusResponse
from app.services.auth import get_current_user

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
        obs = Observation(
            created_at=client_ts,
            synced_at=now_utc,
            inspector_id=current_user.id,
            mine_site_id=item.mine_site_id,
            zone_id=item.zone_id,
            category=item.category,
            description=item.description,
            photo_url=item.photo_url,
            has_photo=bool(item.has_photo or item.photo_url),
            lat=item.lat,
            lng=item.lng,
            beacon_id=item.beacon_id,
            edge_score=item.edge_score,
            edge_flag=item.edge_flag,
            edge_reasons=item.edge_reasons,
            status=ObservationStatus.open,
        )
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
