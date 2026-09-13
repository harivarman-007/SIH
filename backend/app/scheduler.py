"""
scheduler.py
Background job: auto-escalation + alert generation.

Runs every 5 minutes via APScheduler (launched from main.py lifespan).
For each observation that exceeds its statutory SLA:
  1. Transitions status to 'escalated'
  2. Creates Alert records for mine_official at that mine_site
  3. Creates Alert records for corporate_management at that mine_site
  4. Appends an immutable audit log entry

SLA thresholds (matching the manual /observations/escalate-overdue endpoint):
  High risk:   >= 24 hours
  Medium risk: >= 72 hours
  Low risk:    >= 168 hours
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import append_audit_entry
from app.database import AsyncSessionLocal
from app.models import Alert, Observation, ObservationStatus, RiskFlag, UserRole

logger = logging.getLogger(__name__)

# Statutory SLA thresholds in hours (mirrors observations.py)
SLA_HIGH_H = 24
SLA_MEDIUM_H = 72
SLA_LOW_H = 168


async def run_escalation_and_alert() -> None:
    """
    Async job executed by APScheduler every 5 minutes.
    Opens its own DB session (independent of HTTP request sessions).
    """
    logger.info("[Scheduler] Running auto-escalation cycle…")
    try:
        async with AsyncSessionLocal() as db:
            await _escalate_and_alert(db)
    except Exception as exc:
        logger.exception("[Scheduler] Unhandled error in escalation cycle: %s", exc)


async def _escalate_and_alert(db: AsyncSession) -> None:
    now_utc = datetime.now(timezone.utc)

    # Fetch all open / in_progress observations
    stmt = select(Observation).where(
        Observation.status.in_([ObservationStatus.open, ObservationStatus.in_progress])
    )
    result = await db.execute(stmt)
    candidates = result.scalars().all()

    escalated_count = 0
    for obs in candidates:
        eff_flag = obs.cloud_flag or obs.edge_flag or RiskFlag.low
        obs_dt = obs.created_at
        if obs_dt.tzinfo is None:
            obs_dt = obs_dt.replace(tzinfo=timezone.utc)

        age_hours = (now_utc - obs_dt).total_seconds() / 3600.0

        sla_exceeded = (
            (eff_flag == RiskFlag.high and age_hours >= SLA_HIGH_H)
            or (eff_flag == RiskFlag.medium and age_hours >= SLA_MEDIUM_H)
            or (eff_flag == RiskFlag.low and age_hours >= SLA_LOW_H)
        )
        if not sla_exceeded:
            continue

        sla_limit = (
            SLA_HIGH_H if eff_flag == RiskFlag.high
            else SLA_MEDIUM_H if eff_flag == RiskFlag.medium
            else SLA_LOW_H
        )
        reason = (
            f"Statutory SLA breached: {eff_flag.value.upper()} risk observation "
            f"unclosed after {age_hours:.1f} h (limit: {sla_limit} h). "
            f"Category: {obs.category.value}."
        )

        # 1. Transition to escalated
        obs.status = ObservationStatus.escalated
        obs.escalated_at = now_utc
        obs.version += 1
        escalated_count += 1

        # 2. Audit entry (actor_id=None → system action)
        await append_audit_entry(
            db=db,
            action="observation.auto_escalated_scheduler",
            payload={
                "observation_id": str(obs.id),
                "mine_site_id": str(obs.mine_site_id),
                "risk_flag": eff_flag.value,
                "age_hours": round(age_hours, 2),
                "sla_threshold_hours": sla_limit,
                "reason": reason,
                "escalated_at": now_utc.isoformat(),
            },
            actor_id=None,
        )

        # 3. Create Alert for mine_official at this mine site
        alert_mine_official = Alert(
            recipient_role=UserRole.mine_official.value,
            mine_site_id=obs.mine_site_id,
            observation_id=obs.id,
            message=f"[AUTO-ESCALATED] {reason}",
            is_read=False,
        )
        db.add(alert_mine_official)

        # 4. Create Alert for corporate_management (no site restriction — they
        #    filter by their access list in the query layer)
        alert_corporate = Alert(
            recipient_role=UserRole.corporate_management.value,
            mine_site_id=obs.mine_site_id,
            observation_id=obs.id,
            message=f"[AUTO-ESCALATED] {reason}",
            is_read=False,
        )
        db.add(alert_corporate)

    await db.commit()
    logger.info(
        "[Scheduler] Auto-escalation cycle complete: %d observation(s) escalated, "
        "%d alert(s) created.",
        escalated_count,
        escalated_count * 2,
    )
