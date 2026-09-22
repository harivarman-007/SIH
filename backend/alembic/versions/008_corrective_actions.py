"""008_corrective_actions

Phase 26: Corrective Actions, Evidence Upload, & Verification/Closure
- corrective_actions table (ACT-0001 sequence, observation_id, mine_site_id, contractor_id, created_by_id, title, description, priority, deadline, status, submission_round, rejection_reason, timestamps)
- action_evidence table (action_id, round, kind, file_path, notes, lat, lng, uploaded_by_id, uploaded_at)
- FK constraint on alerts.action_id -> corrective_actions.id
- Data migration converting existing contractor_assignments rows into corrective_actions in state ASSIGNED
- Reversible downgrade()
- FROZEN: no imports from app.* code
"""
import uuid
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID

revision = "008_corrective_actions"
down_revision = "007_workflow_and_inspections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create actionpriority enum idempotently
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE actionpriority AS ENUM ('low', 'medium', 'high', 'critical');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))

    action_priority = postgresql.ENUM(
        "low", "medium", "high", "critical",
        name="actionpriority",
        create_type=False,
    )

    # 2. Create actionstatus enum idempotently
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE actionstatus AS ENUM ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'REJECTED', 'VERIFIED', 'CLOSED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))

    action_status = postgresql.ENUM(
        "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "PENDING_VERIFICATION",
        "REJECTED", "VERIFIED", "CLOSED",
        name="actionstatus",
        create_type=False,
    )

    # 3. Create evidencekind enum idempotently
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE evidencekind AS ENUM ('before_photo', 'after_photo', 'document', 'note');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))

    evidence_kind = postgresql.ENUM(
        "before_photo", "after_photo", "document", "note",
        name="evidencekind",
        create_type=False,
    )

    # 4. Create corrective_actions table
    op.create_table(
        "corrective_actions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("code", sa.String(32), nullable=False, unique=True),
        sa.Column("observation_id", UUID(as_uuid=True), sa.ForeignKey("observations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mine_site_id", UUID(as_uuid=True), sa.ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contractor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("priority", action_priority, nullable=False, server_default="medium"),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", action_status, nullable=False, server_default="ASSIGNED"),
        sa.Column("submission_round", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_corrective_actions_code", "corrective_actions", ["code"])
    op.create_index("ix_corrective_actions_observation_id", "corrective_actions", ["observation_id"])
    op.create_index("ix_corrective_actions_mine_site_id", "corrective_actions", ["mine_site_id"])
    op.create_index("ix_corrective_actions_contractor_id", "corrective_actions", ["contractor_id"])
    op.create_index("ix_corrective_actions_status", "corrective_actions", ["status"])

    # 5. Create action_evidence table
    op.create_table(
        "action_evidence",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("action_id", UUID(as_uuid=True), sa.ForeignKey("corrective_actions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("kind", evidence_kind, nullable=False),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("uploaded_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_action_evidence_action_id", "action_evidence", ["action_id"])

    # 6. Foreign key on alerts.action_id -> corrective_actions.id
    op.create_foreign_key(
        "fk_alerts_action_id",
        "alerts",
        "corrective_actions",
        ["action_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 7. Data migration: Migrate existing contractor_assignments rows into corrective_actions
    bind = op.get_bind()
    assignments = bind.execute(sa.text("""
        SELECT ca.id, ca.contractor_id, ca.observation_id, ca.notes, ca.assigned_at,
               o.mine_site_id, o.inspector_id, o.description, o.suggested_action
        FROM contractor_assignments ca
        JOIN observations o ON ca.observation_id = o.id
    """)).fetchall()

    for idx, row in enumerate(assignments, start=1):
        action_id = uuid.uuid4()
        code = f"ACT-{idx:04d}"
        title = "Remediation Task"
        desc = row.suggested_action or row.description or row.notes or "Statutory remediation required"
        deadline = row.assigned_at + timedelta(days=3) if row.assigned_at else datetime.now(timezone.utc) + timedelta(days=3)

        bind.execute(sa.text("""
            INSERT INTO corrective_actions (
                id, code, observation_id, mine_site_id, contractor_id, created_by_id,
                title, description, priority, deadline, status, created_at, updated_at
            ) VALUES (
                :id, :code, :observation_id, :mine_site_id, :contractor_id, :created_by_id,
                :title, :description, 'medium'::actionpriority, :deadline, 'ASSIGNED'::actionstatus, :created_at, :created_at
            )
        """), {
            "id": action_id,
            "code": code,
            "observation_id": row.observation_id,
            "mine_site_id": row.mine_site_id,
            "contractor_id": row.contractor_id,
            "created_by_id": row.inspector_id,
            "title": title,
            "description": desc,
            "deadline": deadline,
            "created_at": row.assigned_at or datetime.now(timezone.utc),
        })

        # Update observation status to action_required for migrated observations
        bind.execute(sa.text("""
            UPDATE observations
            SET status = 'action_required'::observationstatus
            WHERE id = :obs_id AND status = 'open'::observationstatus
        """), {"obs_id": row.observation_id})


def downgrade() -> None:
    # 1. Drop alerts.action_id FK and nullify any dangling action_id values on alerts
    op.drop_constraint("fk_alerts_action_id", "alerts", type_="foreignkey")
    op.execute(sa.text("UPDATE alerts SET action_id = NULL WHERE action_id IS NOT NULL"))

    # 2. Drop action_evidence table
    op.drop_index("ix_action_evidence_action_id", table_name="action_evidence")
    op.drop_table("action_evidence")

    # 3. Drop corrective_actions table
    op.drop_index("ix_corrective_actions_status", table_name="corrective_actions")
    op.drop_index("ix_corrective_actions_contractor_id", table_name="corrective_actions")
    op.drop_index("ix_corrective_actions_mine_site_id", table_name="corrective_actions")
    op.drop_index("ix_corrective_actions_observation_id", table_name="corrective_actions")
    op.drop_index("ix_corrective_actions_code", table_name="corrective_actions")
    op.drop_table("corrective_actions")

    # 4. Drop enums
    op.execute(sa.text("DROP TYPE IF EXISTS evidencekind"))
    op.execute(sa.text("DROP TYPE IF EXISTS actionstatus"))
    op.execute(sa.text("DROP TYPE IF EXISTS actionpriority"))
