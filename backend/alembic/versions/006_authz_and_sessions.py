"""006_authz_and_sessions

Phase 24: Authorization Foundation — sessions, permissions, role_permissions tables.
FROZEN SNAPSHOT: no imports from app.* code. All data inlined.

Binding decisions:
  MUST #5 — Regulator scope: grant all existing mine_sites to all existing regulators
             via corporate_mine_access so Phase 9/11 tests continue to pass.
             Newly created regulators get no mines (fail-closed).
  SHOULD #6 — create_type=False for userrole (already exists in DB).
  SHOULD #6 — Verified downgrade() removes all added columns/tables/data.
"""
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from alembic import op

revision = "006_authz_and_sessions"
down_revision = "005_add_alerts_table"
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# FROZEN permission data snapshot (no app.* imports)
# ---------------------------------------------------------------------------
_PERMISSIONS = [
    # code, description, resource, operation
    ("INSPECTION_VIEW",   "View scheduled and active mine inspections",        "inspections", "read"),
    ("INSPECTION_CREATE", "Create and schedule mine inspections",               "inspections", "create"),
    ("INSPECTION_ASSIGN", "Assign inspections to field inspectors",             "inspections", "assign"),
    ("INSPECTION_START",  "Begin assigned field inspection",                    "inspections", "execute"),
    ("INSPECTION_SUBMIT", "Submit completed inspection for review",             "inspections", "submit"),
    ("INSPECTION_CANCEL", "Cancel a scheduled inspection",                      "inspections", "cancel"),
    ("OBSERVATION_VIEW",  "View compliance observations and hazards",           "observations", "read"),
    ("OBSERVATION_CREATE","Record new compliance observation or hazard",         "observations", "create"),
    ("OBSERVATION_REVIEW","Review observation and determine corrective path",    "observations", "review"),
    ("OBSERVATION_CLOSE", "Close observation with verified resolution note",     "observations", "close"),
    ("RISK_VIEW",         "View AI and edge hazard risk evaluations",           "risk",   "read"),
    ("RISK_ESCALATE",     "Manually escalate critical hazard priority",         "risk",   "escalate"),
    ("ACTION_VIEW",       "View assigned corrective action work orders",        "actions","read"),
    ("ACTION_CREATE",     "Create and assign corrective action to contractor",  "actions","create"),
    ("ACTION_ACCEPT",     "Accept assigned corrective action work order",       "actions","accept"),
    ("ACTION_START",      "Commence work on corrective action",                 "actions","start"),
    ("ACTION_PROGRESS",   "Update progress on active corrective action",        "actions","update"),
    ("ACTION_SUBMIT",     "Submit completed action with evidence for review",   "actions","submit"),
    ("ACTION_VERIFY",     "Verify completion evidence and approve closure",     "actions","verify"),
    ("ACTION_REJECT",     "Reject insufficient work evidence with mandatory reason","actions","reject"),
    ("EVIDENCE_VIEW",     "Inspect photo and document evidence attachments",    "evidence","read"),
    ("EVIDENCE_UPLOAD",   "Upload before/after work proof and geo-stamped photos","evidence","upload"),
    ("AUDIT_VIEW",        "View cryptographic audit ledger entries",            "audit",  "read"),
    ("AUDIT_VERIFY",      "Verify SHA-256 hash-chain integrity mathematically", "audit",  "verify"),
    ("AUDIT_EXPORT",      "Export certified statutory audit logs",              "audit",  "export"),
    ("KPI_VIEW",          "View compliance metrics, trends, and risk scores",   "kpi",    "read"),
    ("REPORT_VIEW",       "View compliance and incident summary reports",       "reports","read"),
    ("REPORT_CREATE",     "Generate statutory compliance snapshot report",      "reports","create"),
    ("REPORT_EXPORT",     "Export statutory reports in standard formats",       "reports","export"),
    ("OCR_SUBMIT",        "Upload paper log sheet for OCR digitization",        "ocr",    "submit"),
    ("OCR_QUEUE_VIEW",    "View pending OCR human verification queue",          "ocr",    "read"),
    ("OCR_REVIEW",        "Approve or correct low-confidence OCR text",         "ocr",    "review"),
    ("ALERT_VIEW",        "View in-app statutory escalation notifications",     "alerts", "read"),
    ("ALERT_DISMISS",     "Mark alerts as read or acknowledged",                "alerts", "update"),
    ("USER_VIEW",         "View user directories and authorized personnel",     "users",  "read"),
    ("USER_CREATE",       "Create new authorized user accounts",                "users",  "create"),
    ("USER_EDIT",         "Modify user details and account status",             "users",  "update"),
    ("USER_DISABLE",      "Deactivate or revoke user access",                   "users",  "disable"),
    ("ROLE_VIEW",         "View role definitions and permission mappings",      "roles",  "read"),
    ("ROLE_ASSIGN",       "Assign system roles to user accounts",               "roles",  "assign"),
    ("SETTING_VIEW",      "View governance parameters and SLA configurations",  "settings","read"),
    ("SETTING_EDIT",      "Update SLA thresholds and platform settings",        "settings","update"),
]

# role → list of permission codes  (frozen, matches permissions.py DEFAULT_ROLE_PERMISSIONS)
_ROLE_PERMISSIONS = {
    "super_admin": [
        "USER_VIEW","USER_CREATE","USER_EDIT","USER_DISABLE",
        "ROLE_VIEW","ROLE_ASSIGN",
        "SETTING_VIEW","SETTING_EDIT",
        "AUDIT_VIEW","AUDIT_VERIFY","AUDIT_EXPORT",
        "KPI_VIEW","REPORT_VIEW","REPORT_CREATE","REPORT_EXPORT",
        "OBSERVATION_VIEW","INSPECTION_VIEW","ACTION_VIEW",
        "ALERT_VIEW","ALERT_DISMISS","OCR_QUEUE_VIEW",
    ],
    "corporate_management": [
        "OBSERVATION_VIEW","RISK_VIEW","RISK_ESCALATE",
        "INSPECTION_VIEW","ACTION_VIEW","EVIDENCE_VIEW",
        "KPI_VIEW","REPORT_VIEW","REPORT_EXPORT",
        "AUDIT_VIEW","AUDIT_EXPORT",
        "ALERT_VIEW","ALERT_DISMISS","USER_VIEW","OCR_QUEUE_VIEW",
    ],
    "mine_official": [
        "INSPECTION_VIEW","INSPECTION_CREATE","INSPECTION_ASSIGN","INSPECTION_CANCEL",
        "OBSERVATION_VIEW","OBSERVATION_CREATE","OBSERVATION_REVIEW","OBSERVATION_CLOSE",
        "RISK_VIEW","RISK_ESCALATE",
        "ACTION_VIEW","ACTION_CREATE","ACTION_VERIFY","ACTION_REJECT",
        "EVIDENCE_VIEW","EVIDENCE_UPLOAD",
        "KPI_VIEW","REPORT_VIEW","REPORT_CREATE","REPORT_EXPORT",
        "AUDIT_VIEW","OCR_SUBMIT","OCR_QUEUE_VIEW","OCR_REVIEW",
        "ALERT_VIEW","ALERT_DISMISS","USER_VIEW",
    ],
    "inspector": [
        "INSPECTION_VIEW","INSPECTION_START","INSPECTION_SUBMIT",
        "OBSERVATION_VIEW","OBSERVATION_CREATE",
        "RISK_VIEW","ACTION_VIEW","EVIDENCE_VIEW","EVIDENCE_UPLOAD",
        "OCR_SUBMIT","ALERT_VIEW","ALERT_DISMISS",
    ],
    "contractor": [
        "ACTION_VIEW","ACTION_ACCEPT","ACTION_START","ACTION_PROGRESS","ACTION_SUBMIT",
        "OBSERVATION_VIEW","RISK_VIEW","EVIDENCE_VIEW","EVIDENCE_UPLOAD",
        "ALERT_VIEW","ALERT_DISMISS",
    ],
    "regulator": [
        "OBSERVATION_VIEW","RISK_VIEW","INSPECTION_VIEW","ACTION_VIEW","EVIDENCE_VIEW",
        "KPI_VIEW","REPORT_VIEW","REPORT_EXPORT",
        "AUDIT_VIEW","AUDIT_VERIFY","AUDIT_EXPORT",
        "OCR_QUEUE_VIEW","OCR_REVIEW",
        "ALERT_VIEW","ALERT_DISMISS","USER_VIEW",
    ],
}


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Add columns to users table
    # ------------------------------------------------------------------
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("department", sa.String(100), nullable=True))

    # ------------------------------------------------------------------
    # 2. Add columns to alerts table
    # ------------------------------------------------------------------
    op.add_column("alerts", sa.Column(
        "recipient_user_id",
        sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    ))
    op.add_column("alerts", sa.Column(
        "action_id",
        sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    ))
    # FK to users (nullable, SET NULL on delete)
    op.create_foreign_key(
        "fk_alerts_recipient_user_id",
        "alerts", "users",
        ["recipient_user_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_alerts_recipient_user_id", "alerts", ["recipient_user_id"])
    op.create_index("ix_alerts_action_id", "alerts", ["action_id"])
    # NOTE: action_id is FK-less for Phase 24 per plan MUST #14.

    # ------------------------------------------------------------------
    # 3. Create sessions table
    # ------------------------------------------------------------------
    op.create_table(
        "sessions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("jti", sa.String(64), unique=True, nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_sessions_jti", "sessions", ["jti"])
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    # ------------------------------------------------------------------
    # 4. Create permissions table
    # ------------------------------------------------------------------
    op.create_table(
        "permissions",
        sa.Column("code", sa.String(100), primary_key=True),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("resource", sa.String(50), nullable=False),
        sa.Column("operation", sa.String(50), nullable=False),
    )

    # ------------------------------------------------------------------
    # 5. Create role_permissions table
    # ------------------------------------------------------------------
    # SHOULD #6: userrole enum already exists — use postgresql.ENUM with create_type=False
    # so Alembic does NOT issue CREATE TYPE userrole AS ENUM (which would fail with DuplicateObject).
    from sqlalchemy.dialects import postgresql as pg
    userrole_type = pg.ENUM(
        "super_admin", "corporate_management", "mine_official",
        "inspector", "contractor", "regulator",
        name="userrole", create_type=False,
    )
    op.create_table(
        "role_permissions",
        sa.Column("role", userrole_type, primary_key=True),
        sa.Column("permission_code", sa.String(100), primary_key=True),
        sa.ForeignKeyConstraint(["permission_code"], ["permissions.code"], ondelete="CASCADE"),
    )

    # ------------------------------------------------------------------
    # 6. Seed frozen permissions data
    # ------------------------------------------------------------------
    conn = op.get_bind()
    perm_table = sa.table(
        "permissions",
        sa.column("code"), sa.column("description"), sa.column("resource"), sa.column("operation"),
    )
    conn.execute(perm_table.insert(), [
        {"code": c, "description": d, "resource": r, "operation": o}
        for c, d, r, o in _PERMISSIONS
    ])

    rp_table = sa.table("role_permissions", sa.column("role"), sa.column("permission_code"))
    rows = []
    for role, codes in _ROLE_PERMISSIONS.items():
        for code in codes:
            rows.append({"role": role, "permission_code": code})
    conn.execute(rp_table.insert(), rows)

    # ------------------------------------------------------------------
    # 7. MUST #5: Grant all existing mine_sites to all existing regulators
    #    via corporate_mine_access so Phase 9/11 regression suites pass.
    #    Newly created regulators get no mines (fail-closed by default).
    # ------------------------------------------------------------------
    import uuid
    users_t = sa.table("users", sa.column("id"), sa.column("role"))
    mines_t = sa.table("mine_sites", sa.column("id"))
    access_t = sa.table(
        "corporate_mine_access",
        sa.column("id"), sa.column("user_id"), sa.column("mine_site_id"),
    )

    regulator_ids = conn.execute(
        sa.select(users_t.c.id).where(users_t.c.role == "regulator")
    ).scalars().all()

    mine_ids = conn.execute(sa.select(mines_t.c.id)).scalars().all()

    if regulator_ids and mine_ids:
        access_rows = []
        for reg_id in regulator_ids:
            for mine_id in mine_ids:
                # Only insert if not already present (idempotent)
                existing = conn.execute(
                    sa.select(access_t.c.id).where(
                        access_t.c.user_id == reg_id,
                        access_t.c.mine_site_id == mine_id,
                    )
                ).scalar_one_or_none()
                if existing is None:
                    access_rows.append({
                        "id": uuid.uuid4(),
                        "user_id": reg_id,
                        "mine_site_id": mine_id,
                    })
        if access_rows:
            conn.execute(access_t.insert(), access_rows)


def downgrade() -> None:
    conn = op.get_bind()

    # 7. Remove regulator corporate_mine_access rows seeded by this migration
    #    (Note: we can't perfectly distinguish which rows this migration added vs prior,
    #     so we simply remove all regulator-scoped corporate_mine_access rows.
    #     This is safe because Phase 9 seeds them via generate_mock_data.py.)
    users_t = sa.table("users", sa.column("id"), sa.column("role"))
    access_t = sa.table("corporate_mine_access", sa.column("user_id"))
    regulator_ids = conn.execute(
        sa.select(users_t.c.id).where(users_t.c.role == "regulator")
    ).scalars().all()
    if regulator_ids:
        conn.execute(
            access_t.delete().where(access_t.c.user_id.in_(regulator_ids))
        )

    # 6. role_permissions and permissions data removed with table drops below.

    # 5. Drop role_permissions
    op.drop_table("role_permissions")

    # 4. Drop permissions
    op.drop_table("permissions")

    # 3. Drop sessions
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_index("ix_sessions_jti", table_name="sessions")
    op.drop_table("sessions")

    # 2. Drop alerts additions
    op.drop_index("ix_alerts_action_id", table_name="alerts")
    op.drop_index("ix_alerts_recipient_user_id", table_name="alerts")
    op.drop_constraint("fk_alerts_recipient_user_id", "alerts", type_="foreignkey")
    op.drop_column("alerts", "action_id")
    op.drop_column("alerts", "recipient_user_id")

    # 1. Drop users additions
    op.drop_column("users", "department")
    op.drop_column("users", "last_login_at")
