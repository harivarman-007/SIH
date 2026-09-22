"""
auth.py — Authentication & Authorization API Router (Phase 24 update)

Phase 24 changes:
  - POST /auth/login: creates UserSession, records last_login_at, emits LOGIN_SUCCESS/LOGIN_FAILED
  - POST /auth/logout: idempotent session revocation, emits LOGOUT (SHOULD #11)
  - GET /auth/me: backward-compatible UserOut + permissions + scope (MUST #2)
  - POST /auth/admin/users: secured by require_permission(USER_CREATE) (SHOULD #11)
  - POST /auth/register: disabled unless settings.demo_mode == True (MUST #4)

MUST #3: error bodies {code, message, detail} where detail==message.
SHOULD #7: never log passwords or token strings.
"""
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.chain import append_audit_entry
from app.authz.deps import authenticate, is_deny_duplicate, require_permission, require_roles
from app.authz.errors import forbidden, unauthenticated
from app.authz.permissions import DEFAULT_ROLE_PERMISSIONS, Permission
from app.authz.scope import visible_mine_ids
from app.config import settings
from app.database import get_db
from app.models import CorporateMineAccess, User, UserRole, UserSession
from app.schemas.auth import (
    AccessDeniedReportRequest,
    AdminUserCreateRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.services.auth import (
    create_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Per-user rate limiter for access-denied reports (max 20 / minute)
_user_deny_counts: Dict[uuid.UUID, List[float]] = {}
_USER_DENY_RATE_LIMIT = 20
_USER_DENY_WINDOW = 60.0


def _check_user_deny_rate_limit(user_id: uuid.UUID) -> bool:
    """Returns True if within rate limit (max 20/min), False if exceeded."""
    now = time.monotonic()
    timestamps = _user_deny_counts.get(user_id, [])
    # Filter out timestamps older than window
    timestamps = [t for t in timestamps if now - t < _USER_DENY_WINDOW]
    if len(timestamps) >= _USER_DENY_RATE_LIMIT:
        _user_deny_counts[user_id] = timestamps
        return False
    timestamps.append(now)
    _user_deny_counts[user_id] = timestamps
    return True


def _make_jti() -> str:
    return uuid.uuid4().hex


async def _build_user_out(user: User, db: AsyncSession) -> UserOut:
    """
    Build backward-compatible UserOut with appended permissions and scope.
    MUST #2: all original UserOut fields stay at top level; permissions and scope are additive.
    """
    # Derive permissions list from DEFAULT_ROLE_PERMISSIONS (code-defined; DB cache handled by deps)
    perms: List[str] = [p.value for p in DEFAULT_ROLE_PERMISSIONS.get(user.role, [])]

    # Derive scope: mine_ids accessible to this user
    mine_ids = await visible_mine_ids(db, user)
    scope: Dict[str, Any] = {"mine_ids": [str(m) for m in mine_ids]}

    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        mine_site_id=user.mine_site_id,
        is_active=user.is_active,
        created_at=user.created_at,
        permissions=perms,
        scope=scope,
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    POST /auth/login
    Verifies credentials, creates a DB-backed UserSession, records last_login_at.
    Emits LOGIN_SUCCESS or LOGIN_FAILED audit events.
    SHOULD #7: never log password or token.
    """
    email_clean = req.email.lower().strip()
    stmt = select(User).where(User.email == email_clean)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        # Emit LOGIN_FAILED (rate-limiting / dedup handled at infra level for MVP)
        await append_audit_entry(
            db=db,
            action="LOGIN_FAILED",
            payload={"email": email_clean},  # SHOULD #7: no password
            actor_id=None,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHENTICATED",
                "message": "Invalid email or password.",
                "detail": "Invalid email or password.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCOUNT_DISABLED",
                "message": "This user account has been disabled. Contact system administrator.",
                "detail": "This user account has been disabled. Contact system administrator.",
            },
        )

    # Create UserSession
    jti = _make_jti()
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(minutes=settings.jwt_expire_minutes)
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    session = UserSession(
        id=uuid.uuid4(),
        jti=jti,
        user_id=user.id,
        ip=ip,
        user_agent=user_agent,
        created_at=now_utc,
        expires_at=expires_at,
    )
    db.add(session)

    # Record last_login_at
    user.last_login_at = now_utc

    await db.flush()

    # Create JWT with jti claim
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value, "jti": jti},
        expires_delta=timedelta(minutes=settings.jwt_expire_minutes),
    )

    await append_audit_entry(
        db=db,
        action="LOGIN_SUCCESS",
        payload={"email": user.email, "role": user.role.value},  # SHOULD #7: no token
        actor_id=user.id,
    )

    user_out = await _build_user_out(user, db)
    return TokenResponse(access_token=access_token, token_type="bearer", user=user_out)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: User = Depends(authenticate),
    db: AsyncSession = Depends(get_db),
):
    """
    POST /auth/logout
    Revokes all active sessions for the current user. Idempotent — safe to call multiple times.
    Emits LOGOUT audit event.
    SHOULD #11: idempotent.
    """
    now_utc = datetime.now(timezone.utc)
    stmt = select(UserSession).where(
        UserSession.user_id == current_user.id,
        UserSession.revoked_at.is_(None),
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()

    for sess in sessions:
        sess.revoked_at = now_utc

    await db.flush()

    await append_audit_entry(
        db=db,
        action="LOGOUT",
        payload={"sessions_revoked": len(sessions)},
        actor_id=current_user.id,
    )


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: User = Depends(authenticate),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /auth/me
    MUST #2: Returns all original UserOut fields at top level + permissions + scope.
    Backward-compatible — existing dashboard/mobile code reading any top-level field still works.
    """
    return await _build_user_out(current_user, db)


@router.post("/access-denied", status_code=status.HTTP_204_NO_CONTENT)
async def report_access_denied(
    req: AccessDeniedReportRequest,
    current_user: User = Depends(authenticate),
    db: AsyncSession = Depends(get_db),
):
    """
    POST /auth/access-denied
    MUST #6 & Phase 27 user directive:
    - User/role taken strictly from session.
    - Strips control characters and caps path to max 200 chars.
    - Per-user rate limit: max 20 per minute; excess returns 204 without writing to ledger.
    - Path deduplication via 30s TTL cache.
    - Writes ACCESS_DENIED audit entry.
    """
    # 1. Strip control characters and cap at 200 chars
    clean_path = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', req.path).strip()[:200]

    # 2. Check per-user rate limit (max 20/min) — excess returns 204 silently without writing
    if not _check_user_deny_rate_limit(current_user.id):
        return

    # 3. Path deduplication within 30s
    dedup_key = f"{current_user.id}:{clean_path}"
    if is_deny_duplicate(dedup_key):
        return

    try:
        await append_audit_entry(
            db=db,
            action="ACCESS_DENIED",
            payload={
                "path": clean_path,
                "role": current_user.role.value,
                "source": "frontend_guard",
            },
            actor_id=current_user.id,
        )
    except Exception:
        # Best-effort logging; never fail the request
        pass


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    POST /auth/register
    MUST #4: Only available when settings.demo_mode == True.
    Restricted to inspector/contractor roles (enforced by schema validator).
    """
    if not settings.demo_mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FORBIDDEN",
                "message": "Public self-registration is disabled. Contact your system administrator.",
                "detail": "Public self-registration is disabled. Contact your system administrator.",
            },
        )

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

    await append_audit_entry(
        db=db,
        action="user.registered",
        payload={
            "user_id": str(new_user.id),
            "email": new_user.email,
            "role": new_user.role.value,
            "mine_site_id": str(new_user.mine_site_id) if new_user.mine_site_id else None,
        },
        actor_id=new_user.id,
    )

    # Create session for the newly registered user
    jti = _make_jti()
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(minutes=settings.jwt_expire_minutes)
    session = UserSession(
        id=uuid.uuid4(),
        jti=jti,
        user_id=new_user.id,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        created_at=now_utc,
        expires_at=expires_at,
    )
    db.add(session)
    await db.flush()

    access_token = create_access_token(
        data={"sub": str(new_user.id), "email": new_user.email, "role": new_user.role.value, "jti": jti},
        expires_delta=timedelta(minutes=settings.jwt_expire_minutes),
    )

    user_out = await _build_user_out(new_user, db)
    return TokenResponse(access_token=access_token, token_type="bearer", user=user_out)


@router.post("/admin/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    req: AdminUserCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USER_CREATE)),
):
    """
    POST /auth/admin/users
    SHOULD #11: Secured by require_permission(USER_CREATE) — only super_admin has this.
    Enables creating users with any role.
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
        action="user.admin_created",
        payload={
            "user_id": str(new_user.id),
            "email": new_user.email,
            "role": new_user.role.value,
            "mine_site_id": str(new_user.mine_site_id) if new_user.mine_site_id else None,
            "created_by": str(current_user.id),
        },
        actor_id=current_user.id,
    )

    return await _build_user_out(new_user, db)


@router.get("/users", response_model=List[UserOut])
async def list_users(
    role: Optional[UserRole] = None,
    mine_site_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(authenticate),
):
    """
    GET /auth/users
    Lists active users, optionally filtered by role and mine site.
    Accessible to authenticated staff for task assignment.
    """
    stmt = select(User).where(User.is_active == True)
    if role:
        stmt = stmt.where(User.role == role)
    if mine_site_id:
        stmt = stmt.where(User.mine_site_id == mine_site_id)

    result = await db.execute(stmt)
    users = result.scalars().all()
    return [await _build_user_out(u, db) for u in users]

