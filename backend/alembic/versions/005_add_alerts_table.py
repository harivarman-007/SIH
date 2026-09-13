"""Add alerts table for in-app escalation notifications.

Revision ID: 005_add_alerts_table
Revises: 004_add_ocr_image_path
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "005_add_alerts_table"
down_revision = "004_add_ocr_image_path"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("recipient_role", sa.String(50), nullable=False),
        sa.Column(
            "mine_site_id",
            UUID(as_uuid=True),
            sa.ForeignKey("mine_sites.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "observation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("observations.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_alerts_recipient_role", "alerts", ["recipient_role"])
    op.create_index("ix_alerts_mine_site_id", "alerts", ["mine_site_id"])
    op.create_index("ix_alerts_observation_id", "alerts", ["observation_id"])
    op.create_index("ix_alerts_is_read", "alerts", ["is_read"])


def downgrade() -> None:
    op.drop_index("ix_alerts_is_read", table_name="alerts")
    op.drop_index("ix_alerts_observation_id", table_name="alerts")
    op.drop_index("ix_alerts_mine_site_id", table_name="alerts")
    op.drop_index("ix_alerts_recipient_role", table_name="alerts")
    op.drop_table("alerts")
