"""
reset_demo.py — Idempotent Demo Dataset Provisioning & Reset (Phase 31)

D16 & Phase 31 Specification:
- Validates settings.demo_mode (refuses execution unless DEMO_MODE=true or --force is supplied).
- Idempotent: Uses natural key upsert/lookup for static baseline entities (sites, zones, users),
  and transactional cleanup for demo-generated workflow artifacts (INS-DEMO-*, ACT-DEMO-*),
  leaving a clean baseline with one inspection ready to start.
"""
import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import (
    AuditLog,
    ActionEvidence,
    ComplianceRule,
    ContractorProfile,
    CorporateMineAccess,
    CorrectiveAction,
    Inspection,
    InspectionStatus,
    MineSite,
    Observation,
    User,
    UserRole,
    WorkflowTransition,
    Zone,
)
from app.services.auth import hash_password


async def reset_demo(force: bool = False) -> None:
    # 1. DEMO_MODE Guard
    if not settings.demo_mode and not force:
        print("[ERROR] reset_demo.py: DEMO_MODE is False in settings.")
        print("Safety guard triggered: Refusing to reset database without DEMO_MODE=true.")
        print("To override in development, pass --force.")
        sys.exit(1)

    print("============================================================")
    print("INTELLIFUSION — IDEMPOTENT DEMO STORY DATASET RESET")
    print("============================================================")
    print(f"Environment : {settings.environment}")
    print(f"DEMO_MODE   : {settings.demo_mode} (Force override: {force})")
    print("------------------------------------------------------------")

    now = datetime.now(timezone.utc)
    demo_password_hash = hash_password("password123")

    async with AsyncSessionLocal() as db:
        try:
            # -------------------------------------------------------------
            # 1. Baseline Mine Sites (Natural key: name)
            # -------------------------------------------------------------
            site_defs = [
                ("Dhanbad Colliery No. 5", "Jharia Coalfield, Dhanbad, Jharkhand", 23.7957, 86.4304),
                ("Raniganj Coalfield Sector 3", "Raniganj Basin, West Bengal", 23.6200, 86.9800),
                ("Jharia Block II Pit", "Jharia Basin, Dhanbad, Jharkhand", 23.7500, 86.4100),
            ]
            sites = {}
            for name, loc, lat, lng in site_defs:
                stmt = select(MineSite).where(MineSite.name == name)
                res = await db.execute(stmt)
                site = res.scalar_one_or_none()
                if not site:
                    site = MineSite(name=name, location_name=loc, lat=lat, lng=lng)
                    db.add(site)
                    await db.flush()
                sites[name] = site
            primary_site = sites["Dhanbad Colliery No. 5"]
            print(f"[OK] 3 Mine Sites verified (Primary: {primary_site.name})")

            # -------------------------------------------------------------
            # 2. Baseline Underground Zones
            # -------------------------------------------------------------
            zone_stmt = select(Zone).where(
                Zone.mine_site_id == primary_site.id,
                Zone.name == "Longwall Face 4-B"
            )
            primary_zone = (await db.execute(zone_stmt)).scalar_one_or_none()
            if not primary_zone:
                primary_zone = Zone(
                    mine_site_id=primary_site.id,
                    name="Longwall Face 4-B",
                    zone_type="underground_extraction",
                    risk_baseline=0.45,
                )
                db.add(primary_zone)
                await db.flush()
            print(f"[OK] Primary Zone verified: {primary_zone.name} (Risk Baseline: {primary_zone.risk_baseline})")

            # -------------------------------------------------------------
            # 3. Canonical Demo Users (Upsert by email)
            # -------------------------------------------------------------
            user_defs = [
                ("superadmin@intellifusion.gov.in", "System Super Admin", UserRole.super_admin, None),
                ("corporate@coalindia.in", "Priya Sharma (Corporate HQ)", UserRole.corporate_management, None),
                ("official1@mine.in", "Rajesh Kumar (Mine Manager)", UserRole.mine_official, primary_site.id),
                ("inspector1@mine.in", "Vikram Singh (Field Inspector)", UserRole.inspector, primary_site.id),
                ("contractor1@contractor.in", "Amit Patel (Remediation Contractor)", UserRole.contractor, None),
                ("regulator@dgms.gov.in", "A.K. Verma (DGMS Inspector)", UserRole.regulator, None),
            ]

            users = {}
            for email, full_name, role, site_id in user_defs:
                u_stmt = select(User).where(User.email == email)
                user = (await db.execute(u_stmt)).scalar_one_or_none()
                if not user:
                    user = User(
                        id=uuid.uuid4(),
                        email=email,
                        password_hash=demo_password_hash,
                        full_name=full_name,
                        role=role,
                        mine_site_id=site_id,
                        is_active=True,
                    )
                    db.add(user)
                else:
                    # Update to canonical state
                    user.password_hash = demo_password_hash
                    user.full_name = full_name
                    user.role = role
                    user.mine_site_id = site_id
                    user.is_active = True
                    db.add(user)
                await db.flush()
                users[email] = user
            print(f"[OK] 6 Canonical Demo Accounts verified with password 'password123'")

            # -------------------------------------------------------------
            # 4. Corporate Mine Access Grants
            # -------------------------------------------------------------
            corp_user = users["corporate@coalindia.in"]
            for s in sites.values():
                cma_stmt = select(CorporateMineAccess).where(
                    CorporateMineAccess.user_id == corp_user.id,
                    CorporateMineAccess.mine_site_id == s.id
                )
                if not (await db.execute(cma_stmt)).scalar_one_or_none():
                    db.add(CorporateMineAccess(user_id=corp_user.id, mine_site_id=s.id))
            await db.flush()
            print("[OK] Corporate multi-mine access grants verified across all 3 sites")

            # -------------------------------------------------------------
            # 5. Contractor Profile
            # -------------------------------------------------------------
            contractor_user = users["contractor1@contractor.in"]
            cp_stmt = select(ContractorProfile).where(ContractorProfile.user_id == contractor_user.id)
            c_profile = (await db.execute(cp_stmt)).scalar_one_or_none()
            if not c_profile:
                c_profile = ContractorProfile(
                    user_id=contractor_user.id,
                    company_name="Apex Mining Remediation Corp",
                    license_no="LIC-DGMS-2026-089",
                    cert_expiry=now + timedelta(days=365),
                    is_active=True,
                )
                db.add(c_profile)
            else:
                c_profile.company_name = "Apex Mining Remediation Corp"
                c_profile.license_no = "LIC-DGMS-2026-089"
                c_profile.is_active = True
                db.add(c_profile)
            await db.flush()
            print(f"[OK] Contractor Profile verified: {c_profile.company_name} ({c_profile.license_no})")

            # -------------------------------------------------------------
            # 6. Idempotent Demo Artifact Cleanup (delete previous walkthrough run)
            # -------------------------------------------------------------
            # Find existing demo inspection
            prev_insp_stmt = select(Inspection).where(Inspection.code == "INS-DEMO-001")
            prev_insp = (await db.execute(prev_insp_stmt)).scalar_one_or_none()
            if prev_insp:
                # Find observations linked to this inspection
                obs_stmt = select(Observation).where(Observation.inspection_id == prev_insp.id)
                demo_obs = (await db.execute(obs_stmt)).scalars().all()
                obs_ids = [o.id for o in demo_obs]

                if obs_ids:
                    # Find actions linked to these observations
                    act_stmt = select(CorrectiveAction).where(CorrectiveAction.observation_id.in_(obs_ids))
                    demo_acts = (await db.execute(act_stmt)).scalars().all()
                    act_ids = [a.id for a in demo_acts]

                    if act_ids:
                        # Delete evidence files and workflow transitions for actions
                        await db.execute(delete(ActionEvidence).where(ActionEvidence.action_id.in_(act_ids)))
                        await db.execute(delete(WorkflowTransition).where(WorkflowTransition.entity_id.in_(act_ids)))
                        await db.execute(delete(CorrectiveAction).where(CorrectiveAction.id.in_(act_ids)))

                    # Delete workflow transitions and observations
                    await db.execute(delete(WorkflowTransition).where(WorkflowTransition.entity_id.in_(obs_ids)))
                    await db.execute(delete(Observation).where(Observation.id.in_(obs_ids)))

                # Delete workflow transitions and inspection
                await db.execute(delete(WorkflowTransition).where(WorkflowTransition.entity_id == prev_insp.id))
                await db.execute(delete(Inspection).where(Inspection.id == prev_insp.id))
                await db.flush()
                print("[OK] Cleared previous demo walkthrough artifacts (clean slate)")

            # -------------------------------------------------------------
            # 7. Seed Pristine Story Starting State: 1 Inspection Ready to Start
            # -------------------------------------------------------------
            demo_insp = Inspection(
                code="INS-DEMO-001",
                mine_site_id=primary_site.id,
                title="Statutory Pre-Shift Ventilation & Gas Inspection",
                assigned_inspector_id=users["inspector1@mine.in"].id,
                created_by_id=users["official1@mine.in"].id,
                scheduled_for=now,
                due_at=now + timedelta(hours=24),
                status=InspectionStatus.scheduled,
            )
            db.add(demo_insp)
            await db.flush()

            # Record initial assignment transition
            trans = WorkflowTransition(
                entity_type="inspection",
                entity_id=demo_insp.id,
                from_state="NONE",
                to_state="SCHEDULED",
                actor_id=users["official1@mine.in"].id,
                actor_role="mine_official",
                actor_type="user",
                reason="Statutory Pre-Shift Assignment",
            )
            db.add(trans)
            await db.commit()

            print(f"[OK] Seeded pristine inspection: {demo_insp.code} (Status: SCHEDULED)")
            print(f"     Assigned to: {users['inspector1@mine.in'].email}")
            print(f"     Site       : {primary_site.name}")
            print("------------------------------------------------------------")
            print(">>> DEMO STORY DATASET SUCCESSFULLY RESET! <<<")
            print("Ready for live demonstration via scripts/demo_walkthrough.py")
            print("============================================================")

        except Exception as e:
            await db.rollback()
            print(f"[FAIL] Error resetting demo dataset: {e}")
            raise e


def main():
    parser = argparse.ArgumentParser(description="Reset demo dataset for live jury flow")
    parser.add_argument("--force", action="store_true", help="Force reset even if DEMO_MODE=False")
    args = parser.parse_args()

    asyncio.run(reset_demo(force=args.force))


if __name__ == "__main__":
    main()
