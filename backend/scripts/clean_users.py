"""Delete all non-canonical test users using raw SQL with FK-safe ordering."""
import asyncio
import sys
sys.path.insert(0, '/app')

from sqlalchemy import text
from app.database import AsyncSessionLocal

CANONICAL_EMAILS = (
    'superadmin@intellifusion.gov.in',
    'corporate@coalindia.in',
    'official1@mine.in',
    'inspector1@mine.in',
    'contractor1@contractor.in',
    'regulator@dgms.gov.in',
)

async def clean_users():
    async with AsyncSessionLocal() as db:
        # Count first
        total_q = await db.execute(text("SELECT COUNT(*) FROM users"))
        total = total_q.scalar()
        print(f"Total users before: {total}")

        placeholders = ', '.join([f"'{e}'" for e in CANONICAL_EMAILS])
        bad_ids_q = await db.execute(
            text(f"SELECT id FROM users WHERE email NOT IN ({placeholders})")
        )
        bad_ids = [str(row[0]) for row in bad_ids_q.fetchall()]
        print(f"Test users to delete: {len(bad_ids)}")

        if not bad_ids:
            print("Nothing to delete.")
            return

        id_list = ', '.join([f"'{i}'" for i in bad_ids])

        # Delete child records in FK order
        steps = [
            ("contractor_profiles", "user_id"),
            ("corporate_mine_access", "user_id"),
            ("contractor_assignments", "contractor_id"),
            ("audit_logs", "actor_id"),
            ("sessions", "user_id"),
        ]
        for table, col in steps:
            r = await db.execute(text(f"DELETE FROM {table} WHERE {col} IN ({id_list})"))
            print(f"  Cleared {table}.{col}: {r.rowcount} rows")

        # Now delete the users
        r = await db.execute(text(f"DELETE FROM users WHERE id IN ({id_list})"))
        print(f"Deleted {r.rowcount} test users.")

        await db.commit()

        # Verify
        after_q = await db.execute(text("SELECT email, role FROM users ORDER BY role"))
        rows = after_q.fetchall()
        print(f"\nRemaining users: {len(rows)}")
        for row in rows:
            print(f"  - {row[0]} ({row[1]})")

asyncio.run(clean_users())
