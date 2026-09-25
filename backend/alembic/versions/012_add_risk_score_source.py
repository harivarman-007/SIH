"""012_add_risk_score_source

Feature: Manual Risk Score Option (alongside AI Auto-Score)
- Add risk_score_source column to observations table (default 'ai_auto', non-null)
- Add manual_score_reason column to observations table (nullable text)
- Reversible downgrade()
"""
import sqlalchemy as sa
from alembic import op

revision = "012_add_risk_score_source"
down_revision = "011_worker_master_split"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "observations",
        sa.Column(
            "risk_score_source",
            sa.String(length=50),
            nullable=False,
            server_default="ai_auto",
        ),
    )
    op.add_column(
        "observations",
        sa.Column(
            "manual_score_reason",
            sa.Text(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("observations", "manual_score_reason")
    op.drop_column("observations", "risk_score_source")
