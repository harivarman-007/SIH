"""013_add_mine_site_active

Phase 32: Super Admin Mine Sites Management
- Add is_active column to mine_sites table (default True, non-null)
- Reversible downgrade()
"""
import sqlalchemy as sa
from alembic import op

revision = "013_add_mine_site_active"
down_revision = "012_add_risk_score_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "mine_sites",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("mine_sites", "is_active")
