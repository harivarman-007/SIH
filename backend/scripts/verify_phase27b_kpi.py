"""verify_phase27b_kpi.py

Phase 27b Item 3: KPI test with known values.
- Seed a dedicated test mine site
- Seed closed observations with known created/closed timestamps (4h, 6h -> avg 5.0h)
- Seed 4 actions:
    1. On-time action (submitted <= due)
    2. Rejected once (submission_round=2, rejection_reason set)
    3. Submitted late (submitted > due)
    4. On-time action (submitted <= due)
- Assert per-mine exact values:
    avg_time_to_closure_hours == 5.0
    rejection_rate_pct == 25.0%
    contractor_on_time_pct == 75.0%
- Confirm KPI is available per-mine and fleet-wide (in /kpi/summary and /kpi/cross-mine-summary)
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
    print("Phase 27b: KPI Test with Known Ground-Truth Values")
    print("=" * 60)

    from app.database import AsyncSessionLocal
    from app.models import (
        ActionPriority,
        ActionStatus,
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
    from app.api.kpi import get_kpis, get_cross_mine_summary
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        try:
            # 1. Dedicated test mine site to isolate per-mine metrics
            site = MineSite(
                name=f"KPI Known Site {uuid.uuid4().hex[:6]}",
                location_name="Benchmark Zone",
                lat=22.50,
                lng=85.30,
            )
            db.add(site)
            await db.flush()

            zone = Zone(mine_site_id=site.id, name="KPI Benchmark Zone 1", zone_type="underground")
            db.add(zone)
            await db.flush()

            # Inspector
            inspector = User(
                email=f"kpi_insp_{uuid.uuid4().hex[:6]}@mine.internal",
                full_name="KPI Inspector",
                role=UserRole.inspector,
                mine_site_id=site.id,
                is_active=True,
                password_hash="mock",
            )
            # Mine Official
            official = User(
                email=f"kpi_official_{uuid.uuid4().hex[:6]}@mine.internal",
                full_name="KPI Official",
                role=UserRole.mine_official,
                mine_site_id=site.id,
                is_active=True,
                password_hash="mock",
            )
            # Corporate user
            corporate = User(
                email=f"kpi_corp_{uuid.uuid4().hex[:6]}@mine.internal",
                full_name="KPI Corporate",
                role=UserRole.corporate_management,
                mine_site_id=None,
                is_active=True,
                password_hash="mock",
            )
            # Contractor
            contractor = User(
                email=f"kpi_con_{uuid.uuid4().hex[:6]}@contractor.internal",
                full_name="KPI Contractor",
                role=UserRole.contractor,
                mine_site_id=site.id,
                is_active=True,
                password_hash="mock",
            )
            db.add_all([inspector, official, corporate, contractor])
            await db.flush()

            # Grant Corporate user access to this site
            from app.models import CorporateMineAccess
            c_access = CorporateMineAccess(
                user_id=corporate.id,
                mine_site_id=site.id,
            )
            db.add(c_access)
            await db.flush()

            base_time = datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc)

            # 2. Seed 2 closed observations with exact known durations:
            #    Obs 1: 4.0 hours duration
            #    Obs 2: 6.0 hours duration
            #    Expected avg: (4.0 + 6.0) / 2 = 5.0 hours
            obs1 = Observation(
                mine_site_id=site.id,
                zone_id=zone.id,
                inspector_id=inspector.id,
                category=ObservationCategory.safety,
                description="Observation with 4h closure",
                status=ObservationStatus.closed,
                edge_flag=RiskFlag.medium,
                created_at=base_time,
                closed_at=base_time + timedelta(hours=4),
            )
            obs2 = Observation(
                mine_site_id=site.id,
                zone_id=zone.id,
                inspector_id=inspector.id,
                category=ObservationCategory.environment,
                description="Observation with 6h closure",
                status=ObservationStatus.closed,
                edge_flag=RiskFlag.low,
                created_at=base_time,
                closed_at=base_time + timedelta(hours=6),
            )
            db.add_all([obs1, obs2])
            await db.flush()

            # 3. Seed 4 actions:
            #    Action 1: on-time (submitted_at 24h <= due_at 48h), round 1
            #    Action 2: rejected once (submission_round 2, rejection_reason set, on-time)
            #    Action 3: submitted late (submitted_at 72h > due_at 48h), round 1
            #    Action 4: on-time (submitted_at 12h <= due_at 48h), round 1
            act1 = CorrectiveAction(
                code=f"ACT-KP1-{uuid.uuid4().hex[:4].upper()}",
                observation_id=obs1.id,
                mine_site_id=site.id,
                assigned_by_user_id=official.id,
                assigned_to_user_id=contractor.id,
                title="Action 1: On-time",
                description="Seeded action on time",
                priority=ActionPriority.medium,
                status=ActionStatus.closed,
                submission_round=1,
                due_at=base_time + timedelta(hours=48),
                submitted_at=base_time + timedelta(hours=24),
            )
            act2 = CorrectiveAction(
                code=f"ACT-KP2-{uuid.uuid4().hex[:4].upper()}",
                observation_id=obs1.id,
                mine_site_id=site.id,
                assigned_by_user_id=official.id,
                assigned_to_user_id=contractor.id,
                title="Action 2: Rejected once",
                description="Seeded action rejected once",
                priority=ActionPriority.high,
                status=ActionStatus.pending_verification,
                submission_round=2,
                rejection_reason="Defective shield weld.",
                due_at=base_time + timedelta(hours=48),
                submitted_at=base_time + timedelta(hours=36),
            )
            act3 = CorrectiveAction(
                code=f"ACT-KP3-{uuid.uuid4().hex[:4].upper()}",
                observation_id=obs2.id,
                mine_site_id=site.id,
                assigned_by_user_id=official.id,
                assigned_to_user_id=contractor.id,
                title="Action 3: Submitted late",
                description="Seeded action submitted late",
                priority=ActionPriority.medium,
                status=ActionStatus.closed,
                submission_round=1,
                due_at=base_time + timedelta(hours=48),
                submitted_at=base_time + timedelta(hours=72),
            )
            act4 = CorrectiveAction(
                code=f"ACT-KP4-{uuid.uuid4().hex[:4].upper()}",
                observation_id=obs2.id,
                mine_site_id=site.id,
                assigned_by_user_id=official.id,
                assigned_to_user_id=contractor.id,
                title="Action 4: On-time",
                description="Seeded action on time 2",
                priority=ActionPriority.low,
                status=ActionStatus.closed,
                submission_round=1,
                due_at=base_time + timedelta(hours=48),
                submitted_at=base_time + timedelta(hours=12),
            )
            db.add_all([act1, act2, act3, act4])
            await db.commit()

            # 4. Assert Per-Mine KPI Summary
            kpi_mine = await get_kpis(mine_site_id=site.id, db=db, current_user=official)

            check(
                "1. Per-mine avg closure time exact match (5.0 hours)",
                kpi_mine.avg_time_to_closure_hours == 5.0,
                f"expected 5.0, got {kpi_mine.avg_time_to_closure_hours}",
            )
            check(
                "2. Per-mine rejection rate exact match (25.0%)",
                kpi_mine.rejection_rate_pct == 25.0,
                f"expected 25.0%, got {kpi_mine.rejection_rate_pct}%",
            )
            check(
                "3. Per-mine contractor on-time % exact match (75.0%)",
                kpi_mine.contractor_on_time_pct == 75.0,
                f"expected 75.0%, got {kpi_mine.contractor_on_time_pct}%",
            )

            # 5. Confirm Fleet-wide KPI in /kpi/summary (no mine_site_id)
            kpi_fleet = await get_kpis(mine_site_id=None, db=db, current_user=corporate)
            check(
                "4. Fleet-wide KPI in /kpi/summary available",
                kpi_fleet.avg_time_to_closure_hours is not None
                and kpi_fleet.rejection_rate_pct is not None
                and kpi_fleet.contractor_on_time_pct is not None,
                f"fleet closure={kpi_fleet.avg_time_to_closure_hours}h, "
                f"rejection={kpi_fleet.rejection_rate_pct}%, on_time={kpi_fleet.contractor_on_time_pct}%",
            )

            # 6. Confirm Fleet-wide KPI in /kpi/cross-mine-summary (corporate view)
            cross_summary = await get_cross_mine_summary(db=db, current_user=corporate)
            check(
                "5. Fleet-wide KPI in /kpi/cross-mine-summary available",
                cross_summary.avg_time_to_closure_hours is not None
                and cross_summary.rejection_rate_pct is not None
                and cross_summary.contractor_on_time_pct is not None,
                f"cross-mine closure={cross_summary.avg_time_to_closure_hours}h, "
                f"rejection={cross_summary.rejection_rate_pct}%, on_time={cross_summary.contractor_on_time_pct}%",
            )

        except Exception as e:
            check("KPI Known Values Test", False, str(e))

    print("\n" + "=" * 60)
    failed = [r for r in results if r[0] == FAIL]
    passed = [r for r in results if r[0] == PASS]
    print(f"Results: {len(passed)} PASSED, {len(failed)} FAILED")
    print("=" * 60)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
