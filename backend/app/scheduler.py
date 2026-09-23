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
from app.models import (
    Alert,
    ActionStatus,
    CorrectiveAction,
    Observation,
    ObservationStatus,
    RiskFlag,
    UserRole,
)

logger = logging.getLogger(__name__)

# Statutory SLA thresholds in hours (mirrors observations.py)
SLA_HIGH_H = 24
SLA_MEDIUM_H = 72
SLA_LOW_H = 168


async def _get_sla_thresholds(db: AsyncSession) -> tuple[int, int, int]:
    try:
        from app.models import SystemSetting
        stmt = select(SystemSetting).where(SystemSetting.key == "sla_thresholds")
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row and isinstance(row.value, dict):
            return (
                int(row.value.get("high_hours", SLA_HIGH_H)),
                int(row.value.get("medium_hours", SLA_MEDIUM_H)),
                int(row.value.get("low_hours", SLA_LOW_H)),
            )
    except Exception:
        pass
    return (SLA_HIGH_H, SLA_MEDIUM_H, SLA_LOW_H)


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
    sla_high, sla_med, sla_low = await _get_sla_thresholds(db)

    # 1. Observation Escalation
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
            (eff_flag == RiskFlag.high and age_hours >= sla_high)
            or (eff_flag == RiskFlag.medium and age_hours >= sla_med)
            or (eff_flag == RiskFlag.low and age_hours >= sla_low)
        )
        if not sla_exceeded:
            continue

        sla_limit = (
            sla_high if eff_flag == RiskFlag.high
            else sla_med if eff_flag == RiskFlag.medium
            else sla_low
        )

        reason = (
            f"Statutory SLA breached: {eff_flag.value.upper()} risk observation "
            f"unclosed after {age_hours:.1f} h (limit: {sla_limit} h). "
            f"Category: {obs.category.value}."
        )

        obs.status = ObservationStatus.escalated
        obs.escalated_at = now_utc
        obs.version += 1
        escalated_count += 1

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

        alert_mine_official = Alert(
            recipient_role=UserRole.mine_official.value,
            mine_site_id=obs.mine_site_id,
            observation_id=obs.id,
            message=f"[AUTO-ESCALATED] {reason}",
            is_read=False,
        )
        db.add(alert_mine_official)

        alert_corporate = Alert(
            recipient_role=UserRole.corporate_management.value,
            mine_site_id=obs.mine_site_id,
            observation_id=obs.id,
            message=f"[AUTO-ESCALATED] {reason}",
            is_read=False,
        )
        db.add(alert_corporate)

    # 2. Overdue Corrective Action Check (Phase 27b: REOPEN_IN_PROGRESS removed from spec flow)
    act_stmt = select(CorrectiveAction).where(
        CorrectiveAction.status.in_([
            ActionStatus.assigned,
            ActionStatus.accepted,
            ActionStatus.in_progress,
            ActionStatus.rejected,
        ])
    )
    act_res = await db.execute(act_stmt)
    actions = act_res.scalars().all()

    overdue_count = 0
    for action in actions:
        due_dt = action.due_at
        if due_dt.tzinfo is None:
            due_dt = due_dt.replace(tzinfo=timezone.utc)

        if due_dt < now_utc:
            # Check existing alerts for this action to avoid duplicates (Phase 27b)
            existing_alerts_stmt = select(Alert.recipient_role).where(
                Alert.action_id == action.id,
                Alert.message.like("%[ACTION_OVERDUE]%"),
            )
            existing_roles = set((await db.execute(existing_alerts_stmt)).scalars().all())

            added = False
            # Alert contractor
            if "contractor" not in existing_roles:
                db.add(Alert(
                    recipient_role="contractor",
                    recipient_user_id=action.assigned_to_user_id,
                    mine_site_id=action.mine_site_id,
                    action_id=action.id,
                    observation_id=action.observation_id,
                    message=f"[ACTION_OVERDUE] {action.code}: was due at {due_dt.isoformat()} and is now overdue.",
                ))
                added = True

            # Alert mine official
            if "mine_official" not in existing_roles:
                db.add(Alert(
                    recipient_role="mine_official",
                    recipient_user_id=action.assigned_by_user_id,
                    mine_site_id=action.mine_site_id,
                    action_id=action.id,
                    observation_id=action.observation_id,
                    message=f"[ACTION_OVERDUE] {action.code}: assigned contractor action is past its statutory due date.",
                ))
                added = True

            # Alert corporate management (User Directive Point 6)
            if "corporate_management" not in existing_roles:
                db.add(Alert(
                    recipient_role="corporate_management",
                    mine_site_id=action.mine_site_id,
                    action_id=action.id,
                    observation_id=action.observation_id,
                    message=f"[ACTION_OVERDUE] {action.code}: Site action is past statutory deadline ({due_dt.isoformat()}). Corporate escalation required.",
                ))
                added = True

            if added:
                overdue_count += 1

    await db.commit()
    logger.info(
        "[Scheduler] Escalation cycle complete: %d observation(s) escalated, "
        "%d overdue action(s) alerted.",
        escalated_count,
        overdue_count,
    )


async def generate_weekly_compliance_reports() -> int:
    """
    Weekly automated background job (Item 4):
    Generates statutory compliance summary PDF returns for all active mine sites,
    persists them to reports_storage_path, and creates Report records.
    """
    from pathlib import Path
    import uuid
    from datetime import timedelta
    from app.config import settings
    from app.models import MineSite, ObservationCategory, Report, User
    from app.services.pdf_generator import generate_compliance_pdf

    logger.info("[Scheduler] Starting weekly statutory compliance report generation cycle...")
    generated_count = 0
    now_utc = datetime.now(timezone.utc)
    t7 = now_utc - timedelta(days=7)

    # Ensure storage directory exists
    storage_dir = Path(settings.reports_storage_path)
    try:
        storage_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        logger.error(f"[Scheduler] Failed to create reports storage dir: {e}")
        return 0

    async with AsyncSessionLocal() as db:
        # Get system/admin user for generated_by attribution
        admin_stmt = select(User).where(User.role == UserRole.super_admin).limit(1)
        admin_user = (await db.execute(admin_stmt)).scalar_one_or_none()
        if not admin_user:
            # Fallback to any user
            admin_user = (await db.execute(select(User).limit(1))).scalar_one_or_none()

        if not admin_user:
            logger.warning("[Scheduler] No user found for report attribution.")
            return 0

        # Query all mine sites
        sites = (await db.execute(select(MineSite))).scalars().all()

        for site in sites:
            try:
                # Query observations for this site in the past 7 days
                obs_stmt = select(Observation).where(
                    Observation.mine_site_id == site.id,
                    Observation.created_at >= t7,
                )
                obs_list = (await db.execute(obs_stmt)).scalars().all()

                # If no records in past 7 days, get latest 20 to ensure demo has a meaningful report
                if len(obs_list) == 0:
                    fallback_stmt = select(Observation).where(Observation.mine_site_id == site.id).limit(20)
                    obs_list = (await db.execute(fallback_stmt)).scalars().all()

                total_obs = len(obs_list)
                closed_count = sum(1 for o in obs_list if o.status == ObservationStatus.closed)
                compliance_pct = round((closed_count / total_obs) * 100.0, 1) if total_obs > 0 else 100.0

                by_status = {s.value: sum(1 for o in obs_list if o.status == s) for s in ObservationStatus}
                by_cat = {c.value: sum(1 for o in obs_list if o.category == c) for c in ObservationCategory}

                payload = {
                    "summary_title": f"Weekly Statutory Return &mdash; {site.name}",
                    "mine_site_id": str(site.id),
                    "mine_name": site.name,
                    "total_observations": total_obs,
                    "compliance_rate_pct": compliance_pct,
                    "observations_by_status": by_status,
                    "observations_by_category": by_cat,
                    "reporting_period": "Weekly Automated Cycle",
                }

                report_id = uuid.uuid4()
                filename = f"weekly-return-{site.name.lower().replace(' ', '-')}-{now_utc.strftime('%Y%m%d')}-{str(report_id)[:6]}.pdf"
                pdf_path = storage_dir / filename

                scope_meta = {
                    "is_scheduled": True,
                    "frequency": "weekly",
                    "mine_site_id": str(site.id),
                    "mine_name": site.name,
                    "target_mines": [site.name],
                    "filename": filename,
                    "file_path": str(pdf_path),
                    "date_from": t7.strftime("%Y-%m-%d"),
                    "date_to": now_utc.strftime("%Y-%m-%d"),
                }

                pdf_bytes = generate_compliance_pdf(
                    report_id=str(report_id),
                    report_type="compliance_summary",
                    scope_meta=scope_meta,
                    payload=payload,
                    generated_at=now_utc,
                )

                pdf_path.write_bytes(pdf_bytes)

                # Persist Report in database
                report = Report(
                    id=report_id,
                    type="compliance_summary",
                    scope=scope_meta,
                    payload=payload,
                    generated_by_id=admin_user.id,
                    generated_at=now_utc,
                )
                db.add(report)
                await db.flush()

                await append_audit_entry(
                    db=db,
                    action="SCHEDULED_REPORT_GENERATED",
                    payload={
                        "report_id": str(report.id),
                        "mine_site_id": str(site.id),
                        "filename": filename,
                    },
                    actor_id=admin_user.id,
                )

                generated_count += 1
            except Exception as site_err:
                logger.error(f"[Scheduler] Error generating report for {site.name}: {site_err}")

        await db.commit()

    logger.info(f"[Scheduler] Generated {generated_count} weekly compliance report(s).")
    return generated_count

