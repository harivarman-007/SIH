"""verify_phase26_actions.py

Verification script for Phase 26: Corrective Actions, Evidence Upload, & Verification/Closure Workflow.
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
    print("Phase 26 Corrective Actions & Verification Workflow Suite")
    print("=" * 60)

    # 1. ORM Model & Schema Checks
    try:
        from app.models import (
            ActionEvidence,
            ActionPriority,
            ActionStatus,
            Alert,
            CorrectiveAction,
            EvidenceKind,
            Observation,
            ObservationStatus,
            UserRole,
        )

        has_models = (
            hasattr(CorrectiveAction, "code")
            and hasattr(CorrectiveAction, "submission_round")
            and hasattr(CorrectiveAction, "safety_standards_referenced")
            and hasattr(ActionEvidence, "hash_sha256")
            and hasattr(ActionEvidence, "kind")
        )
        check("1a. ORM models (CorrectiveAction, ActionEvidence)", has_models)

        has_enums = (
            hasattr(ActionStatus, "assigned")
            and hasattr(ActionStatus, "pending_verification")
            and hasattr(ActionStatus, "verified")
            and hasattr(ActionStatus, "rejected")
            and not hasattr(ActionStatus, "reopen_in_progress")
            and hasattr(ActionPriority, "high")
            and hasattr(EvidenceKind, "before_photo")
        )
        check("1b. Enum definitions (ActionStatus, ActionPriority, EvidenceKind; REOPEN removed)", has_enums)

        # Check relationships on Observation and Alert
        obs_rel = hasattr(Observation, "corrective_actions")
        alert_rel = hasattr(Alert, "action_id")
        check("1c. Model relationships (Observation.corrective_actions, Alert.action_id)", obs_rel and alert_rel)
    except Exception as e:
        check("1. ORM Model Checks", False, str(e))

    # 2. State Machine Logic & Decision D12 Human-in-the-Loop Checks
    try:
        from app.authz.state_machine import (
            ALL_ACTION_STATES,
            ACTION_TRANSITION_MAP,
            validate_transition,
        )
        from app.models import ActionStatus
        from fastapi import HTTPException

        # Legal action transitions — spec-compliant flow (Phase 27b):
        # ASSIGNED->ACCEPTED->IN_PROGRESS->PENDING_VERIFICATION->VERIFIED->CLOSED
        # Rejection loop: PENDING_VERIFICATION->REJECTED->IN_PROGRESS->PENDING_VERIFICATION
        try:
            validate_transition("action", ActionStatus.assigned.value, ActionStatus.accepted.value, "user")
            validate_transition("action", ActionStatus.accepted.value, ActionStatus.in_progress.value, "user")
            validate_transition("action", ActionStatus.in_progress.value, ActionStatus.pending_verification.value, "user")
            validate_transition("action", ActionStatus.pending_verification.value, ActionStatus.verified.value, "user")
            validate_transition("action", ActionStatus.verified.value, ActionStatus.closed.value, "user")
            validate_transition("action", ActionStatus.pending_verification.value, ActionStatus.rejected.value, "user")
            validate_transition("action", ActionStatus.rejected.value, ActionStatus.in_progress.value, "user")
            legal_ok = True
        except Exception as e:
            legal_ok = False
            print("Legal transition error:", e)

        check("2a. Legal state transitions (spec-compliant: assigned->accepted->in_progress->pending_verification->verified->closed + rejected->in_progress re-entry)", legal_ok)

        # Illegal: direct REJECTED -> PENDING_VERIFICATION without going through /start
        illegal_direct_resubmit_blocked = False
        try:
            validate_transition("action", ActionStatus.rejected.value, ActionStatus.pending_verification.value, "user")
        except HTTPException as exc:
            if exc.status_code == 400:
                illegal_direct_resubmit_blocked = True
        check("2b. Direct resubmit blocked: REJECTED -> PENDING_VERIFICATION without /start is HTTP 400", illegal_direct_resubmit_blocked)

        # Illegal state transition check (e.g. assigned -> closed directly)
        illegal_blocked = False
        try:
            validate_transition("action", ActionStatus.assigned.value, ActionStatus.closed.value, "user")
        except HTTPException as exc:
            if exc.status_code == 400:
                illegal_blocked = True
        check("2c. Illegal transition blocked (assigned -> closed -> HTTP 400)", illegal_blocked)

        # D12 Human-in-the-loop protection: actor_type='system' rejected for verification
        d12_blocked = False
        try:
            validate_transition("action", ActionStatus.pending_verification.value, ActionStatus.verified.value, actor_type="system")
        except HTTPException as exc:
            if exc.status_code == 403:
                d12_blocked = True
        check("2d. Decision D12 Human-in-the-loop protection (actor_type='system' blocked for verify -> HTTP 403)", d12_blocked)

    except Exception as e:
        check("2. State Machine Checks", False, str(e))


    # 3. Database & API End-to-End Workflow Integration
    try:
        from app.database import AsyncSessionLocal
        from app.models import MineSite, Zone, User, UserRole, ObservationCategory, RiskFlag, ActionPriority, ActionStatus, EvidenceKind
        from app.services.auth import hash_password
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            # Seed test mine site
            site_name = f"Phase26 Test Mine {uuid.uuid4().hex[:6]}"
            site = MineSite(name=site_name, location_name="Test Location")
            db.add(site)
            await db.flush()

            # Seed users: Mine Official, Inspector, Contractor
            official_email = f"official_{uuid.uuid4().hex[:6]}@test.com"
            official = User(
                email=official_email,
                full_name="Phase26 Official",
                role=UserRole.mine_official,
                mine_site_id=site.id,
                password_hash=hash_password("password123"),
                is_active=True,
            )

            inspector_email = f"inspector_{uuid.uuid4().hex[:6]}@test.com"
            inspector = User(
                email=inspector_email,
                full_name="Phase26 Inspector",
                role=UserRole.inspector,
                mine_site_id=site.id,
                password_hash=hash_password("password123"),
                is_active=True,
            )

            contractor_email = f"contractor_{uuid.uuid4().hex[:6]}@test.com"
            contractor = User(
                email=contractor_email,
                full_name="Phase26 Contractor",
                role=UserRole.contractor,
                password_hash=hash_password("password123"),
                is_active=True,
            )

            db.add_all([official, inspector, contractor])
            await db.flush()

            # Seed test zone
            zone = Zone(mine_site_id=site.id, name="Shaft 3 Zone", zone_type="underground")
            db.add(zone)
            await db.flush()

            # Create test observation
            obs = Observation(
                created_at=datetime.now(timezone.utc),
                mine_site_id=site.id,
                zone_id=zone.id,
                inspector_id=inspector.id,
                category=ObservationCategory.safety,
                edge_flag=RiskFlag.medium,
                description="Faulty Methane Sensor Cable - Cable insulation frayed near Shaft 3",
                status=ObservationStatus.action_required,
            )
            db.add(obs)
            await db.flush()

            # Execute actions API router endpoints directly or via HTTP client logic
            from app.api.actions import (
                accept_action,
                create_action,
                get_action,
                list_actions,
                reject_action,
                start_action,
                submit_action,
                upload_evidence,
                verify_action,
            )
            from app.schemas.actions import ActionCreate, ActionRejectRequest, EvidenceCreate

            # 3a. Create Action
            due_at = datetime.now(timezone.utc) + timedelta(days=2)
            act_req = ActionCreate(
                observation_id=obs.id,
                title="Replace Methane Sensor Cable",
                description="Replace frayed 24V supply cable with armored spec cable",
                assigned_to_user_id=contractor.id,
                priority=ActionPriority.high,
                due_at=due_at,
                safety_standards_referenced=["DGMS Circular 04", "IS 13947"],
            )
            action_out = await create_action(req=act_req, db=db, current_user=official)
            check("3a. Create Action (ACT-xxxx code generated)", action_out.code.startswith("ACT-"))

            action_id = action_out.id

            # 3b. Scope query check
            contractor_actions = await list_actions(
                status_filter=None, mine_site_id=None,
                assigned_to_user_id=None, priority=None,
                limit=50, offset=0,
                db=db, current_user=contractor,
            )
            check("3b. Scope filtering (Contractor sees assigned action)", any(a.id == action_id for a in contractor_actions))

            # 3c. Accept Action
            accepted_act = await accept_action(action_id=action_id, db=db, current_user=contractor)
            check("3c. Accept Action (status -> accepted)", accepted_act.status == ActionStatus.accepted)

            # 3d. Start Action
            started_act = await start_action(action_id=action_id, db=db, current_user=contractor)
            check("3d. Start Action (status -> in_progress)", started_act.status == ActionStatus.in_progress)

            # 3e. Submit without evidence (Must fail with HTTP 400)
            submit_no_ev_failed = False
            try:
                await submit_action(action_id=action_id, db=db, current_user=contractor)
            except HTTPException as exc:
                if exc.status_code == 400:
                    submit_no_ev_failed = True
            check("3e. Submit without evidence blocked (HTTP 400)", submit_no_ev_failed)

            # 3f. Upload Evidence
            ev_req = EvidenceCreate(
                kind=EvidenceKind.before_photo,
                file_url="https://sih-storage.internal/ev/before_001.jpg",
                description="Frayed cable prior to replacement",
                hash_sha256="a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
            )
            ev_out = await upload_evidence(action_id=action_id, req=ev_req, db=db, current_user=contractor)
            check("3f. Evidence Upload (proof attached)", ev_out.file_url == ev_req.file_url)

            # 3g. Submit with evidence
            submitted_act = await submit_action(action_id=action_id, db=db, current_user=contractor)
            check("3g. Submit Action with evidence (status -> pending_verification)", submitted_act.status == ActionStatus.pending_verification)

            # 3h. Mine Official Reject Action (<10 chars fails min_length; test valid rejection)
            reject_req = ActionRejectRequest(reason="Cable replaced but junction box cover left unbolted.")
            rejected_act = await reject_action(action_id=action_id, req=reject_req, db=db, current_user=official)
            check(
                "3h. Reject Action (status -> rejected, reason recorded, round incremented)",
                rejected_act.status == ActionStatus.rejected
                and rejected_act.submission_round == 2
                and rejected_act.rejection_reason == "Cable replaced but junction box cover left unbolted.",
            )

            # 3h2. Assert ACTION_REJECTED in Audit Ledger (cryptographic audit trail)
            from app.models import AuditLog
            audit_stmt = (
                select(AuditLog)
                .where(
                    AuditLog.action == "ACTION_REJECTED",
                    AuditLog.actor_id == official.id,
                )
                .order_by(AuditLog.id.desc())
                .limit(1)
            )
            audit_entry = (await db.execute(audit_stmt)).scalar_one_or_none()
            check(
                "3h2. Audit ledger records ACTION_REJECTED event",
                audit_entry is not None
                and audit_entry.action == "ACTION_REJECTED"
                and audit_entry.payload.get("entity_id") == str(action_id)
                and audit_entry.payload.get("reason") == "Cable replaced but junction box cover left unbolted.",
                f"action={audit_entry.action if audit_entry else 'None'}",
            )

            # 3i. After rejection: contractor calls /start to move REJECTED -> IN_PROGRESS
            # This is the ONLY re-entry path per spec (Phase 27b: REOPEN_IN_PROGRESS removed).
            # The rejection_reason is visible on the action detail at this point.
            check(
                "3i. Rejection reason is persisted and visible on action (contractor sees it via GET /actions/{id})",
                rejected_act.rejection_reason == "Cable replaced but junction box cover left unbolted."
            )
            # Direct resubmit while still in REJECTED status must be blocked with HTTP 400 (Phase 27b)
            direct_blocked = False
            from fastapi import HTTPException
            try:
                await submit_action(action_id=action_id, db=db, current_user=contractor)
            except HTTPException as exc:
                if exc.status_code == 400:
                    direct_blocked = True
            check("3i1. Direct resubmit after reject is blocked (HTTP 400)", direct_blocked)

            # Contractor must call /start first before resubmitting
            resumed_act = await start_action(action_id=action_id, db=db, current_user=contractor)
            check("3i2. After rejection: /start moves status REJECTED -> IN_PROGRESS", resumed_act.status == ActionStatus.in_progress)

            # 3i3. Re-upload evidence
            ev_after = EvidenceCreate(
                kind=EvidenceKind.after_photo,
                file_url="https://sih-storage.internal/ev/after_001.jpg",
                description="Armored cable installed with sealed junction box",
            )
            await upload_evidence(action_id=action_id, req=ev_after, db=db, current_user=contractor)
            resubmitted_act = await submit_action(action_id=action_id, db=db, current_user=contractor)
            check("3i3. Resubmit Action IN_PROGRESS -> PENDING_VERIFICATION", resubmitted_act.status == ActionStatus.pending_verification)


            # 3j. Mine Official Verify & Close Action + Atomic Parent Observation Closure Check (D7)
            verified_act = await verify_action(action_id=action_id, db=db, current_user=official)
            check("3j. Verify Action (status -> closed)", verified_act.status == ActionStatus.closed)

            # Check parent observation status
            parent_obs = await db.get(Observation, obs.id)
            check("3k. Decision D7 Atomic Observation Closure (parent observation closed)", parent_obs.status == ObservationStatus.closed, f"obs_status={parent_obs.status}")

            # 3l. KPI Check (avg_time_to_closure_hours, rejection_rate_pct, contractor_on_time_pct)
            from app.api.kpi import get_kpis
            kpi_out = await get_kpis(mine_site_id=site.id, db=db, current_user=official)
            check(
                "3l. KPI Metrics (closure time, rejection rate %, contractor on-time %)",
                kpi_out.avg_time_to_closure_hours is not None
                and kpi_out.rejection_rate_pct is not None
                and kpi_out.rejection_rate_pct > 0.0
                and kpi_out.contractor_on_time_pct is not None,
                f"closure={kpi_out.avg_time_to_closure_hours}h, rejection={kpi_out.rejection_rate_pct}%, on_time={kpi_out.contractor_on_time_pct}%",
            )

    except Exception as e:
        check("3. Integration Workflow Checks", False, str(e))
        import traceback
        traceback.print_exc()

    # Summary
    print("\n" + "=" * 60)
    print("PHASE 26 VERIFICATION SUMMARY")
    print("=" * 60)
    all_passed = True
    for status_str, name, detail in results:
        if status_str == FAIL:
            all_passed = False

    passed_count = sum(1 for r in results if r[0] == PASS)
    total_count = len(results)
    print(f"Total Tests: {total_count} | Passed: {passed_count} | Failed: {total_count - passed_count}")

    if all_passed:
        print("\nALL PHASE 26 VERIFICATION CHECKS PASSED PERFECTLY!")
        sys.exit(0)
    else:
        print("\nSOME CHECKS FAILED - REVIEW LOGS ABOVE.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
