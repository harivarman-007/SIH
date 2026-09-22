"""007_workflow_and_inspections

Phase 25: Workflow Engine + Inspections
- Inspections table (id, code, mine_site_id, zone_id, title, assigned_inspector_id, created_by_id, scheduled_for, due_at, status, started_at, completed_at, submitted_at, notes, timestamps)
- Workflow transitions table (id, entity_type, entity_id, from_state, to_state, actor_id, actor_role, actor_type, reason, created_at)
- Observations table: add nullable inspection_id column with foreign key to inspections.id
- ObservationStatus enum: add 'under_review' and 'action_required' values (Decision D8)
- Reversible downgrade()
- FROZEN: no imports from app.* code
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID

revision = "007_workflow_and_inspections"
down_revision = "006_authz_and_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Expand observationstatus enum with new D8 values
    # PostgreSQL 12+ allows ADD VALUE inside transaction
    op.execute(sa.text("ALTER TYPE observationstatus ADD VALUE IF NOT EXISTS 'under_review'"))
    op.execute(sa.text("ALTER TYPE observationstatus ADD VALUE IF NOT EXISTS 'action_required'"))

    # 2. Create inspectionstatus enum idempotently
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE inspectionstatus AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED', 'CANCELLED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))

    inspection_status = postgresql.ENUM(
        "SCHEDULED", "IN_PROGRESS", "COMPLETED", "SUBMITTED", "CANCELLED",
        name="inspectionstatus",
        create_type=False,
    )

    # 3. Create inspections table
    op.create_table(
        "inspections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(32), nullable=False, unique=True),
        sa.Column("mine_site_id", UUID(as_uuid=True), sa.ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("zone_id", UUID(as_uuid=True), sa.ForeignKey("zones.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("assigned_inspector_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", inspection_status, nullable=False, server_default="SCHEDULED"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_inspections_code", "inspections", ["code"])
    op.create_index("ix_inspections_mine_site_id", "inspections", ["mine_site_id"])
    op.create_index("ix_inspections_assigned_inspector_id", "inspections", ["assigned_inspector_id"])
    op.create_index("ix_inspections_status", "inspections", ["status"])

    # 4. Create workflow_transitions table
    op.create_table(
        "workflow_transitions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(32), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("from_state", sa.String(32), nullable=False),
        sa.Column("to_state", sa.String(32), nullable=False),
        sa.Column("actor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_role", sa.String(32), nullable=False),
        sa.Column("actor_type", sa.String(16), nullable=False, server_default="user"),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_workflow_transitions_entity", "workflow_transitions", ["entity_type", "entity_id"])
    op.create_index("ix_workflow_transitions_created_at", "workflow_transitions", ["created_at"])

    # 5. Add inspection_id to observations table
    op.add_column(
        "observations",
        sa.Column("inspection_id", UUID(as_uuid=True), sa.ForeignKey("inspections.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_observations_inspection_id", "observations", ["inspection_id"])


def downgrade() -> None:
    # 1. Drop inspection_id from observations
    op.drop_index("ix_observations_inspection_id", table_name="observations")
    op.drop_column("observations", "inspection_id")

    # 2. Drop workflow_transitions table
    op.drop_index("ix_workflow_transitions_created_at", table_name="workflow_transitions")
    op.drop_index("ix_workflow_transitions_entity", table_name="workflow_transitions")
    op.drop_table("workflow_transitions")

    # 3. Drop inspections table
    op.drop_index("ix_inspections_status", table_name="inspections")
    op.drop_index("ix_inspections_assigned_inspector_id", table_name="inspections")
    op.drop_index("ix_inspections_mine_site_id", table_name="inspections")
    op.drop_index("ix_inspections_code", table_name="inspections")
    op.drop_table("inspections")

    # 4. Drop inspectionstatus enum
    op.execute(sa.text("DROP TYPE IF EXISTS inspectionstatus"))
    # Note: PostgreSQL enum values added via ALTER TYPE cannot be dropped without recreating the enum
