"""Add image_path to ocr_review_queue table.

Revision ID: 004_add_ocr_image_path
Revises: 003_add_observation_gas_reading
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "004_add_ocr_image_path"
down_revision = "003_add_observation_gas_reading"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ocr_review_queue",
        sa.Column("image_path", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ocr_review_queue", "image_path")
