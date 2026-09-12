"""
service.py
Async enrichment orchestrator.

Called after an Observation is flushed to the DB (but before commit) or
as a background task post-commit. Runs the cloud engine and action map,
then writes results back to the Observation row.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enrichment.engine import get_cloud_engine, extract_cloud_features
from app.enrichment.action_map import get_suggested_action
from app.models import Observation, RiskFlag, Zone, MineSite, User

log = logging.getLogger(__name__)


async def _fetch_context(
    obs: Observation,
    db: AsyncSession,
) -> dict:
    """
    Queries DB for zone/site/inspector context used as extra features.
    Returns a dict of keyword args accepted by extract_cloud_features.
    """
    context: dict = {}

    # Zone risk baseline
    if obs.zone_id:
        zone_row = await db.get(Zone, obs.zone_id)
        if zone_row:
            context["zone_risk_baseline"] = float(zone_row.risk_baseline)

    # Inspector historical high-risk rate
    if obs.inspector_id:
        # Count of high-flag observations by this inspector / total observations
        stmt_total = select(func.count()).where(
            Observation.inspector_id == obs.inspector_id
        )
        stmt_high = select(func.count()).where(
            Observation.inspector_id == obs.inspector_id,
            Observation.edge_flag == RiskFlag.high,
        )
        total = (await db.execute(stmt_total)).scalar_one() or 1
        high  = (await db.execute(stmt_high)).scalar_one()  or 0
        context["inspector_high_rate"] = round(min(1.0, high / total), 4)

    # Days since last inspection in the same zone
    if obs.zone_id:
        stmt_last = (
            select(Observation.created_at)
            .where(
                Observation.zone_id == obs.zone_id,
                Observation.id != obs.id,
            )
            .order_by(Observation.created_at.desc())
            .limit(1)
        )
        last_row = (await db.execute(stmt_last)).scalar_one_or_none()
        if last_row:
            delta = (datetime.now(timezone.utc) - last_row.replace(tzinfo=timezone.utc)).days
            context["days_since_inspection"] = float(min(delta, 30))
        else:
            context["days_since_inspection"] = 7.0

    # Site-level average high-risk rate
    if obs.mine_site_id:
        stmt_site_total = select(func.count()).where(
            Observation.mine_site_id == obs.mine_site_id
        )
        stmt_site_high  = select(func.count()).where(
            Observation.mine_site_id == obs.mine_site_id,
            Observation.edge_flag == RiskFlag.high,
        )
        site_total = (await db.execute(stmt_site_total)).scalar_one() or 1
        site_high  = (await db.execute(stmt_site_high)).scalar_one()  or 0
        context["site_avg_high_rate"] = round(min(1.0, site_high / site_total), 4)

    # Open high-risk count in this zone (unresolved observations)
    if obs.zone_id:
        from app.models import ObservationStatus
        stmt_open = select(func.count()).where(
            Observation.zone_id == obs.zone_id,
            Observation.edge_flag == RiskFlag.high,
            Observation.status == ObservationStatus.open,
            Observation.id != obs.id,
        )
        context["zone_open_high_risk_count"] = (
            (await db.execute(stmt_open)).scalar_one() or 0
        )

    return context


async def enrich_observation(obs: Observation, db: AsyncSession) -> None:
    """
    Runs cloud enrichment on a single Observation and writes results back.
    Must be called BEFORE the surrounding transaction commits so changes
    are captured in the same flush.
    """
    try:
        engine = get_cloud_engine()
        context = await _fetch_context(obs, db)

        obs_dict = {
            "category":    obs.category.value,
            "description": obs.description,
            "created_at":  obs.created_at,
            "has_photo":   obs.has_photo,
            "photo_url":   obs.photo_url,
        }

        result = engine.score(
            obs_dict,
            zone_risk_baseline=context.get("zone_risk_baseline", 0.4),
            inspector_high_rate=context.get("inspector_high_rate", 0.25),
            days_since_inspection=context.get("days_since_inspection", 7.0),
            site_avg_high_rate=context.get("site_avg_high_rate", 0.20),
            zone_open_high_risk_count=context.get("zone_open_high_risk_count", 0),
        )

        cloud_flag_str: str = result["cloud_flag"]
        suggested_action   = get_suggested_action(obs_dict["category"], cloud_flag_str)

        # Write enrichment results back to the observation
        obs.cloud_score      = result["cloud_score"]
        obs.cloud_flag       = RiskFlag(cloud_flag_str)
        obs.cloud_reasons    = result["cloud_reasons"]
        obs.suggested_action = suggested_action
        obs.enriched_at      = datetime.now(timezone.utc)

        log.info(
            "Enriched obs %s → cloud_score=%.3f flag=%s action_len=%d",
            obs.id,
            obs.cloud_score,
            obs.cloud_flag.value,
            len(suggested_action),
        )

    except Exception as exc:
        # Enrichment must never crash the sync endpoint
        log.error("Enrichment failed for obs %s: %s", obs.id, exc, exc_info=True)
