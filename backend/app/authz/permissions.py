"""
permissions.py
Code-defined registry of permissions, role labels, default matrix, and hard-deny rules.
Binding Decisions: D1, D2, D3, D4, D9, D12.
"""
import enum
from typing import Dict, List, NamedTuple, Set

from app.models import UserRole


class Permission(str, enum.Enum):
    # Inspection permissions
    INSPECTION_VIEW = "INSPECTION_VIEW"
    INSPECTION_CREATE = "INSPECTION_CREATE"
    INSPECTION_ASSIGN = "INSPECTION_ASSIGN"
    INSPECTION_START = "INSPECTION_START"
    INSPECTION_SUBMIT = "INSPECTION_SUBMIT"
    INSPECTION_CANCEL = "INSPECTION_CANCEL"

    # Observation permissions
    OBSERVATION_VIEW = "OBSERVATION_VIEW"
    OBSERVATION_CREATE = "OBSERVATION_CREATE"
    OBSERVATION_REVIEW = "OBSERVATION_REVIEW"
    OBSERVATION_CLOSE = "OBSERVATION_CLOSE"

    # Risk & Anomaly permissions
    RISK_VIEW = "RISK_VIEW"
    RISK_ESCALATE = "RISK_ESCALATE"

    # Corrective Action permissions
    ACTION_VIEW = "ACTION_VIEW"
    ACTION_CREATE = "ACTION_CREATE"
    ACTION_ACCEPT = "ACTION_ACCEPT"
    ACTION_START = "ACTION_START"
    ACTION_PROGRESS = "ACTION_PROGRESS"
    ACTION_SUBMIT = "ACTION_SUBMIT"
    ACTION_VERIFY = "ACTION_VERIFY"
    ACTION_REJECT = "ACTION_REJECT"

    # Evidence permissions
    EVIDENCE_VIEW = "EVIDENCE_VIEW"
    EVIDENCE_UPLOAD = "EVIDENCE_UPLOAD"

    # Audit permissions
    AUDIT_VIEW = "AUDIT_VIEW"
    AUDIT_VERIFY = "AUDIT_VERIFY"
    AUDIT_EXPORT = "AUDIT_EXPORT"

    # KPI & Reporting permissions
    KPI_VIEW = "KPI_VIEW"
    REPORT_VIEW = "REPORT_VIEW"
    REPORT_CREATE = "REPORT_CREATE"
    REPORT_EXPORT = "REPORT_EXPORT"

    # Document OCR permissions
    OCR_SUBMIT = "OCR_SUBMIT"
    OCR_QUEUE_VIEW = "OCR_QUEUE_VIEW"
    OCR_REVIEW = "OCR_REVIEW"

    # Alerts & Notifications
    ALERT_VIEW = "ALERT_VIEW"
    ALERT_DISMISS = "ALERT_DISMISS"

    # User & Access Management
    USER_VIEW = "USER_VIEW"
    USER_CREATE = "USER_CREATE"
    USER_EDIT = "USER_EDIT"
    USER_DISABLE = "USER_DISABLE"

    # Role & Permissions Administration
    ROLE_VIEW = "ROLE_VIEW"
    ROLE_ASSIGN = "ROLE_ASSIGN"

    # Governance & System Settings
    SETTING_VIEW = "SETTING_VIEW"
    SETTING_EDIT = "SETTING_EDIT"


class PermissionMeta(NamedTuple):
    code: str
    description: str
    resource: str
    operation: str


PERMISSIONS_REGISTRY: Dict[Permission, PermissionMeta] = {
    Permission.INSPECTION_VIEW: PermissionMeta(
        Permission.INSPECTION_VIEW.value, "View scheduled and active mine inspections", "inspections", "read"
    ),
    Permission.INSPECTION_CREATE: PermissionMeta(
        Permission.INSPECTION_CREATE.value, "Create and schedule mine inspections", "inspections", "create"
    ),
    Permission.INSPECTION_ASSIGN: PermissionMeta(
        Permission.INSPECTION_ASSIGN.value, "Assign inspections to field inspectors", "inspections", "assign"
    ),
    Permission.INSPECTION_START: PermissionMeta(
        Permission.INSPECTION_START.value, "Begin assigned field inspection", "inspections", "execute"
    ),
    Permission.INSPECTION_SUBMIT: PermissionMeta(
        Permission.INSPECTION_SUBMIT.value, "Submit completed inspection for review", "inspections", "submit"
    ),
    Permission.INSPECTION_CANCEL: PermissionMeta(
        Permission.INSPECTION_CANCEL.value, "Cancel a scheduled inspection", "inspections", "cancel"
    ),
    Permission.OBSERVATION_VIEW: PermissionMeta(
        Permission.OBSERVATION_VIEW.value, "View compliance observations and hazards", "observations", "read"
    ),
    Permission.OBSERVATION_CREATE: PermissionMeta(
        Permission.OBSERVATION_CREATE.value, "Record new compliance observation or hazard", "observations", "create"
    ),
    Permission.OBSERVATION_REVIEW: PermissionMeta(
        Permission.OBSERVATION_REVIEW.value, "Review observation and determine corrective path", "observations", "review"
    ),
    Permission.OBSERVATION_CLOSE: PermissionMeta(
        Permission.OBSERVATION_CLOSE.value, "Close observation with verified resolution note", "observations", "close"
    ),
    Permission.RISK_VIEW: PermissionMeta(
        Permission.RISK_VIEW.value, "View AI and edge hazard risk evaluations", "risk", "read"
    ),
    Permission.RISK_ESCALATE: PermissionMeta(
        Permission.RISK_ESCALATE.value, "Manually escalate critical hazard priority", "risk", "escalate"
    ),
    Permission.ACTION_VIEW: PermissionMeta(
        Permission.ACTION_VIEW.value, "View assigned corrective action work orders", "actions", "read"
    ),
    Permission.ACTION_CREATE: PermissionMeta(
        Permission.ACTION_CREATE.value, "Create and assign corrective action to contractor", "actions", "create"
    ),
    Permission.ACTION_ACCEPT: PermissionMeta(
        Permission.ACTION_ACCEPT.value, "Accept assigned corrective action work order", "actions", "accept"
    ),
    Permission.ACTION_START: PermissionMeta(
        Permission.ACTION_START.value, "Commence work on corrective action", "actions", "start"
    ),
    Permission.ACTION_PROGRESS: PermissionMeta(
        Permission.ACTION_PROGRESS.value, "Update progress on active corrective action", "actions", "update"
    ),
    Permission.ACTION_SUBMIT: PermissionMeta(
        Permission.ACTION_SUBMIT.value, "Submit completed action with evidence for review", "actions", "submit"
    ),
    Permission.ACTION_VERIFY: PermissionMeta(
        Permission.ACTION_VERIFY.value, "Verify completion evidence and approve closure", "actions", "verify"
    ),
    Permission.ACTION_REJECT: PermissionMeta(
        Permission.ACTION_REJECT.value, "Reject insufficient work evidence with mandatory reason", "actions", "reject"
    ),
    Permission.EVIDENCE_VIEW: PermissionMeta(
        Permission.EVIDENCE_VIEW.value, "Inspect photo and document evidence attachments", "evidence", "read"
    ),
    Permission.EVIDENCE_UPLOAD: PermissionMeta(
        Permission.EVIDENCE_UPLOAD.value, "Upload before/after work proof and geo-stamped photos", "evidence", "upload"
    ),
    Permission.AUDIT_VIEW: PermissionMeta(
        Permission.AUDIT_VIEW.value, "View cryptographic audit ledger entries", "audit", "read"
    ),
    Permission.AUDIT_VERIFY: PermissionMeta(
        Permission.AUDIT_VERIFY.value, "Verify SHA-256 hash-chain integrity mathematically", "audit", "verify"
    ),
    Permission.AUDIT_EXPORT: PermissionMeta(
        Permission.AUDIT_EXPORT.value, "Export certified statutory audit logs", "audit", "export"
    ),
    Permission.KPI_VIEW: PermissionMeta(
        Permission.KPI_VIEW.value, "View compliance metrics, trends, and risk scores", "kpi", "read"
    ),
    Permission.REPORT_VIEW: PermissionMeta(
        Permission.REPORT_VIEW.value, "View compliance and incident summary reports", "reports", "read"
    ),
    Permission.REPORT_CREATE: PermissionMeta(
        Permission.REPORT_CREATE.value, "Generate statutory compliance snapshot report", "reports", "create"
    ),
    Permission.REPORT_EXPORT: PermissionMeta(
        Permission.REPORT_EXPORT.value, "Export statutory reports in standard formats", "reports", "export"
    ),
    Permission.OCR_SUBMIT: PermissionMeta(
        Permission.OCR_SUBMIT.value, "Upload paper log sheet for OCR digitization", "ocr", "submit"
    ),
    Permission.OCR_QUEUE_VIEW: PermissionMeta(
        Permission.OCR_QUEUE_VIEW.value, "View pending OCR human verification queue", "ocr", "read"
    ),
    Permission.OCR_REVIEW: PermissionMeta(
        Permission.OCR_REVIEW.value, "Approve or correct low-confidence OCR text", "ocr", "review"
    ),
    Permission.ALERT_VIEW: PermissionMeta(
        Permission.ALERT_VIEW.value, "View in-app statutory escalation notifications", "alerts", "read"
    ),
    Permission.ALERT_DISMISS: PermissionMeta(
        Permission.ALERT_DISMISS.value, "Mark alerts as read or acknowledged", "alerts", "update"
    ),
    Permission.USER_VIEW: PermissionMeta(
        Permission.USER_VIEW.value, "View user directories and authorized personnel", "users", "read"
    ),
    Permission.USER_CREATE: PermissionMeta(
        Permission.USER_CREATE.value, "Create new authorized user accounts", "users", "create"
    ),
    Permission.USER_EDIT: PermissionMeta(
        Permission.USER_EDIT.value, "Modify user details and account status", "users", "update"
    ),
    Permission.USER_DISABLE: PermissionMeta(
        Permission.USER_DISABLE.value, "Deactivate or revoke user access", "users", "disable"
    ),
    Permission.ROLE_VIEW: PermissionMeta(
        Permission.ROLE_VIEW.value, "View role definitions and permission mappings", "roles", "read"
    ),
    Permission.ROLE_ASSIGN: PermissionMeta(
        Permission.ROLE_ASSIGN.value, "Assign system roles to user accounts", "roles", "assign"
    ),
    Permission.SETTING_VIEW: PermissionMeta(
        Permission.SETTING_VIEW.value, "View governance parameters and SLA configurations", "settings", "read"
    ),
    Permission.SETTING_EDIT: PermissionMeta(
        Permission.SETTING_EDIT.value, "Update SLA thresholds and platform settings", "settings", "update"
    ),
}

# Role display names and URL route prefixes per Binding Decision D1
ROLE_LABELS: Dict[UserRole, str] = {
    UserRole.super_admin: "SUPER_ADMIN",
    UserRole.corporate_management: "CORPORATE_MANAGER",
    UserRole.mine_official: "MINE_MANAGER",
    UserRole.inspector: "FIELD_INSPECTOR",
    UserRole.contractor: "CONTRACTOR",
    UserRole.regulator: "REGULATORY_AUTHORITY",
}

ROLE_ROUTE_PREFIXES: Dict[UserRole, str] = {
    UserRole.super_admin: "/admin",
    UserRole.corporate_management: "/corporate",
    UserRole.mine_official: "/manager",
    UserRole.inspector: "/inspector",
    UserRole.contractor: "/contractor",
    UserRole.regulator: "/regulator",
}

# Code-level HARD_DENY map (Decision D3, D9, D12)
# These permissions can NEVER be granted to the specified role, even if a database row exists.
HARD_DENY: Dict[UserRole, Set[Permission]] = {
    UserRole.contractor: {
        Permission.ACTION_VERIFY,
        Permission.ACTION_REJECT,
        Permission.ACTION_CREATE,
        Permission.OBSERVATION_REVIEW,
        Permission.OBSERVATION_CLOSE,
        Permission.INSPECTION_CREATE,
        Permission.INSPECTION_ASSIGN,
        Permission.INSPECTION_CANCEL,
        Permission.OCR_REVIEW,
        Permission.USER_CREATE,
        Permission.USER_EDIT,
        Permission.USER_DISABLE,
        Permission.ROLE_ASSIGN,
        Permission.SETTING_EDIT,
        Permission.AUDIT_VERIFY,
    },
    UserRole.inspector: {
        Permission.ACTION_VERIFY,
        Permission.ACTION_REJECT,
        Permission.ACTION_CREATE,
        Permission.OBSERVATION_CLOSE,
        Permission.INSPECTION_CREATE,
        Permission.INSPECTION_ASSIGN,
        Permission.INSPECTION_CANCEL,
        Permission.OCR_REVIEW,
        Permission.USER_CREATE,
        Permission.USER_EDIT,
        Permission.USER_DISABLE,
        Permission.ROLE_ASSIGN,
        Permission.SETTING_EDIT,
    },
    UserRole.super_admin: {
        # Super Admin is not an operator (Decision D9)
        Permission.ACTION_VERIFY,
        Permission.ACTION_REJECT,
        Permission.ACTION_ACCEPT,
        Permission.ACTION_START,
        Permission.ACTION_PROGRESS,
        Permission.ACTION_SUBMIT,
        Permission.OBSERVATION_CLOSE,
        Permission.OBSERVATION_REVIEW,
        Permission.INSPECTION_START,
        Permission.INSPECTION_SUBMIT,
    },
    UserRole.corporate_management: {
        Permission.ACTION_VERIFY,
        Permission.ACTION_REJECT,
        Permission.ACTION_ACCEPT,
        Permission.ACTION_START,
        Permission.ACTION_PROGRESS,
        Permission.ACTION_SUBMIT,
        Permission.OBSERVATION_CLOSE,
        Permission.INSPECTION_START,
        Permission.INSPECTION_SUBMIT,
        Permission.USER_CREATE,
        Permission.USER_EDIT,
        Permission.USER_DISABLE,
        Permission.ROLE_ASSIGN,
        Permission.SETTING_EDIT,
    },
    UserRole.regulator: {
        Permission.ACTION_VERIFY,
        Permission.ACTION_REJECT,
        Permission.ACTION_ACCEPT,
        Permission.ACTION_START,
        Permission.ACTION_PROGRESS,
        Permission.ACTION_SUBMIT,
        Permission.OBSERVATION_CLOSE,
        Permission.INSPECTION_START,
        Permission.INSPECTION_SUBMIT,
        Permission.USER_CREATE,
        Permission.USER_EDIT,
        Permission.USER_DISABLE,
        Permission.ROLE_ASSIGN,
        Permission.SETTING_EDIT,
    },
    UserRole.mine_official: {
        Permission.USER_CREATE,
        Permission.USER_EDIT,
        Permission.USER_DISABLE,
        Permission.ROLE_ASSIGN,
        Permission.SETTING_EDIT,
    },
}

# Default role -> permissions matrix for database seeding and runtime fallback
DEFAULT_ROLE_PERMISSIONS: Dict[UserRole, List[Permission]] = {
    UserRole.super_admin: [
        Permission.USER_VIEW,
        Permission.USER_CREATE,
        Permission.USER_EDIT,
        Permission.USER_DISABLE,
        Permission.ROLE_VIEW,
        Permission.ROLE_ASSIGN,
        Permission.SETTING_VIEW,
        Permission.SETTING_EDIT,
        Permission.AUDIT_VIEW,
        Permission.AUDIT_VERIFY,
        Permission.AUDIT_EXPORT,
        Permission.KPI_VIEW,
        Permission.REPORT_VIEW,
        Permission.REPORT_CREATE,
        Permission.REPORT_EXPORT,
        Permission.OBSERVATION_VIEW,
        Permission.INSPECTION_VIEW,
        Permission.ACTION_VIEW,
        Permission.ALERT_VIEW,
        Permission.ALERT_DISMISS,
        Permission.OCR_QUEUE_VIEW,
    ],
    UserRole.corporate_management: [
        Permission.OBSERVATION_VIEW,
        Permission.RISK_VIEW,
        Permission.RISK_ESCALATE,
        Permission.INSPECTION_VIEW,
        Permission.ACTION_VIEW,
        Permission.EVIDENCE_VIEW,
        Permission.KPI_VIEW,
        Permission.REPORT_VIEW,
        Permission.REPORT_EXPORT,
        Permission.AUDIT_VIEW,
        Permission.AUDIT_EXPORT,
        Permission.ALERT_VIEW,
        Permission.ALERT_DISMISS,
        Permission.USER_VIEW,
        Permission.OCR_QUEUE_VIEW,
    ],
    UserRole.mine_official: [
        Permission.INSPECTION_VIEW,
        Permission.INSPECTION_CREATE,
        Permission.INSPECTION_ASSIGN,
        Permission.INSPECTION_CANCEL,
        Permission.OBSERVATION_VIEW,
        Permission.OBSERVATION_CREATE,
        Permission.OBSERVATION_REVIEW,
        Permission.OBSERVATION_CLOSE,
        Permission.RISK_VIEW,
        Permission.RISK_ESCALATE,
        Permission.ACTION_VIEW,
        Permission.ACTION_CREATE,
        Permission.ACTION_VERIFY,
        Permission.ACTION_REJECT,
        Permission.EVIDENCE_VIEW,
        Permission.EVIDENCE_UPLOAD,
        Permission.KPI_VIEW,
        Permission.REPORT_VIEW,
        Permission.REPORT_CREATE,
        Permission.REPORT_EXPORT,
        Permission.AUDIT_VIEW,
        Permission.OCR_SUBMIT,
        Permission.OCR_QUEUE_VIEW,
        Permission.OCR_REVIEW,
        Permission.ALERT_VIEW,
        Permission.ALERT_DISMISS,
        Permission.USER_VIEW,
    ],
    UserRole.inspector: [
        Permission.INSPECTION_VIEW,
        Permission.INSPECTION_START,
        Permission.INSPECTION_SUBMIT,
        Permission.OBSERVATION_VIEW,
        Permission.OBSERVATION_CREATE,
        Permission.RISK_VIEW,
        Permission.ACTION_VIEW,
        Permission.EVIDENCE_VIEW,
        Permission.EVIDENCE_UPLOAD,
        Permission.OCR_SUBMIT,
        Permission.ALERT_VIEW,
        Permission.ALERT_DISMISS,
    ],
    UserRole.contractor: [
        Permission.ACTION_VIEW,
        Permission.ACTION_ACCEPT,
        Permission.ACTION_START,
        Permission.ACTION_PROGRESS,
        Permission.ACTION_SUBMIT,
        Permission.OBSERVATION_VIEW,
        Permission.RISK_VIEW,
        Permission.EVIDENCE_VIEW,
        Permission.EVIDENCE_UPLOAD,
        Permission.ALERT_VIEW,
        Permission.ALERT_DISMISS,
    ],
    UserRole.regulator: [
        Permission.OBSERVATION_VIEW,
        Permission.RISK_VIEW,
        Permission.INSPECTION_VIEW,
        Permission.ACTION_VIEW,
        Permission.EVIDENCE_VIEW,
        Permission.KPI_VIEW,
        Permission.REPORT_VIEW,
        Permission.REPORT_EXPORT,
        Permission.AUDIT_VIEW,
        Permission.AUDIT_VERIFY,
        Permission.AUDIT_EXPORT,
        Permission.OCR_QUEUE_VIEW,
        Permission.OCR_REVIEW,
        Permission.ALERT_VIEW,
        Permission.ALERT_DISMISS,
        Permission.USER_VIEW,
    ],
}


def is_hard_denied(role: UserRole, permission: Permission) -> bool:
    """Returns True if the role is code-level permanently forbidden from holding this permission."""
    denied_set = HARD_DENY.get(role, set())
    return permission in denied_set


def validate_admin_lockout(role: UserRole, target_permission: Permission) -> bool:
    """
    Lock-out guard (Decision D3).
    Super Admin cannot remove USER_* or ROLE_* permissions from super_admin.
    Returns False if action would violate lockout guard.
    """
    if role == UserRole.super_admin:
        if target_permission.value.startswith("USER_") or target_permission.value.startswith("ROLE_"):
            return False
    return True
