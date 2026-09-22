"""
Intellifusion Authorization Package (RBAC Foundation).
"""
from app.authz.permissions import (
    DEFAULT_ROLE_PERMISSIONS,
    HARD_DENY,
    PERMISSIONS_REGISTRY,
    ROLE_LABELS,
    ROLE_ROUTE_PREFIXES,
    Permission,
    is_hard_denied,
    validate_admin_lockout,
)
from app.authz.deps import (
    authenticate,
    get_current_user,
    require_permission,
    require_roles,
)

__all__ = [
    "Permission",
    "PERMISSIONS_REGISTRY",
    "ROLE_LABELS",
    "ROLE_ROUTE_PREFIXES",
    "HARD_DENY",
    "DEFAULT_ROLE_PERMISSIONS",
    "is_hard_denied",
    "validate_admin_lockout",
    "authenticate",
    "get_current_user",
    "require_permission",
    "require_roles",
]
