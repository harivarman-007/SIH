"""verify_phase29_pull_sync.py

Phase 29: Mobile Two-Way Delta Sync & Offline Inspections Verification Suite

Tests:
  1. GET /sync/pull baseline returns assigned inspections, observations, and actions.
  2. Watermark filtering: records updated prior to 'since' are excluded.
  3. Status mutation reflection: server-side status updates advance watermark and are delivered on next pull.
  4. Linked Corrective Actions: actions on caller's observations returned with statuses and rejection reasons.
  5. Idempotent replay: repeated pull requests with identical watermark return consistent deltas.
  6. Zero-observation submit validation:
     6a. Submit inspection with 0 observations and empty notes -> HTTP 400 rejected.
     6b. Submit inspection with 0 observations and mandatory sign-off notes -> HTTP 200 accepted.
  7. Scoping isolation: inspector only receives inspections assigned to them.
"""
import asyncio
from datetime import datetime, timedelta, timezone
import os
import sys
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.models import (
    ActionPriority,
    ActionStatus,
    CorrectiveAction,
    Inspection,
    InspectionStatus,
    MineSite,
    Observation,
    ObservationCategory,
    ObservationStatus,
    User,
    UserRole,
    Zone,
)
from app.api.sync import sync_pull
from app.api.inspections import submit_inspection
from app.schemas.inspections import InspectionStatusUpdate
from fastapi import HTTPException

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
    print("Phase 29 Mobile Two-Way Delta Sync Verification Suite")
    print("=" * 60)

    async with AsyncSessionLocal() as db:
        try:
            # Setup isolated test fixtures
            uid = uuid.uuid4().hex[:6]
            site = MineSite(
                name=f"Sync Mine {uid}",
                location_name="Gallery 9",
                lat=23.75,
                lng=86.42,
            )
            db.add(site)
            await db.flush()

            zone = Zone(mine_site_id=site.id, name=f"Zone {uid}", zone_type="underground")
            db.add(zone)
            await db.flush()

            # Inspector 1 (caller)
            inspector1 = User(
                email=f"insp1_{uid}@mine.internal",
                full_name="Inspector One",
                role=UserRole.inspector,
                mine_site_id=site.id,
                is_active=True,
                password_hash="mock",
            )
            # Inspector 2 (isolated)
            inspector2 = User(
                email=f"insp2_{uid}@mine.internal",
                full_name="Inspector Two",
                role=UserRole.inspector,
                mine_site_id=site.id,
                is_active=True,
                password_hash="mock",
            )
            # Mine Manager
            manager = User(
                email=f"mgr_{uid}@mine.internal",
                full_name="Mine Manager",
                role=UserRole.mine_official,
                mine_site_id=site.id,
                is_active=True,
                password_hash="mock",
            )
            # Contractor
            contractor = User(
                email=f"con_{uid}@contractor.internal",
                full_name="Contractor Corp",
                role=UserRole.contractor,
                mine_site_id=site.id,
                is_active=True,
                password_hash="mock",
            )
            db.add_all([inspector1, inspector2, manager, contractor])
            await db.flush()

            now = datetime.now(timezone.utc)
            t_past = now - timedelta(hours=2)

            # Seed Inspection for Inspector 1
            insp1 = Inspection(
                code=f"INS-{uid}-01",
                mine_site_id=site.id,
                zone_id=zone.id,
                title="Primary Statutory Gas Survey",
                assigned_inspector_id=inspector1.id,
                created_by_id=manager.id,
                scheduled_for=t_past,
                due_at=t_past + timedelta(hours=24),
                status=InspectionStatus.scheduled,
                updated_at=t_past,
            )
            # Seed Inspection for Inspector 2 (scoping test)
            insp2 = Inspection(
                code=f"INS-{uid}-02",
                mine_site_id=site.id,
                zone_id=zone.id,
                title="Secondary Shaft Survey",
                assigned_inspector_id=inspector2.id,
                created_by_id=manager.id,
                scheduled_for=t_past,
                due_at=t_past + timedelta(hours=24),
                status=InspectionStatus.scheduled,
                updated_at=t_past,
            )
            db.add_all([insp1, insp2])
            await db.flush()

            # Seed Observation for Inspector 1
            obs1 = Observation(
                inspector_id=inspector1.id,
                mine_site_id=site.id,
                zone_id=zone.id,
                inspection_id=insp1.id,
                category=ObservationCategory.safety,
                description="Roof strut fissure near pillar 4",
                status=ObservationStatus.open,
                created_at=t_past,
                synced_at=t_past,
            )
            db.add(obs1)
            await db.flush()

            # Seed Action on Observation 1
            action1 = CorrectiveAction(
                code=f"ACT-{uid}-01",
                observation_id=obs1.id,
                mine_site_id=site.id,
                contractor_id=contractor.id,
                created_by_id=manager.id,
                title="Weld support bracket",
                description="Reinforce steel bracket at pillar 4",
                priority=ActionPriority.high,
                deadline=now + timedelta(days=2),
                status=ActionStatus.REJECTED,
                submission_round=2,
                rejection_reason="Weld bead thickness substandard (<8mm).",
                updated_at=t_past,
            )
            db.add(action1)

            # Seed Observation for Inspector 2
            obs2 = Observation(
                inspector_id=inspector2.id,
                mine_site_id=site.id,
                zone_id=zone.id,
                inspection_id=insp2.id,
                category=ObservationCategory.environment,
                description="Secondary shaft airflow obstruction",
                status=ObservationStatus.open,
                created_at=t_past,
                synced_at=t_past,
            )
            db.add(obs2)
            await db.flush()

            # Seed Action on Observation 2
            action2 = CorrectiveAction(
                code=f"ACT-{uid}-02",
                observation_id=obs2.id,
                mine_site_id=site.id,
                contractor_id=contractor.id,
                created_by_id=manager.id,
                title="Clear ventilation duct",
                description="Remove debris from intake fan",
                priority=ActionPriority.medium,
                deadline=now + timedelta(days=3),
                status=ActionStatus.IN_PROGRESS,
                submission_round=1,
                updated_at=t_past,
            )
            db.add(action2)
            await db.commit()

            # -------------------------------------------------------------
            # Test 1: Baseline pull without watermark returns assigned data
            # -------------------------------------------------------------
            pull1 = await sync_pull(since=None, db=db, current_user=inspector1)
            insp_codes = [i.code for i in pull1.inspections]
            check("1a. Baseline pull returns assigned inspection", insp1.code in insp_codes, f"Found: {insp_codes}")
            check("1b. Baseline pull scopes out other inspector", insp2.code not in insp_codes)
            check("1c. Baseline pull returns caller's observation", any(o.id == obs1.id for o in pull1.observations))
            check("1d. Baseline pull returns linked action with rejection reason", any(a.id == action1.id and a.rejection_reason for a in pull1.actions))
            check("1e. Baseline pull returns valid future watermark", pull1.watermark > t_past)

            watermark_1 = pull1.watermark

            # -------------------------------------------------------------
            # Test 2: Watermark filtering
            # -------------------------------------------------------------
            # Since no records were updated after watermark_1, pull2 delta should be empty
            pull2 = await sync_pull(since=watermark_1, db=db, current_user=inspector1)
            check("2a. Pull since watermark returns 0 stale inspections", len(pull2.inspections) == 0, f"Count: {len(pull2.inspections)}")
            check("2b. Pull since watermark returns 0 stale observations", len(pull2.observations) == 0, f"Count: {len(pull2.observations)}")
            check("2c. Pull since watermark returns 0 stale actions", len(pull2.actions) == 0, f"Count: {len(pull2.actions)}")

            # -------------------------------------------------------------
            # Test 3: Status mutation reflection
            # -------------------------------------------------------------
            # Advance inspection status to in_progress
            insp1.status = InspectionStatus.in_progress
            insp1.started_at = datetime.now(timezone.utc)
            insp1.updated_at = datetime.now(timezone.utc)
            db.add(insp1)
            await db.commit()

            pull3 = await sync_pull(since=watermark_1, db=db, current_user=inspector1)
            mutated_insp = next((i for i in pull3.inspections if i.id == insp1.id), None)
            check("3a. Status mutation reflected in delta pull", mutated_insp is not None and mutated_insp.status == InspectionStatus.in_progress)
            check("3b. Watermark advances continuously", pull3.watermark >= watermark_1)

            # -------------------------------------------------------------
            # Test 4: Linked Corrective Action delta reflection
            # -------------------------------------------------------------
            action1.status = ActionStatus.CLOSED
            action1.closed_at = datetime.now(timezone.utc)
            action1.updated_at = datetime.now(timezone.utc)
            db.add(action1)
            await db.commit()

            pull4 = await sync_pull(since=watermark_1, db=db, current_user=inspector1)
            mutated_act = next((a for a in pull4.actions if a.id == action1.id), None)
            check("4. Action status change reflected in delta pull", mutated_act is not None and mutated_act.status == ActionStatus.CLOSED)

            # -------------------------------------------------------------
            # Test 5: Idempotency & Replay
            # -------------------------------------------------------------
            pull5a = await sync_pull(since=watermark_1, db=db, current_user=inspector1)
            pull5b = await sync_pull(since=watermark_1, db=db, current_user=inspector1)
            check(
                "5. Repeated pull requests return identical entity counts",
                len(pull5a.inspections) == len(pull5b.inspections)
                and len(pull5a.actions) == len(pull5b.actions),
            )

            # -------------------------------------------------------------
            # Test 6: Zero-Observation Submit Validation
            # -------------------------------------------------------------
            # Create a clean inspection with 0 observations
            clean_insp = Inspection(
                code=f"INS-{uid}-ZERO",
                mine_site_id=site.id,
                zone_id=zone.id,
                title="Clean Survey with Zero Observations",
                assigned_inspector_id=inspector1.id,
                created_by_id=manager.id,
                scheduled_for=t_past,
                due_at=t_past + timedelta(hours=24),
                status=InspectionStatus.in_progress,
                updated_at=t_past,
            )
            db.add(clean_insp)
            await db.commit()

            # 6a. Submitting with zero observations and no notes must fail (HTTP 400)
            rejected = False
            try:
                await submit_inspection(
                    inspection_id=clean_insp.id,
                    req=InspectionStatusUpdate(notes=""),
                    db=db,
                    current_user=inspector1,
                )
            except HTTPException as e:
                if e.status_code == 400 and "mandatory sign-off notes" in str(e.detail):
                    rejected = True
            check("6a. Zero-observation submission without sign-off notes blocked (HTTP 400)", rejected)

            # 6b. Submitting with zero observations AND mandatory notes must succeed (HTTP 200)
            submitted_insp = await submit_inspection(
                inspection_id=clean_insp.id,
                req=InspectionStatusUpdate(notes="Sector surveyed thoroughly. Zero structural or gas anomalies detected. All bulkheads sealed."),
                db=db,
                current_user=inspector1,
            )
            check("6b. Zero-observation submission with mandatory notes accepted (HTTP 200)", submitted_insp.status == InspectionStatus.submitted)

            # -------------------------------------------------------------
            # Test 7: Scoping Isolation
            # -------------------------------------------------------------
            pull_insp2 = await sync_pull(since=None, db=db, current_user=inspector2)
            check("7a. Inspector 2 receives only own inspection", all(i.assigned_inspector_id == inspector2.id for i in pull_insp2.inspections))
            check("7b. Inspector 2 receives 0 inspections from Inspector 1", not any(i.id == insp1.id for i in pull_insp2.inspections))
            check("7c. Inspector 1 pull never includes Inspector 2 observations", not any(o.id == obs2.id for o in pull1.observations))
            check("7d. Inspector 1 pull never includes Inspector 2 actions", not any(a.id == action2.id for a in pull1.actions))
            check("7e. Inspector 2 receives only own observations", any(o.id == obs2.id for o in pull_insp2.observations) and not any(o.id == obs1.id for o in pull_insp2.observations))
            check("7f. Inspector 2 receives only own actions", any(a.id == action2.id for a in pull_insp2.actions) and not any(a.id == action1.id for a in pull_insp2.actions))

        except Exception as e:
            check("Phase 29 Execution", False, f"Exception: {e}")

    print("=" * 60)
    failed = [r for r in results if r[0] == FAIL]
    passed = [r for r in results if r[0] == PASS]
    print(f"Results: {len(passed)} PASSED, {len(failed)} FAILED")
    print("=" * 60)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
