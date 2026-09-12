"""Initial schema — all core tables.

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "postgis"')

    # Enums
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE userrole AS ENUM ('inspector', 'contractor', 'mine_official', 'regulator');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE observationcategory AS ENUM ('safety', 'environment', 'labour');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE riskflag AS ENUM ('low', 'medium', 'high');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE observationstatus AS ENUM ('open', 'in_progress', 'closed', 'escalated');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE ocrreviewstatus AS ENUM ('pending', 'approved', 'rejected');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)

    userrole_enum = postgresql.ENUM("inspector", "contractor", "mine_official", "regulator", name="userrole", create_type=False)
    category_enum = postgresql.ENUM("safety", "environment", "labour", name="observationcategory", create_type=False)
    riskflag_enum = postgresql.ENUM("low", "medium", "high", name="riskflag", create_type=False)
    status_enum = postgresql.ENUM("open", "in_progress", "closed", "escalated", name="observationstatus", create_type=False)
    ocrstatus_enum = postgresql.ENUM("pending", "approved", "rejected", name="ocrreviewstatus", create_type=False)

    # mine_sites
    op.create_table(
        "mine_sites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("location_name", sa.String(255), nullable=False),
        sa.Column("lat", sa.Float, nullable=True),
        sa.Column("lng", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # users (depends on mine_sites)
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", userrole_enum, nullable=False),
        sa.Column("mine_site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mine_sites.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.true(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # zones (depends on mine_sites)
    op.create_table(
        "zones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("mine_site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mine_sites.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("zone_type", sa.String(50), nullable=False),
        sa.Column("risk_baseline", sa.Float, nullable=False, server_default="0.3"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # observations (depends on users, mine_sites, zones)
    op.create_table(
        "observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("inspector_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("mine_site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mine_sites.id"), nullable=False),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("zones.id"), nullable=False),
        sa.Column("category", category_enum, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("photo_url", sa.Text, nullable=True),
        sa.Column("has_photo", sa.Boolean, default=False),
        sa.Column("lat", sa.Float, nullable=True),
        sa.Column("lng", sa.Float, nullable=True),
        sa.Column("beacon_id", sa.String(100), nullable=True),
        sa.Column("edge_score", sa.Float, nullable=True),
        sa.Column("edge_flag", riskflag_enum, nullable=True),
        sa.Column("edge_reasons", postgresql.JSONB, nullable=True),
        sa.Column("cloud_score", sa.Float, nullable=True),
        sa.Column("cloud_flag", riskflag_enum, nullable=True),
        sa.Column("cloud_reasons", postgresql.JSONB, nullable=True),
        sa.Column("suggested_action", sa.Text, nullable=True),
        sa.Column("enriched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", status_enum, nullable=False, server_default="open"),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("closure_photo_url", sa.Text, nullable=True),
        sa.Column("closure_note", sa.Text, nullable=True),
        sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("versions_json", postgresql.JSONB, nullable=True, server_default=sa.text("'[]'::jsonb")),
    )
    op.create_index("ix_observations_inspector_id", "observations", ["inspector_id"])
    op.create_index("ix_observations_mine_site_id", "observations", ["mine_site_id"])
    op.create_index("ix_observations_status", "observations", ["status"])
    op.create_index("ix_observations_edge_flag", "observations", ["edge_flag"])
    op.create_index("ix_observations_cloud_flag", "observations", ["cloud_flag"])
    op.create_index("ix_observations_created_at", "observations", ["created_at"])

    # audit_log (append-only, hash-chained)
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("entry_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("prev_hash", sa.String(64), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("payload", postgresql.JSONB, nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_log_entry_hash", "audit_log", ["entry_hash"])
    op.create_index("ix_audit_log_ts", "audit_log", ["ts"])

    # ocr_review_queue
    op.create_table(
        "ocr_review_queue",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("document_name", sa.String(255), nullable=True),
        sa.Column("raw_text", sa.Text, nullable=False),
        sa.Column("confidence_map", postgresql.JSONB, nullable=False),
        sa.Column("overall_confidence", sa.Float, nullable=False),
        sa.Column("status", ocrstatus_enum, nullable=False, server_default="pending"),
        sa.Column("submitted_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("ocr_review_queue")
    op.drop_table("audit_log")
    op.drop_index("ix_observations_created_at", "observations")
    op.drop_index("ix_observations_cloud_flag", "observations")
    op.drop_index("ix_observations_edge_flag", "observations")
    op.drop_index("ix_observations_status", "observations")
    op.drop_index("ix_observations_mine_site_id", "observations")
    op.drop_index("ix_observations_inspector_id", "observations")
    op.drop_table("observations")
    op.drop_table("zones")
    op.drop_index("ix_users_email", "users")
    op.drop_table("users")
    op.drop_table("mine_sites")
    op.execute("DROP TYPE IF EXISTS ocrreviewstatus")
    op.execute("DROP TYPE IF EXISTS observationstatus")
    op.execute("DROP TYPE IF EXISTS riskflag")
    op.execute("DROP TYPE IF EXISTS observationcategory")
    op.execute("DROP TYPE IF EXISTS userrole")
