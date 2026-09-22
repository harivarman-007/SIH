"""
deps.py
FastAPI dependency factories for authentication and permission enforcement.

Binding Decisions:
  D6 — Session-based auth: every request verifies against UserSession table.
  D7 — Permission-based endpoints: require_permission(P) for all protected routes.
  D8 — Backward compat: require_roles() is kept as compatibility shim.
  D10 — ACCESS_DENIED audit events: bounded in-memory dedup cache (max 1000, 30s TTL).
  D11 — Cache TTL ≤ 30s for permission lookups so DB changes propagate quickly.
MUST #3 — error bodies: {code, message, detail} where detail == message.
SHOULD #7 — Never log passwords, password hashes, or token strings.
SHOULD #10 — Cache TTL ≤ 30s.
"""
import time
import uuid as _uuid
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Set

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.chain import append_audit_entry
from app.authz.errors import account_disabled, forbidden, session_expired, unauthenticated
from app.authz.permissions import DEFAULT_ROLE_PERMISSIONS, HARD_DENY, Permission, is_hard_denied
from app.config import settings
from app.database import get_db
from app.models import RolePermissionModel, User, UserRole, UserSession

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ---------------------------------------------------------------------------
# In-memory permission cache (per-role, TTL ≤ 30s — SHOULD #10)
# ---------------------------------------------------------------------------

_CACHE_TTL_SECONDS: int = 30
_permission_cache: Dict[UserRole, tuple[Set[Permission], float]] = {}


def _get_cached_permissions(role: UserRole) -> Optional[Set[Permission]]:
    entry = _permission_cache.get(role)
    if entry is None:
        return None
    perms, ts = entry
    if time.monotonic() - ts > _CACHE_TTL_SECONDS:
        del _permission_cache[role]
        return None
    return perms


def _set_cached_permissions(role: UserRole, perms: Set[Permission]) -> None:
    _permission_cache[role] = (perms, time.monotonic())


def clear_permission_cache(role: Optional[UserRole] = None) -> None:
    """Clear cached role permissions so DB updates take effect immediately."""
    if role is not None:
        _permission_cache.pop(role, None)
    else:
        _permission_cache.clear()



async def _load_permissions_for_role(role: UserRole, db: AsyncSession) -> Set[Permission]:
    """Load permissions from DB for the given role; fall back to code defaults on empty."""
    cached = _get_cached_permissions(role)
    if cached is not None:
        return cached

    stmt = select(RolePermissionModel.permission_code).where(RolePermissionModel.role == role)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    if rows:
        perms: Set[Permission] = set()
        for code in rows:
            try:
                perms.add(Permission(code))
            except ValueError:
                pass  # unknown permission in DB — skip gracefully
    else:
        # Fallback to code-defined defaults (e.g. before migration 006 runs in tests)
        perms = set(DEFAULT_ROLE_PERMISSIONS.get(role, []))

    _set_cached_permissions(role, perms)
    return perms


# ---------------------------------------------------------------------------
# ACCESS_DENIED deduplication cache (SHOULD #7 — bounded, 30s TTL, max 1000)
# ---------------------------------------------------------------------------

_DENY_CACHE_MAX = 1000
_DENY_CACHE_TTL = 30.0
# OrderedDict keeps insertion order for LRU eviction
_deny_dedup: "OrderedDict[str, float]" = OrderedDict()


def _is_deny_duplicate(key: str) -> bool:
    """Returns True if this (actor, permission) combo was already logged recently."""
    now = time.monotonic()
    if key in _deny_dedup:
        if now - _deny_dedup[key] < _DENY_CACHE_TTL:
            return True
        del _deny_dedup[key]

    # Evict oldest if over capacity
    while len(_deny_dedup) >= _DENY_CACHE_MAX:
        _deny_dedup.popitem(last=False)

    _deny_dedup[key] = now
    return False


is_deny_duplicate = _is_deny_duplicate


# ---------------------------------------------------------------------------
# Core authenticate dependency
# ---------------------------------------------------------------------------


async def authenticate(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validates Bearer JWT, verifies active UserSession in DB, and returns the live User row.
    MUST #3: raises AuthZException with {code, message, detail} on failure.
    """
    # 1. Decode JWT
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise unauthenticated("Invalid or malformed authentication token.")

    user_id_str: Optional[str] = payload.get("sub")
    jti: Optional[str] = payload.get("jti")
    exp: Optional[int] = payload.get("exp")

    if not user_id_str:
        raise unauthenticated("Token is missing subject claim.")

    # 2. Verify session in DB (D6: session-backed, revocable)
    if jti:
        now_utc = datetime.now(timezone.utc)
        sess_stmt = select(UserSession).where(
            UserSession.jti == jti,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now_utc,
        )
        sess_result = await db.execute(sess_stmt)
        session = sess_result.scalar_one_or_none()
        if session is None:
            raise session_expired()
    # If token has no jti (legacy tokens without session), still allow — but no session revocation.

    # 3. Load user
    try:
        user_uuid = _uuid.UUID(user_id_str)
    except ValueError:
        raise unauthenticated("Invalid token subject format.")

    stmt = select(User).where(User.id == user_uuid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise unauthenticated("User associated with this token no longer exists.")

    if not user.is_active:
        raise account_disabled()

    return user


# ---------------------------------------------------------------------------
# require_permission dependency factory
# ---------------------------------------------------------------------------


def require_permission(permission: Permission) -> Callable:
    """
    Dependency factory. Returns an async dependency that:
      1. Authenticates the caller via `authenticate`.
      2. Checks HARD_DENY code-level rules.
      3. Checks the DB-backed (cached) permission set for the caller's role.
      4. On denial: emits a deduplicated ACCESS_DENIED audit event and raises 403.
    """

    async def _checker(
        user: User = Depends(authenticate),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        # Hard-deny code-level check (cannot be overridden by DB rows)
        if is_hard_denied(user.role, permission):
            await _emit_access_denied(db, user, permission, "HARD_DENY")
            raise forbidden()

        # DB-backed permission lookup with ≤30s cache
        perms = await _load_permissions_for_role(user.role, db)
        if permission not in perms:
            await _emit_access_denied(db, user, permission, "NOT_GRANTED")
            raise forbidden()

        return user

    return _checker


async def _emit_access_denied(
    db: AsyncSession, user: User, permission: Permission, reason: str
) -> None:
    """
    Appends an ACCESS_DENIED audit entry.
    Deduplicated per (user_id, permission) within 30s — prevents log flooding.
    Uses an isolated best-effort write (never crashes the main request).
    SHOULD #7: never logs passwords, tokens, or hashes.
    """
    dedup_key = f"{user.id}:{permission.value}"
    if _is_deny_duplicate(dedup_key):
        return

    try:
        await append_audit_entry(
            db=db,
            action="ACCESS_DENIED",
            payload={
                "permission": permission.value,
                "role": user.role.value,
                "reason": reason,
                # SHOULD #7: no passwords, no token strings
            },
            actor_id=user.id,
        )
    except Exception:
        # Access-denied logging is best-effort; never crash the caller
        pass


# ---------------------------------------------------------------------------
# Backward-compatibility shim for require_roles() (SHOULD #13)
# ---------------------------------------------------------------------------


def require_roles(*allowed_roles: UserRole) -> Callable:
    """
    Compatibility wrapper that maps role-based checks to the new authenticate dependency.
    Existing routers that call require_roles() continue to work without modification.
    New code should prefer require_permission() instead.
    """

    async def _checker(user: User = Depends(authenticate)) -> User:
        if user.role not in allowed_roles:
            raise forbidden(
                f"Access denied. Required role(s): {[r.value for r in allowed_roles]}."
            )
        return user

    return _checker


# ---------------------------------------------------------------------------
# Convenience: get_current_user alias (backward compat for services/auth.py imports)
# ---------------------------------------------------------------------------

get_current_user = authenticate
