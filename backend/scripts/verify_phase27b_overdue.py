"""verify_phase27b_overdue.py

Phase 27b Item 2: Behavioral test for overdue actions.
- Seed an action past its deadline in a mine with a manager, corporate user, and contractor
- Run the scanner (_escalate_and_alert)
- Assert alert rows exist for mine manager AND corporate with [ACTION_OVERDUE]
- Assert running it twice does not duplicate alerts
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

PASS = "PASS"
FAIL = "FAIL"
results = []


def check(name: str, condition: bool, detail: str = ""):
    status_str = PASS if condition else FAIL
    results.append((status_str, name, detail))
    formatted = f"[{status_str}] {name}"
    if detail:
        formatted += f" — {detail}"
    print(formatted)


async def main():
    print("=" * 60)
    print("Phase 27b: Overdue Actions Scanner & Deduplication Behavioral Test")
    print("=" * 60)

    from app.database import AsyncSessionLocal
    from app.models import (
        ActionPriority,
        ActionStatus,
        Alert,
        CorrectiveAction,
        MineSite,
        Observation,
        ObservationCategory,
        ObservationStatus,
        RiskFlag,
        User,
        UserRole,
        Zone,
    )
    from app.scheduler import _escalate_and_alert
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        try:
            # 1. Setup MineSite and Users
            site = MineSite(
                name=f"Overdue Colliery {uuid.uuid4().hex[:6]}",
                location_name="Overdue Zone",
                lat=23.75,
                lng=86.40,
            )
            db.add(site)
            await db.flush()

            zone = Zone(mine_site_id=site.id, name="Overdue Zone 1", zone_type="surface")
            db.add(zone)
            await db.flush()

            # Inspector
            insp = User(
                email=f"insp_od_{uuid.uuid4().hex[:6]}@mine.internal",
                full_name="Inspector Overdue",
                role=UserRole.inspector,
                mine_site_id=site.id,
                is_active=True,
                password_hash="mock",
            )
            # Mine Manager
            mgr = User(
                email=f"mgr_od_{uuid.uuid4().hex[:6]}@mine.internal",
                full_name="Mine Manager Overdue",
                role=UserRole.mine_official,
                mine_site_id=site.id,
                is_active=True,
                password_hash="mock",
            )
            # Corporate User
            corp = User(
                email=f"corp_od_{uuid.uuid4().hex[:6]}@corp.internal",
                full_name="Corporate HQ User",
                role=UserRole.corporate_management,
                mine_site_id=None,
                is_active=True,
                password_hash="mock",
            )
            # Contractor
            con = User(
                email=f"con_od_{uuid.uuid4().hex[:6]}@contractor.internal",
                full_name="Contractor Overdue",
                role=UserRole.contractor,
                mine_site_id=site.id,
                is_active=True,
                password_hash="mock",
            )
            db.add_all([insp, mgr, corp, con])
            await db.flush()

            # Seed parent observation
            obs = Observation(
                mine_site_id=site.id,
                zone_id=zone.id,
                inspector_id=insp.id,
                category=ObservationCategory.safety,
                description="Overdue testing parent observation",
                status=ObservationStatus.action_required,
                edge_flag=RiskFlag.high,
                cloud_flag=RiskFlag.high,
                created_at=datetime.now(timezone.utc) - timedelta(days=5),
            )
            db.add(obs)
            await db.flush()

            # Seed past-deadline CorrectiveAction (due 2 days ago)
            past_due = datetime.now(timezone.utc) - timedelta(days=2)
            action = CorrectiveAction(
                code=f"ACT-OD-{uuid.uuid4().hex[:4].upper()}",
                observation_id=obs.id,
                mine_site_id=site.id,
                assigned_by_user_id=mgr.id,
                assigned_to_user_id=con.id,
                title="Replace frayed cable (Overdue Test)",
                description="Statutory overdue remediation test",
                priority=ActionPriority.high,
                status=ActionStatus.in_progress,
                due_at=past_due,
                submission_round=1,
            )
            db.add(action)
            await db.commit()
            await db.refresh(action)

            check("1. Seeded action past its deadline", action.due_at < datetime.now(timezone.utc))

            # 2. Run Scanner (Run #1)
            await _escalate_and_alert(db)

            # Query alerts for this action
            alert_stmt = select(Alert).where(
                Alert.action_id == action.id,
                Alert.message.like("%[ACTION_OVERDUE]%"),
            )
            alerts_run1 = (await db.execute(alert_stmt)).scalars().all()
            roles_alerted = {a.recipient_role for a in alerts_run1}

            check("2a. Scanner generated alerts for overdue action", len(alerts_run1) >= 2, f"Total alerts: {len(alerts_run1)}")
            check("2b. Alert row exists for mine manager", "mine_official" in roles_alerted)
            check("2c. Alert row exists for corporate management", "corporate_management" in roles_alerted)
            check("2d. Alert message contains [ACTION_OVERDUE]", all("[ACTION_OVERDUE]" in a.message for a in alerts_run1))

            count_after_run1 = len(alerts_run1)

            # 3. Run Scanner a SECOND time (Deduplication assertion)
            await _escalate_and_alert(db)

            alerts_run2 = (await db.execute(alert_stmt)).scalars().all()
            count_after_run2 = len(alerts_run2)

            check(
                "3. Scanner idempotency: Running twice does NOT duplicate alerts",
                count_after_run2 == count_after_run1,
                f"Run 1 count={count_after_run1}, Run 2 count={count_after_run2}",
            )

        except Exception as e:
            check("Overdue Scanner Behavioral Test", False, str(e))

    print("\n" + "=" * 60)
    failed = [r for r in results if r[0] == FAIL]
    passed = [r for r in results if r[0] == PASS]
    print(f"Results: {len(passed)} PASSED, {len(failed)} FAILED")
    print("=" * 60)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
