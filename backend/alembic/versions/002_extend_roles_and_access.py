"""Extend roles to 6 roles and add corporate_mine_access and contractor_assignments.

Revision ID: 002_extend_roles_and_access
Revises: 001_initial_schema
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002_extend_roles_and_access"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add new enum values to userrole
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'super_admin'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'corporate_management'")

    # 2. Create corporate_mine_access table
    op.create_table(
        "corporate_mine_access",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mine_site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_corporate_mine_access_user_id", "corporate_mine_access", ["user_id"])
    op.create_index("ix_corporate_mine_access_mine_site_id", "corporate_mine_access", ["mine_site_id"])
    op.create_unique_constraint("uq_corporate_mine_access_user_site", "corporate_mine_access", ["user_id", "mine_site_id"])

    # 3. Create contractor_assignments table
    op.create_table(
        "contractor_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("contractor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("observation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("observations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index("ix_contractor_assignments_contractor_id", "contractor_assignments", ["contractor_id"])
    op.create_index("ix_contractor_assignments_observation_id", "contractor_assignments", ["observation_id"])
    op.create_unique_constraint("uq_contractor_assignments_contractor_obs", "contractor_assignments", ["contractor_id", "observation_id"])


def downgrade() -> None:
    op.drop_table("contractor_assignments")
    op.drop_table("corporate_mine_access")
