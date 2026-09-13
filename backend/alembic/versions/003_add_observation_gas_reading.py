"""Add gas_reading_value and gas_reading_unit to observations table.

Revision ID: 003_add_observation_gas_reading
Revises: 002_extend_roles_and_access
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "003_add_observation_gas_reading"
down_revision = "002_extend_roles_and_access"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "observations",
        sa.Column("gas_reading_value", sa.Float(), nullable=True),
    )
    op.add_column(
        "observations",
        sa.Column("gas_reading_unit", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("observations", "gas_reading_unit")
    op.drop_column("observations", "gas_reading_value")
