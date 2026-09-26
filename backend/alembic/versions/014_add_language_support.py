"""014_add_language_support

Phase A: Multilingual Support Plan
- Add state column to mine_sites table (String(64), nullable)
- Add preferred_language column to users table (String(8), nullable)
- Backfill mine_sites.state based on location_name for top coal-producing regions
- Reversible downgrade()
"""
import sqlalchemy as sa
from alembic import op

revision = "014_add_language_support"
down_revision = "013_add_mine_site_active"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("mine_sites", sa.Column("state", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("preferred_language", sa.String(length=8), nullable=True))

    # Backfill mine_sites.state from location_name where possible
    conn = op.get_bind()
    state_patterns = [
        ("Jharkhand", ["%Jharkhand%", "%Dhanbad%", "%Jharia%", "%Bokaro%"]),
        ("West Bengal", ["%West Bengal%", "% WB%", "%Raniganj%", "%Asansol%"]),
        ("Odisha", ["%Odisha%", "%Orissa%", "%Talcher%", "%IB Valley%"]),
        ("Madhya Pradesh", ["%Madhya Pradesh%", "% MP%", "%Singrauli%"]),
        ("Chhattisgarh", ["%Chhattisgarh%", "% CG%", "%Korba%"]),
        ("Telangana", ["%Telangana%", "%Singareni%"]),
        ("Maharashtra", ["%Maharashtra%", "%Chandrapur%", "%Nagpur%"]),
    ]
    for state_name, patterns in state_patterns:
        for pat in patterns:
            conn.execute(
                sa.text(
                    "UPDATE mine_sites SET state = :state WHERE state IS NULL AND location_name ILIKE :pattern"
                ),
                {"state": state_name, "pattern": pat},
            )


def downgrade() -> None:
    op.drop_column("users", "preferred_language")
    op.drop_column("mine_sites", "state")
