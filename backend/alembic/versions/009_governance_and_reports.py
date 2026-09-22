"""009_governance_and_reports

Phase 30: System Settings, Compliance Rules, Reports, Contractor Profiles
- system_settings table (key PK, value JSONB, updated_by_id, updated_at)
- compliance_rules table (id PK, category, code, description, default_severity, statutory_ref, is_active, created_at, updated_at)
- reports table (id PK, type, scope JSONB, payload JSONB, generated_by_id, generated_at)
- contractor_profiles table (user_id PK, company_name, license_no, cert_expiry, is_active, created_at)
- Default seeds for system_settings (SLA thresholds, risk-flag thresholds) and initial compliance rules
- Reversible downgrade()
- FROZEN: no imports from app.* code
"""
import uuid
from datetime import datetime, timezone
import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID

revision = "009_governance_and_reports"
down_revision = "008_corrective_actions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. system_settings
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 2. compliance_rules
    op.create_table(
        "compliance_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("default_severity", sa.String(20), nullable=False),
        sa.Column("statutory_ref", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 3. reports
    op.create_table(
        "reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("scope", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("generated_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 4. contractor_profiles
    op.create_table(
        "contractor_profiles",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("license_no", sa.String(100), nullable=False),
        sa.Column("cert_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Seed default system_settings
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            INSERT INTO system_settings (key, value, updated_at)
            VALUES
                ('sla_thresholds', :sla_val, NOW()),
                ('risk_flag_thresholds', :risk_val, NOW())
            ON CONFLICT (key) DO NOTHING;
            """
        ),
        {
            "sla_val": json.dumps({"high_hours": 24, "medium_hours": 72, "low_hours": 168}),
            "risk_val": json.dumps({"high": 0.75, "medium": 0.45, "low": 0.20}),
        },
    )

    # Seed initial compliance rules
    conn.execute(
        sa.text(
            """
            INSERT INTO compliance_rules (id, category, code, description, default_severity, statutory_ref, is_active, created_at, updated_at)
            VALUES
                (:r1, 'safety', 'DGMS-CMR-112', 'Daily statutory inspection of underground ventilation currents and gas concentrations', 'high', 'CMR 2017 Reg 112', true, NOW(), NOW()),
                (:r2, 'safety', 'DGMS-CMR-124', 'Systematic roof support and strata stability plan adherence in development headings', 'high', 'CMR 2017 Reg 124', true, NOW(), NOW()),
                (:r3, 'environment', 'DGMS-TC-04', 'Airborne respirable coal dust suppression mist sprays active at transfer chutes', 'medium', 'DGMS Circular 4/2017', true, NOW(), NOW()),
                (:r4, 'labour', 'MINES-ACT-33', 'Mandatory issue and inspection of Self-Contained Self-Rescuers (SCSR) to personnel', 'high', 'Mines Act 1952 Sec 33', true, NOW(), NOW()),
                (:r5, 'production', 'DGMS-GL-18', 'Belt conveyor slip, sequential interlocking, and thermal safety alarm validation', 'medium', 'DGMS Guidelines 1990', true, NOW(), NOW())
            ON CONFLICT (code) DO NOTHING;
            """
        ),
        {
            "r1": str(uuid.uuid4()),
            "r2": str(uuid.uuid4()),
            "r3": str(uuid.uuid4()),
            "r4": str(uuid.uuid4()),
            "r5": str(uuid.uuid4()),
        },
    )


def downgrade() -> None:
    op.drop_table("contractor_profiles")
    op.drop_table("reports")
    op.drop_table("compliance_rules")
    op.drop_table("system_settings")
