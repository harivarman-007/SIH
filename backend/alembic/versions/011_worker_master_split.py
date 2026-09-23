"""011_worker_master_split

Feature Refactor: Labour Attendance - Worker Master Data Split
- Create workers table (id, badge_number, name, role, contractor_id, mine_site_id, is_active, created_at)
- Backfill existing labour_attendance records into workers table
- Alter labour_attendance: replace loose worker_id/worker_name/contractor_id with worker_id UUID FK -> workers.id
- Reversible downgrade()
"""
import uuid
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "011_worker_master_split"
down_revision = "010_labour_and_threshold_rules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create workers table
    op.create_table(
        "workers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("badge_number", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("role", sa.String(128), nullable=False, server_default="General Miner"),
        sa.Column("contractor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("mine_site_id", UUID(as_uuid=True), sa.ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true"), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    conn = op.get_bind()

    # 2. Backfill existing test data from labour_attendance into workers
    # Query distinct worker identity combinations in labour_attendance
    raw_attendance = conn.execute(
        sa.text(
            """
            SELECT DISTINCT worker_id, worker_name, mine_site_id, contractor_id
            FROM labour_attendance
            """
        )
    ).fetchall()

    worker_map = {}  # old_worker_id_str -> new_worker_uuid
    for row in raw_attendance:
        old_id_str = row[0]
        name = row[1] or "Unknown Worker"
        site_id = row[2]
        contractor_id = row[3]
        new_uuid = uuid.uuid4()
        worker_map[old_id_str] = new_uuid

        conn.execute(
            sa.text(
                """
                INSERT INTO workers (id, badge_number, name, role, contractor_id, mine_site_id, is_active, created_at)
                VALUES (:id, :badge, :name, 'Colliery Miner', :contractor_id, :site_id, true, NOW())
                ON CONFLICT (badge_number) DO NOTHING
                """
            ),
            {
                "id": new_uuid,
                "badge": old_id_str,
                "name": name,
                "contractor_id": contractor_id,
                "site_id": site_id,
            },
        )

    # 3. Alter labour_attendance:
    # Add temporary worker_uuid column
    op.add_column(
        "labour_attendance",
        sa.Column("worker_uuid", UUID(as_uuid=True), nullable=True),
    )

    # Link worker_uuid based on badge_number in workers
    conn.execute(
        sa.text(
            """
            UPDATE labour_attendance
            SET worker_uuid = workers.id
            FROM workers
            WHERE workers.badge_number = labour_attendance.worker_id
            """
        )
    )

    # In case any rows couldn't map, assign fallback or first worker
    fallback_worker = conn.execute(sa.text("SELECT id FROM workers LIMIT 1")).scalar()
    if fallback_worker:
        conn.execute(
            sa.text(
                "UPDATE labour_attendance SET worker_uuid = :w_id WHERE worker_uuid IS NULL"
            ),
            {"w_id": fallback_worker},
        )

    # Drop old string worker_id, worker_name, contractor_id columns
    op.drop_index("ix_labour_attendance_worker_id", table_name="labour_attendance")
    op.drop_column("labour_attendance", "worker_id")
    op.drop_column("labour_attendance", "worker_name")
    op.drop_column("labour_attendance", "contractor_id")

    # Rename worker_uuid to worker_id and make NOT NULL + FK
    op.alter_column("labour_attendance", "worker_uuid", new_column_name="worker_id", nullable=False)
    op.create_foreign_key(
        "fk_labour_attendance_worker_id",
        "labour_attendance",
        "workers",
        ["worker_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_labour_attendance_worker_id", "labour_attendance", ["worker_id"])


def downgrade() -> None:
    # Reverse alterations on labour_attendance
    op.drop_constraint("fk_labour_attendance_worker_id", "labour_attendance", type_="foreignkey")
    op.drop_index("ix_labour_attendance_worker_id", table_name="labour_attendance")

    op.add_column("labour_attendance", sa.Column("worker_id_str", sa.String(64), nullable=True))
    op.add_column("labour_attendance", sa.Column("worker_name", sa.String(255), nullable=True))
    op.add_column("labour_attendance", sa.Column("contractor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))

    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE labour_attendance
            SET worker_id_str = workers.badge_number,
                worker_name = workers.name,
                contractor_id = workers.contractor_id
            FROM workers
            WHERE workers.id = labour_attendance.worker_id
            """
        )
    )

    op.drop_column("labour_attendance", "worker_id")
    op.alter_column("labour_attendance", "worker_id_str", new_column_name="worker_id", nullable=False)
    op.create_index("ix_labour_attendance_worker_id", "labour_attendance", ["worker_id"])

    # Drop workers table
    op.drop_table("workers")
