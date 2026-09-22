"""verify_phase31_acceptance.py

Phase 31 Acceptance Test Suite:
Validates the complete 15-point RBAC & State Machine Acceptance Matrix (Spec Section 32):
Tests 1-6   : Role route matching & permission payload verification for all 6 roles
Tests 7-13  : Negative authorization boundaries, state machine constraints & HITL guards
Test 14     : Contractor scope isolation across both work orders AND linked observations (D18)
Test 15     : Cryptographic audit chain integrity verification
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from uuid import uuid4, UUID

from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

# Ensure backend root on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Set UTF-8 safe stdout for Windows CP1252 consoles
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.main import app
from app.database import AsyncSessionLocal
from app.models import (
    ActionEvidence,
    ActionStatus,
    CorrectiveAction,
    EvidenceKind,
    MineSite,
    Observation,
    ObservationCategory,
    ObservationStatus,
    RiskFlag,
    User,
    UserRole,
    Zone,
)
from app.authz.permissions import Permission, DEFAULT_ROLE_PERMISSIONS
from app.authz.state_machine import validate_transition
from app.services.auth import hash_password

PASS = "PASS"
FAIL = "FAIL"
results = []


def check(desc: str, condition: bool, extra: str = ""):
    if condition:
        print(f"  [PASS] {desc}")
        results.append((PASS, desc))
    else:
        print(f"  [FAIL] {desc} - {extra}")
        results.append((FAIL, desc))


async def main():
    print("=" * 70)
    print("PHASE 31: COMPREHENSIVE RBAC & FINAL ACCEPTANCE VERIFICATION")
    print("=" * 70)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver", follow_redirects=True) as client:

        # Helper: login and get auth header
        async def login(email: str, password: str = "password123") -> dict:
            res = await client.post("/auth/login", json={"email": email, "password": password})
            assert res.status_code == 200, f"Login failed for {email}: {res.status_code} {res.text}"
            token = res.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}

        # Retrieve or seed required test fixtures
        async with AsyncSessionLocal() as db:
            # 1. Fetch sites
            sites = (await db.execute(select(MineSite).order_by(MineSite.name))).scalars().all()
            dhanbad_site = next((s for s in sites if "Dhanbad" in s.name), sites[0])
            korba_site = next((s for s in sites if "Korba" in s.name), sites[1] if len(sites) > 1 else sites[0])

            # 2. Fetch or create second contractor for isolation test
            res_c2 = await db.execute(select(User).where(User.email == "contractor2@contractor.in"))
            ctr2 = res_c2.scalar_one_or_none()
            if not ctr2:
                ctr2 = User(
                    email="contractor2@contractor.in",
                    hashed_password=hash_password("password123"),
                    full_name="Second Remediation Contractor",
                    role=UserRole.contractor,
                    is_active=True,
                )
                db.add(ctr2)
                await db.commit()
                await db.refresh(ctr2)

            # 3. Fetch or create second mine official at Korba
            res_m2 = await db.execute(select(User).where(User.email == "official2@mine.in"))
            mgr2 = res_m2.scalar_one_or_none()
            if not mgr2:
                mgr2 = User(
                    email="official2@mine.in",
                    hashed_password=hash_password("password123"),
                    full_name="Korba Mine Manager",
                    role=UserRole.mine_official,
                    mine_site_id=korba_site.id,
                    is_active=True,
                )
                db.add(mgr2)
                await db.commit()
                await db.refresh(mgr2)

        # -------------------------------------------------------------------
        # Tests 1-6: Role Route Matching & Permission Payload Verification
        # -------------------------------------------------------------------
        print("\n--- Part 1: Canonical Role RBAC & Route Matching (Tests 1-6) ---")

        # Test 1: super_admin
        sa_auth = await login("superadmin@intellifusion.gov.in")
        res_me = await client.get("/auth/me", headers=sa_auth)
        check("1a. super_admin authentication succeeds", res_me.status_code == 200)
        sa_perms = set(res_me.json().get("permissions", []))
        expected_sa = {p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.super_admin]}
        check("1b. super_admin possesses platform-wide governance permissions", expected_sa.issubset(sa_perms))
        res_admin = await client.get("/admin/users", headers=sa_auth)
        check("1c. super_admin route /admin/users accessible (200 OK)", res_admin.status_code == 200)

        # Test 2: corporate_management
        corp_auth = await login("corporate@coalindia.in")
        res_corp_me = await client.get("/auth/me", headers=corp_auth)
        corp_perms = set(res_corp_me.json().get("permissions", []))
        has_corp_perms = {Permission.KPI_VIEW.value, Permission.REPORT_VIEW.value}.issubset(corp_perms)
        check("2a. corporate_management receives executive KPI & reporting permissions", has_corp_perms)
        res_cross = await client.get("/kpi/cross-mine-summary", headers=corp_auth)
        check("2b. corporate_management route /kpi/cross-mine-summary accessible (200 OK)", res_cross.status_code == 200)

        # Test 3: mine_official
        mgr_auth = await login("official1@mine.in")
        res_mgr_me = await client.get("/auth/me", headers=mgr_auth)
        mgr_perms = set(res_mgr_me.json().get("permissions", []))
        has_mgr_perms = {Permission.ACTION_CREATE.value, Permission.ACTION_VERIFY.value, Permission.OBSERVATION_REVIEW.value}.issubset(mgr_perms)
        check("3a. mine_official receives action creation & verification permissions", has_mgr_perms)
        res_mgr_act = await client.get("/actions", headers=mgr_auth)
        check("3b. mine_official route /actions accessible (200 OK)", res_mgr_act.status_code == 200)

        # Test 4: inspector
        insp_auth = await login("inspector1@mine.in")
        res_insp_me = await client.get("/auth/me", headers=insp_auth)
        insp_perms = set(res_insp_me.json().get("permissions", []))
        has_insp_perms = {Permission.INSPECTION_START.value, Permission.INSPECTION_SUBMIT.value, Permission.OBSERVATION_CREATE.value}.issubset(insp_perms)
        check("4a. inspector receives field inspection & observation permissions", has_insp_perms)
        res_insp_list = await client.get("/inspections", headers=insp_auth)
        check("4b. inspector route /inspections accessible (200 OK)", res_insp_list.status_code == 200)

        # Test 5: contractor
        ctr1_auth = await login("contractor1@contractor.in")
        res_ctr_me = await client.get("/auth/me", headers=ctr1_auth)
        ctr_perms = set(res_ctr_me.json().get("permissions", []))
        has_ctr_perms = {Permission.ACTION_ACCEPT.value, Permission.ACTION_START.value, Permission.EVIDENCE_UPLOAD.value, Permission.ACTION_SUBMIT.value}.issubset(ctr_perms)
        check("5a. contractor receives work order execution & evidence permissions", has_ctr_perms)
        res_ctr_act = await client.get("/actions", headers=ctr1_auth)
        check("5b. contractor route /actions accessible (200 OK)", res_ctr_act.status_code == 200)

        # Test 6: regulator
        reg_auth = await login("regulator@dgms.gov.in")
        res_reg_me = await client.get("/auth/me", headers=reg_auth)
        reg_perms = set(res_reg_me.json().get("permissions", []))
        has_reg_perms = {Permission.AUDIT_VERIFY.value, Permission.AUDIT_VIEW.value, Permission.KPI_VIEW.value}.issubset(reg_perms)
        check("6a. regulator receives statutory audit & compliance view permissions", has_reg_perms)
        res_reg_audit = await client.get("/audit/verify", headers=reg_auth)
        check("6b. regulator route /audit/verify accessible (200 OK)", res_reg_audit.status_code == 200)

        # -------------------------------------------------------------------
        # Tests 7-13: Negative Authorization Boundaries & State Machine Guards
        # -------------------------------------------------------------------
        print("\n--- Part 2: Negative Boundaries & State Machine Guards (Tests 7-13) ---")

        # Setup test action in pending_verification for negative checks
        async with AsyncSessionLocal() as db:
            zone = (await db.execute(select(Zone).where(Zone.mine_site_id == dhanbad_site.id))).scalars().first()
            inspector = (await db.execute(select(User).where(User.email == "inspector1@mine.in"))).scalar_one()
            ctr1 = (await db.execute(select(User).where(User.email == "contractor1@contractor.in"))).scalar_one()
            manager1 = (await db.execute(select(User).where(User.email == "official1@mine.in"))).scalar_one()

            obs_neg = Observation(
                created_at=datetime.now(timezone.utc),
                mine_site_id=dhanbad_site.id,
                zone_id=zone.id if zone else None,
                inspector_id=inspector.id,
                category=ObservationCategory.safety,
                edge_flag=RiskFlag.high,
                description="Negative authorization test observation",
                status=ObservationStatus.action_required,
            )
            db.add(obs_neg)
            await db.flush()

            act_neg = CorrectiveAction(
                code=f"ACT-NEG-{uuid4().hex[:4].upper()}",
                observation_id=obs_neg.id,
                mine_site_id=dhanbad_site.id,
                title="Negative test action",
                description="Action to test boundary enforcement",
                assigned_to_user_id=ctr1.id,
                assigned_by_user_id=manager1.id,
                priority=RiskFlag.high,
                status=ActionStatus.pending_verification,
                due_at=datetime.now(timezone.utc) + timedelta(days=1),
                submission_round=1,
            )
            db.add(act_neg)
            await db.commit()
            await db.refresh(act_neg)
            neg_act_id = act_neg.id
            neg_obs_id = obs_neg.id

        # Test 7: Contractor cannot verify action (403 FORBIDDEN)
        res = await client.post(f"/actions/{neg_act_id}/verify", headers=ctr1_auth)
        check("7. Contractor cannot verify action (403 Forbidden)", res.status_code == 403)

        # Test 8: Inspector cannot close action or review observation (403 FORBIDDEN)
        res_insp_ver = await client.post(f"/actions/{neg_act_id}/verify", headers=insp_auth)
        res_insp_rev = await client.post(f"/observations/{neg_obs_id}/review", headers=insp_auth)
        check("8. Inspector cannot verify action or review observation (403 Forbidden)", res_insp_ver.status_code == 403 and res_insp_rev.status_code == 403)

        # Test 9: Corporate / Regulator cannot verify action (403 FORBIDDEN)
        res_corp_ver = await client.post(f"/actions/{neg_act_id}/verify", headers=corp_auth)
        res_reg_ver = await client.post(f"/actions/{neg_act_id}/verify", headers=reg_auth)
        check("9. Corporate / Regulator cannot verify action (403 Forbidden)", res_corp_ver.status_code == 403 and res_reg_ver.status_code == 403)

        # Test 10: Super admin operational separation (Decision D9)
        # Super admin does not have ACTION_VERIFY directly in default operational matrix without site scope
        sa_has_act_verify = Permission.ACTION_VERIFY in DEFAULT_ROLE_PERMISSIONS.get(UserRole.super_admin, set())
        # Operational verification belongs strictly to mine_official
        check("10. Super Admin operational separation: operational verification separated from super_admin", not sa_has_act_verify)

        # Test 11: System actor cannot perform HITL verification (Decision D12)
        from fastapi import HTTPException
        hitl_blocked = False
        try:
            validate_transition(
                entity_type="action",
                from_state=ActionStatus.pending_verification.value,
                to_state=ActionStatus.verified.value,
                actor_type="system",
            )
        except HTTPException as e:
            if e.status_code == 403 and "HUMAN_IN_THE_LOOP" in str(e.detail):
                hitl_blocked = True
        check("11. System actor cannot perform HITL verification (Decision D12 enforced)", hitl_blocked)

        # Test 12: Proof of work required before action submission
        # Create an action in IN_PROGRESS state with 0 evidence files
        async with AsyncSessionLocal() as db:
            act_no_ev = CorrectiveAction(
                code=f"ACT-NOEV-{uuid4().hex[:4].upper()}",
                observation_id=neg_obs_id,
                mine_site_id=dhanbad_site.id,
                title="No evidence submission test",
                description="Testing 400 when submitting without evidence",
                assigned_to_user_id=ctr1.id,
                assigned_by_user_id=manager1.id,
                priority=RiskFlag.medium,
                status=ActionStatus.in_progress,
                due_at=datetime.now(timezone.utc) + timedelta(days=1),
                submission_round=1,
            )
            db.add(act_no_ev)
            await db.commit()
            await db.refresh(act_no_ev)
            no_ev_act_id = act_no_ev.id

        res_no_ev = await client.post(f"/actions/{no_ev_act_id}/submit", headers=ctr1_auth)
        check("12. Proof of work required: action submission without evidence rejected (400 Bad Request)", res_no_ev.status_code == 400)

        # Test 13: Cross-mine manager isolation
        # Manager 2 (Korba) attempts to verify or access Dhanbad action
        mgr2_auth = await login("official2@mine.in")
        res_cross_ver = await client.post(f"/actions/{neg_act_id}/verify", headers=mgr2_auth)
        check("13. Cross-mine manager isolation: Korba manager cannot verify Dhanbad action (403 Forbidden)", res_cross_ver.status_code == 403)

        # -------------------------------------------------------------------
        # Test 14: Contractor Scope Isolation (Actions AND Observations - D18)
        # -------------------------------------------------------------------
        print("\n--- Part 3: Scope Isolation & Cryptographic Audit (Tests 14-15) ---")

        # Create Action B assigned to Contractor 2 with its own Observation B
        async with AsyncSessionLocal() as db:
            ctr2_user = (await db.execute(select(User).where(User.email == "contractor2@contractor.in"))).scalar_one()
            insp_user = (await db.execute(select(User).where(User.email == "inspector1@mine.in"))).scalar_one()
            zone_korba = (await db.execute(select(Zone).where(Zone.mine_site_id == korba_site.id))).scalars().first()
            if not zone_korba:
                zone_korba = Zone(mine_site_id=korba_site.id, name="Korba Haul Road 1", risk_baseline=0.35)
                db.add(zone_korba)
                await db.flush()

            obs_b = Observation(
                created_at=datetime.now(timezone.utc),
                mine_site_id=korba_site.id,
                zone_id=zone_korba.id,
                inspector_id=insp_user.id,
                category=ObservationCategory.environment,
                edge_flag=RiskFlag.medium,
                description="Observation isolated to Contractor 2",
                status=ObservationStatus.action_required,
            )
            db.add(obs_b)
            await db.flush()

            from app.models import ContractorAssignment
            assign_b = ContractorAssignment(
                observation_id=obs_b.id,
                contractor_id=ctr2_user.id,
                notes="Assigned to Contractor 2",
            )
            db.add(assign_b)

            act_b = CorrectiveAction(
                code=f"ACT-CTR2-{uuid4().hex[:4].upper()}",
                observation_id=obs_b.id,
                mine_site_id=korba_site.id,
                title="Contractor 2 Private Work Order",
                description="Work order only accessible by Contractor 2",
                assigned_to_user_id=ctr2_user.id,
                assigned_by_user_id=mgr2.id,
                priority=RiskFlag.medium,
                status=ActionStatus.assigned,
                due_at=datetime.now(timezone.utc) + timedelta(days=2),
                submission_round=1,
            )
            db.add(act_b)
            await db.commit()
            await db.refresh(act_b)
            act_b_id = act_b.id
            obs_b_id = obs_b.id

        # Contractor 1 attempts to access Action B and Observation B
        res_ctr1_act_b = await client.get(f"/actions/{act_b_id}", headers=ctr1_auth)
        res_ctr1_obs_b = await client.get(f"/observations/{obs_b_id}", headers=ctr1_auth)
        ctr1_blocked_action = res_ctr1_act_b.status_code in (403, 404)
        ctr1_blocked_obs = res_ctr1_obs_b.status_code in (403, 404)
        check("14. Contractor scope isolation (D18): Contractor 1 cannot access Contractor 2's Action OR Observation", ctr1_blocked_action and ctr1_blocked_obs)

        # Test 15: Cryptographic audit chain verification
        res_audit = await client.get("/audit/verify", headers=reg_auth)
        check("15a. Regulatory audit endpoint returns 200 OK", res_audit.status_code == 200)
        audit_json = res_audit.json()
        is_chain_valid = audit_json.get("is_valid") is True
        broken_id = audit_json.get("broken_at_id")
        total_checked = audit_json.get("total_checked", 0)
        check("15b. Cryptographic SHA-256 audit chain verified intact with 0 broken links", is_chain_valid and broken_id is None and total_checked >= 1)

    print("\n" + "=" * 70)
    failed = [r for r in results if r[0] == FAIL]
    passed = [r for r in results if r[0] == PASS]
    print(f"Results: {len(passed)} PASSED, {len(failed)} FAILED")
    print("=" * 70)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
