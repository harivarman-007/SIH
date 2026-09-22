"""
verify_phase30_admin_reports.py
Verification suite for Phase 30:
1. User Lifecycle Administration & Self-Disable Lockout Guard
2. Roles & Permissions Dynamic Toggle, HARD_DENY & Lockout Guards
3. Governance Settings (SLA Thresholds, Scheduler Integration)
4. Compliance Rules Registry
5. Statutory Reports Generation, Scope Gating & CSV Export Audit
"""
import asyncio
import io
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.models import (
    AuditLog,
    ComplianceRule,
    ContractorProfile,
    MineSite,
    Observation,
    ObservationCategory,
    ObservationStatus,
    Report,
    RolePermissionModel,
    SystemSetting,
    User,
    UserRole,
    UserSession,
    Zone,
)
from app.authz.permissions import Permission, HARD_DENY
from app.services.auth import hash_password, create_access_token
from app.api.admin import (
    list_admin_users,
    create_user,
    update_user_status,
    update_user_role,
    get_roles_permissions,
    toggle_role_permission,
    get_system_settings,
    update_system_settings,
    list_compliance_rules,
    create_compliance_rule,
    update_compliance_rule,
    get_contractor_profile,
    update_contractor_profile,
    get_system_health,
)
from app.api.reports import (
    generate_report,
    list_reports,
    get_report_detail,
    export_report_csv,
)
from app.schemas.admin import (
    ComplianceRuleCreate,
    ComplianceRuleUpdate,
    ContractorProfileUpdate,
    ReportCreateRequest,
    RolePermissionToggle,
    SlaThresholds,
    SystemSettingsUpdate,
    UserRoleUpdate,
    UserStatusUpdate,
)
from app.schemas.auth import AdminUserCreateRequest
from app.scheduler import _get_sla_thresholds
from fastapi import HTTPException

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []


def check(name: str, condition: bool, detail: str = ""):
    if condition:
        print(f"  {PASS} {name}")
        results.append((PASS, name))
    else:
        msg = f"  {FAIL} {name}"
        if detail:
            msg += f" — {detail}"
        print(msg)
        results.append((FAIL, name))


async def main():
    print("=" * 60)
    print("Phase 30 Super Admin Console & Reports Verification Suite")
    print("=" * 60)

    async with AsyncSessionLocal() as db:
        try:
            uid = uuid.uuid4().hex[:6]
            now = datetime.now(timezone.utc)

            # -------------------------------------------------------------
            # Setup: Create Test Site, Zone, Super Admin, Manager, Contractor
            # -------------------------------------------------------------
            site1 = MineSite(name=f"Site 30 Alpha-{uid}", location_name=f"Location Alpha-{uid}", lat=23.7, lng=86.4)
            site2 = MineSite(name=f"Site 30 Beta-{uid}", location_name=f"Location Beta-{uid}", lat=23.8, lng=86.5)
            db.add_all([site1, site2])
            await db.flush()

            zone = Zone(mine_site_id=site1.id, name=f"Zone-30-{uid}", zone_type="underground_extraction", risk_baseline=0.45)
            db.add(zone)
            await db.flush()

            super_admin = User(
                email=f"superadmin-30-{uid}@mine.internal",
                password_hash=hash_password("adminpass123"),
                full_name="Super Admin 30",
                role=UserRole.super_admin,
                is_active=True,
            )
            manager = User(
                email=f"manager-30-{uid}@mine.internal",
                password_hash=hash_password("mgrpass123"),
                full_name="Mine Manager 30",
                role=UserRole.mine_official,
                mine_site_id=site1.id,
                is_active=True,
            )
            contractor = User(
                email=f"contractor-30-{uid}@mine.internal",
                password_hash=hash_password("contractorpass123"),
                full_name="Contractor 30",
                role=UserRole.contractor,
                mine_site_id=site1.id,
                is_active=True,
            )
            db.add_all([super_admin, manager, contractor])
            await db.flush()

            # Create an active session for contractor
            sess = UserSession(
                id=uuid.uuid4(),
                jti=f"jti-{uid}-01",
                user_id=contractor.id,
                created_at=now,
                expires_at=now + timedelta(hours=1),
            )
            db.add(sess)
            await db.commit()

            # -------------------------------------------------------------
            # Test 1: User Lifecycle Administration & Self-Disable Lockout
            # -------------------------------------------------------------
            # 1a. Super admin attempts to disable their own account -> BLOCKED
            self_disable_blocked = False
            try:
                await update_user_status(
                    user_id=super_admin.id,
                    req=UserStatusUpdate(is_active=False),
                    db=db,
                    current_user=super_admin,
                )
            except HTTPException as e:
                if e.status_code == 400 and "Cannot disable currently logged-in account" in str(e.detail):
                    self_disable_blocked = True
            check("1a. Self-disable lockout guard blocks super admin from disabling own account", self_disable_blocked)

            # 1b. Super admin disables contractor account -> SUCCEEDS & revokes sessions
            res_disabled = await update_user_status(
                user_id=contractor.id,
                req=UserStatusUpdate(is_active=False),
                db=db,
                current_user=super_admin,
            )
            check("1b. Disabling user marks account inactive", res_disabled.is_active is False)

            # Verify session was revoked in DB
            sess_check = (await db.execute(select(UserSession).where(UserSession.user_id == contractor.id))).scalars().first()
            check("1c. Disabling user revokes active sessions", sess_check is not None and sess_check.revoked_at is not None)

            # Verify audit entry for USER_DISABLED
            audit_disabled = (await db.execute(select(AuditLog).where(AuditLog.action == "USER_DISABLED").order_by(AuditLog.id.desc()))).scalars().first()
            check("1d. Audit ledger records USER_DISABLED event", audit_disabled is not None and str(contractor.id) in audit_disabled.payload.get("user_id", ""))

            # 1e. Super admin reactivates contractor account -> SUCCEEDS
            res_activated = await update_user_status(
                user_id=contractor.id,
                req=UserStatusUpdate(is_active=True),
                db=db,
                current_user=super_admin,
            )
            check("1e. Reactivating user marks account active", res_activated.is_active is True)

            # 1f. Super admin attempts to demote own role -> BLOCKED
            self_demote_blocked = False
            try:
                await update_user_role(
                    user_id=super_admin.id,
                    req=UserRoleUpdate(role=UserRole.contractor),
                    db=db,
                    current_user=super_admin,
                )
            except HTTPException as e:
                if e.status_code == 400 and "Cannot demote currently logged-in super_admin" in str(e.detail):
                    self_demote_blocked = True
            check("1f. Self-demote lockout guard blocks super admin from demoting own account", self_demote_blocked)

            # -------------------------------------------------------------
            # Test 2: Dynamic Roles & Permissions Matrix
            # -------------------------------------------------------------
            # 2a. GET /admin/roles-permissions returns all 6 roles
            roles_meta = await get_roles_permissions(db=db, current_user=super_admin)
            check("2a. Roles & permissions matrix returns all 6 roles", len(roles_meta) == 6)

            # 2b. Attempting to grant HARD_DENY permission (ACTION_VERIFY to contractor) -> BLOCKED
            hard_deny_blocked = False
            try:
                await toggle_role_permission(
                    req=RolePermissionToggle(role=UserRole.contractor, permission=Permission.ACTION_VERIFY.value, granted=True),
                    db=db,
                    current_user=super_admin,
                )
            except HTTPException as e:
                if e.status_code == 400 and "permanently hard-denied" in str(e.detail):
                    hard_deny_blocked = True
            check("2b. HARD_DENY guard strictly blocks illegal permission grant", hard_deny_blocked)

            # 2c. Attempting to revoke critical governance permission from super_admin -> BLOCKED
            admin_lockout_blocked = False
            try:
                await toggle_role_permission(
                    req=RolePermissionToggle(role=UserRole.super_admin, permission=Permission.USER_CREATE.value, granted=False),
                    db=db,
                    current_user=super_admin,
                )
            except HTTPException as e:
                if e.status_code == 400 and "Cannot revoke critical governance permission" in str(e.detail):
                    admin_lockout_blocked = True
            check("2c. Lockout guard blocks revoking critical governance permission from super_admin", admin_lockout_blocked)

            # 2d. Legal permission toggle (grant REPORT_EXPORT to mine_official) -> SUCCEEDS & Audited
            toggle_res = await toggle_role_permission(
                req=RolePermissionToggle(role=UserRole.mine_official, permission=Permission.REPORT_EXPORT.value, granted=True),
                db=db,
                current_user=super_admin,
            )
            check("2d. Legal permission toggle executes successfully", toggle_res.get("status") == "success")

            audit_perm = (await db.execute(select(AuditLog).where(AuditLog.action == "PERMISSION_CHANGED").order_by(AuditLog.id.desc()))).scalars().first()
            check("2e. Audit ledger records PERMISSION_CHANGED event", audit_perm is not None and audit_perm.payload.get("permission") == Permission.REPORT_EXPORT.value)

            # -------------------------------------------------------------
            # Test 3: Governance Settings & Dynamic Scheduler Integration
            # -------------------------------------------------------------
            # 3a. Read system settings (defaults or previously persisted)
            settings_init = await get_system_settings(db=db, current_user=super_admin)
            check("3a. Read system settings returns valid SLA thresholds", settings_init.sla_thresholds.high_hours > 0)

            # 3b. Update system settings (custom SLA thresholds: 14h, 48h, 96h)
            new_sla = SlaThresholds(high_hours=14, medium_hours=48, low_hours=96)
            settings_updated = await update_system_settings(
                req=SystemSettingsUpdate(sla_thresholds=new_sla),
                db=db,
                current_user=super_admin,
            )
            check("3b. Update system settings persists new SLA values", settings_updated.sla_thresholds.high_hours == 14)

            audit_setting = (await db.execute(select(AuditLog).where(AuditLog.action == "SETTING_CHANGED").order_by(AuditLog.id.desc()))).scalars().first()
            check("3c. Audit ledger records SETTING_CHANGED event", audit_setting is not None and "sla_thresholds" in audit_setting.payload.get("updated_settings", {}))

            # 3d. Scheduler reads updated dynamic SLA thresholds
            sched_sla = await _get_sla_thresholds(db)
            check("3d. Scheduler reads updated dynamic SLA thresholds from system_settings", sched_sla == (14, 48, 96), f"Got: {sched_sla}")

            # -------------------------------------------------------------
            # Test 4: Compliance Rules Registry & Contractor Profiles
            # -------------------------------------------------------------
            rules_init = await list_compliance_rules(category=None, is_active=None, db=db, current_user=super_admin)
            check("4a. List compliance rules returns seeded regulations", len(rules_init) >= 5)

            new_rule = await create_compliance_rule(
                req=ComplianceRuleCreate(
                    category="safety",
                    code=f"DGMS-TEST-{uid}",
                    description="Continuous automated gas telemetry verification in longwall face",
                    default_severity="high",
                    statutory_ref="CMR 2017 Reg 115",
                ),
                db=db,
                current_user=super_admin,
            )
            check("4b. Create statutory compliance rule succeeds", new_rule.code == f"DGMS-TEST-{uid}")

            audit_rule_create = (await db.execute(select(AuditLog).where(AuditLog.action == "COMPLIANCE_RULE_CREATED").order_by(AuditLog.id.desc()))).scalars().first()
            check("4c. Audit ledger records COMPLIANCE_RULE_CREATED event", audit_rule_create is not None and audit_rule_create.payload.get("code") == f"DGMS-TEST-{uid}")

            updated_rule = await update_compliance_rule(
                rule_id=new_rule.id,
                req=ComplianceRuleUpdate(is_active=False),
                db=db,
                current_user=super_admin,
            )
            check("4d. Update compliance rule modifies active status", updated_rule.is_active is False)

            audit_rule_update = (await db.execute(select(AuditLog).where(AuditLog.action == "COMPLIANCE_RULE_UPDATED").order_by(AuditLog.id.desc()))).scalars().first()
            check("4e. Audit ledger records COMPLIANCE_RULE_UPDATED event", audit_rule_update is not None and audit_rule_update.payload.get("rule_id") == str(new_rule.id))

            # 4f. Contractor profile management
            c_profile = await update_contractor_profile(
                user_id=contractor.id,
                req=ContractorProfileUpdate(company_name="Apex Mining Remediation Corp", license_no=f"LIC-DGMS-{uid}"),
                db=db,
                current_user=super_admin,
            )
            audit_contractor = (await db.execute(select(AuditLog).where(AuditLog.action == "CONTRACTOR_PROFILE_UPDATED").order_by(AuditLog.id.desc()))).scalars().first()
            check("4f. Update contractor profile succeeds and is audited", c_profile.company_name == "Apex Mining Remediation Corp" and audit_contractor is not None)

            # -------------------------------------------------------------
            # Test 5: Statutory Reports Generation & CSV Export
            # -------------------------------------------------------------
            # Seed an observation for Site 1
            obs_report = Observation(
                inspector_id=super_admin.id,
                mine_site_id=site1.id,
                zone_id=zone.id,
                category=ObservationCategory.safety,
                description="Hazardous gas accumulation",
                edge_score=0.88,
                status=ObservationStatus.action_required,
                created_at=now,
            )
            db.add(obs_report)
            await db.commit()

            # 5a. Generate compliance_summary report
            rep_comp = await generate_report(
                req=ReportCreateRequest(type="compliance_summary", mine_site_id=site1.id),
                db=db,
                current_user=manager,
            )
            check("5a. Generate compliance summary report snapshot succeeds", rep_comp.payload.get("total_observations") >= 1)

            # 5b. Generate violations report
            rep_viol = await generate_report(
                req=ReportCreateRequest(type="violations", mine_site_id=site1.id),
                db=db,
                current_user=manager,
            )
            check("5b. Generate violations report snapshot captures high-risk hazards", rep_viol.payload.get("total_violations") >= 1)

            # 5c. Scope violation: Manager of Site 1 attempts to generate report for Site 2 -> FORBIDDEN
            scope_blocked = False
            try:
                await generate_report(
                    req=ReportCreateRequest(type="compliance_summary", mine_site_id=site2.id),
                    db=db,
                    current_user=manager,
                )
            except HTTPException as e:
                if e.status_code == 403:
                    scope_blocked = True
            check("5c. Scope guard blocks manager from generating report for foreign mine site", scope_blocked)

            # 5d. Export report to CSV
            csv_resp = await export_report_csv(
                report_id=rep_comp.id,
                format="csv",
                db=db,
                current_user=manager,
            )
            csv_text = csv_resp.body.decode("utf-8")
            check("5d. CSV export streams valid text/csv content", "REPORT TYPE,COMPLIANCE_SUMMARY" in csv_text)

            audit_export = (await db.execute(select(AuditLog).where(AuditLog.action == "REPORT_EXPORTED").order_by(AuditLog.id.desc()))).scalars().first()
            check("5e. Audit ledger records REPORT_EXPORTED event", audit_export is not None and audit_export.payload.get("report_id") == str(rep_comp.id))

            # 5f. GET /admin/system-health
            health = await get_system_health(db=db, current_user=super_admin)
            check("5f. System health returns database, scheduler and audit chain head", health.get("status") == "healthy" and health.get("audit_head", {}).get("entry_hash") is not None)

        except Exception as e:
            check("Phase 30 Execution", False, f"Exception: {e}")

    print("=" * 60)
    failed = [r for r in results if r[0] == FAIL]
    passed = [r for r in results if r[0] == PASS]
    print(f"Results: {len(passed)} PASSED, {len(failed)} FAILED")
    print("=" * 60)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
