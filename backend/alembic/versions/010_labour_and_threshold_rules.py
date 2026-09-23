"""010_labour_and_threshold_rules

Item 1 & Item 2: Statutory Labour Compliance and Environmental/Production Thresholds
- labour_attendance table
- labour_compliance_rules table
- compliance_thresholds table
- Add compliance_status and threshold_breach_detail columns to observations table
- Seed default Mines Act 1952 labour rules and CPCB/DGMS statutory thresholds
- Reversible downgrade()
"""
import uuid
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "010_labour_and_threshold_rules"
down_revision = "009_governance_and_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. labour_attendance
    op.create_table(
        "labour_attendance",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("worker_id", sa.String(64), nullable=False, index=True),
        sa.Column("worker_name", sa.String(255), nullable=False),
        sa.Column("mine_site_id", UUID(as_uuid=True), sa.ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("contractor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("shift_date", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("shift_type", sa.String(32), nullable=False),
        sa.Column("clock_in", sa.DateTime(timezone=True), nullable=False),
        sa.Column("clock_out", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hours_worked", sa.Float(), server_default=sa.text("0.0"), nullable=False),
        sa.Column("overtime_hours", sa.Float(), server_default=sa.text("0.0"), nullable=False),
        sa.Column("is_violation", sa.Boolean(), server_default=sa.text("false"), nullable=False, index=True),
        sa.Column("violation_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 2. labour_compliance_rules
    op.create_table(
        "labour_compliance_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("mine_site_id", UUID(as_uuid=True), sa.ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=True, unique=True),
        sa.Column("max_shift_hours", sa.Float(), server_default=sa.text("8.0"), nullable=False),
        sa.Column("max_overtime_hours", sa.Float(), server_default=sa.text("2.0"), nullable=False),
        sa.Column("min_rest_hours_between_shifts", sa.Float(), server_default=sa.text("16.0"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 3. compliance_thresholds
    op.create_table(
        "compliance_thresholds",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("category", sa.String(32), nullable=False, index=True),
        sa.Column("metric_name", sa.String(64), nullable=False, index=True),
        sa.Column("max_value", sa.Float(), nullable=False),
        sa.Column("min_value", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(32), nullable=False),
        sa.Column("mine_site_id", UUID(as_uuid=True), sa.ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("statutory_ref", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 4. Add columns to observations table
    op.add_column("observations", sa.Column("compliance_status", sa.String(20), nullable=True))
    op.add_column("observations", sa.Column("threshold_breach_detail", sa.String(255), nullable=True))

    # 5. Seed default rules and thresholds
    op.execute(
        """
        INSERT INTO labour_compliance_rules (id, mine_site_id, max_shift_hours, max_overtime_hours, min_rest_hours_between_shifts, updated_at)
        VALUES (gen_random_uuid(), NULL, 8.0, 2.0, 16.0, NOW())
        ON CONFLICT DO NOTHING;
        """
    )

    op.execute(
        """
        INSERT INTO compliance_thresholds (id, category, metric_name, max_value, min_value, unit, mine_site_id, statutory_ref, created_at)
        VALUES
            (gen_random_uuid(), 'environment', 'PM10', 100.0, NULL, 'µg/m³', NULL, 'CPCB National Ambient Air Quality Standards 2009', NOW()),
            (gen_random_uuid(), 'environment', 'PM2.5', 60.0, NULL, 'µg/m³', NULL, 'CPCB National Ambient Air Quality Standards 2009', NOW()),
            (gen_random_uuid(), 'environment', 'noise_db', 85.0, NULL, 'dBA', NULL, 'DGMS Permissible Noise Exposure 8h Shift Limits', NOW()),
            (gen_random_uuid(), 'environment', 'effluent_ph', 8.5, 6.5, 'pH', NULL, 'MoEF&CC General Discharge Standards Schedule VI', NOW()),
            (gen_random_uuid(), 'production', 'blast_seismic_limit', 10.0, NULL, 'mm/s PPV', NULL, 'DGMS Tech Circular 7 of 1997 (Peak Particle Velocity)', NOW()),
            (gen_random_uuid(), 'production', 'extraction_rate', 5000.0, NULL, 'tons/day', NULL, 'Statutory Environmental Clearance Mine Plan Approved Peak', NOW())
        ON CONFLICT DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_column("observations", "threshold_breach_detail")
    op.drop_column("observations", "compliance_status")
    op.drop_table("compliance_thresholds")
    op.drop_table("labour_compliance_rules")
    op.drop_table("labour_attendance")
