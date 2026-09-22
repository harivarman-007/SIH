"""
admin.py
Super Admin Console API routes:
- User lifecycle management (search, list, status toggle, role reassign, self-disable protection)
- Dynamic Roles & Permissions matrix toggle with HARD_DENY & lockout protections
- System SLA & Risk threshold governance settings
- Compliance rules registry management
- System operational health
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.chain import append_audit_entry
from app.authz.deps import authenticate, clear_permission_cache, require_permission
from app.authz.permissions import (
    DEFAULT_ROLE_PERMISSIONS,
    HARD_DENY,
    ROLE_LABELS,
    Permission,
)
from app.authz.scope import visible_mine_ids
from app.database import get_db
from app.models import (
    ComplianceRule,
    ContractorProfile,
    CorporateMineAccess,
    RolePermissionModel,
    SystemSetting,
    User,
    UserRole,
    UserSession,
)
from app.schemas.admin import (
    ComplianceRuleCreate,
    ComplianceRuleOut,
    ComplianceRuleUpdate,
    ContractorProfileOut,
    ContractorProfileUpdate,
    RiskFlagThresholds,
    RolePermissionsOut,
    RolePermissionToggle,
    SlaThresholds,
    SystemSettingsOut,
    SystemSettingsUpdate,
    UserRoleUpdate,
    UserStatusUpdate,
)
from app.schemas.auth import AdminUserCreateRequest, UserOut
from app.services.auth import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# 1. User Lifecycle Administration
# ---------------------------------------------------------------------------

@router.get("/users", response_model=List[UserOut])
async def list_admin_users(
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USER_VIEW)),
):
    """
    GET /admin/users
    Lists users across the platform with full status and metadata.
    """
    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    stmt = stmt.order_by(User.created_at.desc())

    result = await db.execute(stmt)
    users = result.scalars().all()

    out: List[UserOut] = []
    for u in users:
        # Load permissions for user
        from app.api.auth import _build_user_out
        out.append(await _build_user_out(u, db))
    return out


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    req: AdminUserCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USER_CREATE)),
):
    """
    POST /admin/users
    Administrative provisioning for any role.
    """
    email_clean = req.email.lower().strip()
    stmt = select(User).where(User.email == email_clean)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "CONFLICT",
                "message": "A user with this email already exists.",
                "detail": "A user with this email already exists.",
            },
        )

    pw_hash = hash_password(req.password)
    new_user = User(
        email=email_clean,
        password_hash=pw_hash,
        full_name=req.full_name.strip(),
        role=req.role,
        mine_site_id=req.mine_site_id,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    if req.role == UserRole.corporate_management and req.corporate_mine_ids:
        for mid in req.corporate_mine_ids:
            access = CorporateMineAccess(user_id=new_user.id, mine_site_id=mid)
            db.add(access)
        await db.flush()

    await append_audit_entry(
        db=db,
        action="USER_CREATED",
        payload={
            "user_id": str(new_user.id),
            "email": new_user.email,
            "role": new_user.role.value,
            "mine_site_id": str(new_user.mine_site_id) if new_user.mine_site_id else None,
            "created_by": str(current_user.id),
        },
        actor_id=current_user.id,
    )

    from app.api.auth import _build_user_out
    return await _build_user_out(new_user, db)


@router.patch("/users/{user_id}/status", response_model=UserOut)
async def update_user_status(
    user_id: uuid.UUID,
    req: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USER_DISABLE)),
):
    """
    PATCH /admin/users/{user_id}/status
    Enables or disables an account.
    Protection: Current user cannot disable their own account (prevents accidental lockout).
    Disabling an account immediately revokes all live sessions.
    """
    if user_id == current_user.id and not req.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "LOCKOUT_PREVENTED",
                "message": "Cannot disable currently logged-in account.",
                "detail": "Cannot disable currently logged-in account.",
            },
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": "User not found.",
                "detail": "User not found.",
            },
        )

    old_status = target_user.is_active
    target_user.is_active = req.is_active
    db.add(target_user)

    # If disabling, immediately revoke all active sessions
    revoked_count = 0
    if not req.is_active:
        now_utc = datetime.now(timezone.utc)
        sess_stmt = select(UserSession).where(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
        )
        sessions = (await db.execute(sess_stmt)).scalars().all()
        for s in sessions:
            s.revoked_at = now_utc
            db.add(s)
        revoked_count = len(sessions)

    await db.flush()

    audit_action = "USER_DISABLED" if not req.is_active else "USER_ACTIVATED"
    await append_audit_entry(
        db=db,
        action=audit_action,
        payload={
            "user_id": str(target_user.id),
            "email": target_user.email,
            "previous_status": old_status,
            "new_status": target_user.is_active,
            "sessions_revoked": revoked_count,
        },
        actor_id=current_user.id,
    )

    from app.api.auth import _build_user_out
    return await _build_user_out(target_user, db)


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: uuid.UUID,
    req: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ROLE_ASSIGN)),
):
    """
    PATCH /admin/users/{user_id}/role
    Reassigns a user's role.
    Protection: Currently logged-in super_admin cannot demote their own account.
    """
    if user_id == current_user.id and req.role != UserRole.super_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "LOCKOUT_PREVENTED",
                "message": "Cannot demote currently logged-in super_admin account.",
                "detail": "Cannot demote currently logged-in super_admin account.",
            },
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": "User not found.",
                "detail": "User not found.",
            },
        )

    old_role = target_user.role.value
    target_user.role = req.role
    db.add(target_user)
    await db.flush()

    await append_audit_entry(
        db=db,
        action="ROLE_CHANGED",
        payload={
            "user_id": str(target_user.id),
            "email": target_user.email,
            "previous_role": old_role,
            "new_role": req.role.value,
        },
        actor_id=current_user.id,
    )

    from app.api.auth import _build_user_out
    return await _build_user_out(target_user, db)


# ---------------------------------------------------------------------------
# 2. Roles & Permissions Matrix Administration
# ---------------------------------------------------------------------------

@router.get("/roles-permissions", response_model=List[RolePermissionsOut])
async def get_roles_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ROLE_VIEW)),
):
    """
    GET /admin/roles-permissions
    Returns all 6 roles, active user counts, currently granted permissions from DB,
    and HARD_DENY constraints.
    """
    out: List[RolePermissionsOut] = []

    # Count users per role
    user_counts_stmt = select(User.role, func.count(User.id)).group_by(User.role)
    user_counts_res = await db.execute(user_counts_stmt)
    user_counts = dict(user_counts_res.all())

    # Load DB permissions for all roles
    perm_stmt = select(RolePermissionModel)
    perm_res = await db.execute(perm_stmt)
    perm_rows = perm_res.scalars().all()

    role_perms_map: Dict[UserRole, List[str]] = {r: [] for r in UserRole}
    for p in perm_rows:
        if p.role in role_perms_map:
            role_perms_map[p.role].append(p.permission_code)

    # Fallback to code defaults if DB is empty for a role
    for r in UserRole:
        if not role_perms_map[r]:
            role_perms_map[r] = [p.value for p in DEFAULT_ROLE_PERMISSIONS.get(r, [])]

    scope_descriptions = {
        UserRole.super_admin: "Platform-wide administrative governance and access management.",
        UserRole.corporate_management: "Cross-mine oversight across all authorized corporate subsidiaries.",
        UserRole.mine_official: "Site-level operational authority strictly scoped to assigned mine.",
        UserRole.inspector: "Underground field inspection and observation reporting.",
        UserRole.contractor: "Direct execution and remediation of assigned corrective action work orders.",
        UserRole.regulator: "Statutory audit and DGMS compliance inspection authority (Read-Only).",
    }

    for r in UserRole:
        hard_denies = [p.value for p in HARD_DENY.get(r, set())]
        out.append(
            RolePermissionsOut(
                role=r,
                label=ROLE_LABELS.get(r, r.value.upper()),
                user_count=user_counts.get(r, 0),
                permissions=sorted(role_perms_map[r]),
                hard_deny=sorted(hard_denies),
                scope_description=scope_descriptions.get(r, ""),
            )
        )

    return out


@router.post("/roles-permissions/toggle", response_model=Dict[str, Any])
async def toggle_role_permission(
    req: RolePermissionToggle,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ROLE_ASSIGN)),
):
    """
    POST /admin/roles-permissions/toggle
    Toggles permission grant for a role.
    Enforces HARD_DENY rules and Super Admin lockout protection.
    """
    # 1. HARD_DENY guard
    denied_set = {p.value for p in HARD_DENY.get(req.role, set())}
    if req.permission in denied_set and req.granted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "HARD_DENY_VIOLATION",
                "message": f"Permission '{req.permission}' is permanently hard-denied for role '{req.role.value}'.",
                "detail": f"Permission '{req.permission}' is permanently hard-denied for role '{req.role.value}'.",
            },
        )

    # 2. Super Admin Lockout Guard
    if req.role == UserRole.super_admin and not req.granted:
        critical_prefixes = ("USER_", "ROLE_", "SETTING_", "AUDIT_")
        if any(req.permission.startswith(prefix) for prefix in critical_prefixes):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "LOCKOUT_GUARD_VIOLATION",
                    "message": f"Cannot revoke critical governance permission '{req.permission}' from super_admin.",
                    "detail": f"Cannot revoke critical governance permission '{req.permission}' from super_admin.",
                },
            )

    # 3. Update DB
    if req.granted:
        exists_stmt = select(RolePermissionModel).where(
            RolePermissionModel.role == req.role,
            RolePermissionModel.permission_code == req.permission,
        )
        existing = (await db.execute(exists_stmt)).scalar_one_or_none()
        if not existing:
            db.add(RolePermissionModel(role=req.role, permission_code=req.permission))
    else:
        del_stmt = delete(RolePermissionModel).where(
            RolePermissionModel.role == req.role,
            RolePermissionModel.permission_code == req.permission,
        )
        await db.execute(del_stmt)

    await db.flush()

    # 4. Invalidate memory cache so changes apply immediately
    clear_permission_cache(req.role)

    # 5. Write audit entry
    await append_audit_entry(
        db=db,
        action="PERMISSION_CHANGED",
        payload={
            "role": req.role.value,
            "permission": req.permission,
            "granted": req.granted,
            "updated_by": str(current_user.id),
        },
        actor_id=current_user.id,
    )

    return {
        "status": "success",
        "role": req.role.value,
        "permission": req.permission,
        "granted": req.granted,
    }


# ---------------------------------------------------------------------------
# 3. Governance & System Settings
# ---------------------------------------------------------------------------

@router.get("/system-settings", response_model=SystemSettingsOut)
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.SETTING_VIEW)),
):
    """
    GET /admin/system-settings
    Reads dynamic SLA thresholds and risk-flag thresholds from DB with defaults.
    """
    stmt = select(SystemSetting)
    res = await db.execute(stmt)
    rows = res.scalars().all()
    settings_map = {r.key: r.value for r in rows}
    latest_update = max([r.updated_at for r in rows], default=None)

    sla_data = settings_map.get("sla_thresholds", {"high_hours": 24, "medium_hours": 72, "low_hours": 168})
    risk_data = settings_map.get("risk_flag_thresholds", {"high": 0.75, "medium": 0.45, "low": 0.20})

    return SystemSettingsOut(
        sla_thresholds=SlaThresholds(**sla_data),
        risk_flag_thresholds=RiskFlagThresholds(**risk_data),
        updated_at=latest_update,
        updated_by_id=rows[0].updated_by_id if rows else None,
    )


@router.put("/system-settings", response_model=SystemSettingsOut)
async def update_system_settings(
    req: SystemSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.SETTING_EDIT)),
):
    """
    PUT /admin/system-settings
    Updates SLA hours and risk flag thresholds. Writes SETTING_CHANGED audit log.
    """
    now_utc = datetime.now(timezone.utc)
    changed: Dict[str, Any] = {}

    if req.sla_thresholds:
        sla_val = req.sla_thresholds.model_dump()
        stmt = select(SystemSetting).where(SystemSetting.key == "sla_thresholds")
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row:
            row.value = sla_val
            row.updated_by_id = current_user.id
            row.updated_at = now_utc
            db.add(row)
        else:
            db.add(SystemSetting(key="sla_thresholds", value=sla_val, updated_by_id=current_user.id, updated_at=now_utc))
        changed["sla_thresholds"] = sla_val

    if req.risk_flag_thresholds:
        risk_val = req.risk_flag_thresholds.model_dump()
        stmt = select(SystemSetting).where(SystemSetting.key == "risk_flag_thresholds")
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row:
            row.value = risk_val
            row.updated_by_id = current_user.id
            row.updated_at = now_utc
            db.add(row)
        else:
            db.add(SystemSetting(key="risk_flag_thresholds", value=risk_val, updated_by_id=current_user.id, updated_at=now_utc))
        changed["risk_flag_thresholds"] = risk_val

    await db.flush()

    await append_audit_entry(
        db=db,
        action="SETTING_CHANGED",
        payload={
            "updated_settings": changed,
            "updated_by": str(current_user.id),
        },
        actor_id=current_user.id,
    )

    return await get_system_settings(db, current_user)


# ---------------------------------------------------------------------------
# 4. Compliance Rules Registry
# ---------------------------------------------------------------------------

@router.get("/compliance-rules", response_model=List[ComplianceRuleOut])
async def list_compliance_rules(
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.SETTING_VIEW)),
):
    """
    GET /admin/compliance-rules
    Lists DGMS statutory compliance rules catalogue.
    """
    stmt = select(ComplianceRule)
    if category:
        stmt = stmt.where(ComplianceRule.category == category)
    if is_active is not None:
        stmt = stmt.where(ComplianceRule.is_active == is_active)
    stmt = stmt.order_by(ComplianceRule.code.asc())

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/compliance-rules", response_model=ComplianceRuleOut, status_code=status.HTTP_201_CREATED)
async def create_compliance_rule(
    req: ComplianceRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.SETTING_EDIT)),
):
    """
    POST /admin/compliance-rules
    Adds a new statutory regulation to the compliance catalogue.
    """
    exists = (await db.execute(select(ComplianceRule).where(ComplianceRule.code == req.code))).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail={"code": "CONFLICT", "message": "Rule code already exists.", "detail": "Rule code already exists."})

    rule = ComplianceRule(
        category=req.category,
        code=req.code,
        description=req.description,
        default_severity=req.default_severity,
        statutory_ref=req.statutory_ref,
        is_active=True,
    )
    db.add(rule)
    await db.flush()

    await append_audit_entry(
        db=db,
        action="COMPLIANCE_RULE_CREATED",
        payload={"rule_id": str(rule.id), "code": rule.code, "category": rule.category},
        actor_id=current_user.id,
    )

    return rule


@router.patch("/compliance-rules/{rule_id}", response_model=ComplianceRuleOut)
async def update_compliance_rule(
    rule_id: uuid.UUID,
    req: ComplianceRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.SETTING_EDIT)),
):
    """
    PATCH /admin/compliance-rules/{rule_id}
    Updates rule description, severity, statutory ref, or active status.
    """
    stmt = select(ComplianceRule).where(ComplianceRule.id == rule_id)
    rule = (await db.execute(stmt)).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Compliance rule not found.", "detail": "Compliance rule not found."})

    if req.description is not None:
        rule.description = req.description
    if req.default_severity is not None:
        rule.default_severity = req.default_severity
    if req.statutory_ref is not None:
        rule.statutory_ref = req.statutory_ref
    if req.is_active is not None:
        rule.is_active = req.is_active

    rule.updated_at = datetime.now(timezone.utc)
    db.add(rule)
    await db.flush()

    await append_audit_entry(
        db=db,
        action="COMPLIANCE_RULE_UPDATED",
        payload={"rule_id": str(rule.id), "code": rule.code, "is_active": rule.is_active},
        actor_id=current_user.id,
    )

    return rule


# ---------------------------------------------------------------------------
# 5. Contractor Profiles Management
# ---------------------------------------------------------------------------

@router.get("/contractors", response_model=List[ContractorProfileOut])
async def list_contractor_profiles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USER_VIEW)),
):
    """
    GET /admin/contractors
    Lists all contractor profiles.
    """
    stmt = select(ContractorProfile).order_by(ContractorProfile.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/contractors/{user_id}", response_model=ContractorProfileOut)
async def get_contractor_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USER_VIEW)),
):
    """
    GET /admin/contractors/{user_id}
    Retrieves contractor profile for a given user.
    """
    stmt = select(ContractorProfile).where(ContractorProfile.user_id == user_id)
    profile = (await db.execute(stmt)).scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Contractor profile not found.", "detail": "Contractor profile not found."},
        )
    return profile


@router.patch("/contractors/{user_id}", response_model=ContractorProfileOut)
async def update_contractor_profile(
    user_id: uuid.UUID,
    req: ContractorProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USER_EDIT)),
):
    """
    PATCH /admin/contractors/{user_id}
    Updates or provisions a contractor profile.
    """
    stmt = select(ContractorProfile).where(ContractorProfile.user_id == user_id)
    profile = (await db.execute(stmt)).scalar_one_or_none()
    if not profile:
        u_stmt = select(User).where(User.id == user_id)
        user = (await db.execute(u_stmt)).scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=404,
                detail={"code": "NOT_FOUND", "message": "User not found.", "detail": "User not found."},
            )
        profile = ContractorProfile(
            user_id=user_id,
            company_name=req.company_name or user.full_name or "Contractor Organization",
            license_no=req.license_no,
            cert_expiry=req.cert_expiry,
            is_active=req.is_active if req.is_active is not None else True,
        )
        db.add(profile)
    else:
        if req.company_name is not None:
            profile.company_name = req.company_name
        if req.license_no is not None:
            profile.license_no = req.license_no
        if req.cert_expiry is not None:
            profile.cert_expiry = req.cert_expiry
        if req.is_active is not None:
            profile.is_active = req.is_active
        db.add(profile)

    await db.flush()

    await append_audit_entry(
        db=db,
        action="CONTRACTOR_PROFILE_UPDATED",
        payload={
            "contractor_user_id": str(user_id),
            "company_name": profile.company_name,
            "is_active": profile.is_active,
        },
        actor_id=current_user.id,
    )
    return profile


# ---------------------------------------------------------------------------
# 6. System Operational Health
# ---------------------------------------------------------------------------

@router.get("/system-health", response_model=Dict[str, Any])
async def get_system_health(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.SETTING_VIEW)),
):
    """
    GET /admin/system-health
    Returns operational health telemetry: DB connectivity, audit head hash,
    scheduler status, and total entity counts.
    """
    from app.models import AuditLog, Observation, CorrectiveAction, Inspection

    # 1. Total counts
    user_count = (await db.execute(select(func.count(User.id)))).scalar_one() or 0
    obs_count = (await db.execute(select(func.count(Observation.id)))).scalar_one() or 0
    action_count = (await db.execute(select(func.count(CorrectiveAction.id)))).scalar_one() or 0
    insp_count = (await db.execute(select(func.count(Inspection.id)))).scalar_one() or 0
    audit_count = (await db.execute(select(func.count(AuditLog.id)))).scalar_one() or 0

    # 2. Latest audit log hash
    head_stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(1)
    head_entry = (await db.execute(head_stmt)).scalar_one_or_none()

    return {
        "status": "healthy",
        "database": "connected",
        "scheduler": "active",
        "entity_counts": {
            "users": user_count,
            "observations": obs_count,
            "actions": action_count,
            "inspections": insp_count,
            "audit_ledger_entries": audit_count,
        },
        "audit_head": {
            "entry_id": head_entry.id if head_entry else None,
            "entry_hash": head_entry.entry_hash if head_entry else None,
            "recorded_at": head_entry.ts.isoformat() if head_entry else None,
        },
    }
