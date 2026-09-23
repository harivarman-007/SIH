"""
clean_test_data.py
Removes ALL dynamic workflow data (inspections, observations, corrective actions,
evidence, alerts, audit logs, workflow transitions) from the database.
Keeps: users, mine sites, zones, contractor profiles, corporate access grants,
compliance rules, and session records.
"""
import asyncio
import sys

from sqlalchemy import delete

sys.path.insert(0, "/app")

from app.database import AsyncSessionLocal
from app.models import (
    ActionEvidence,
    Alert,
    AuditLog,
    CorrectiveAction,
    Inspection,
    Observation,
    WorkflowTransition,
)


async def clean():
    print("=" * 60)
    print("INTELLIFUSION — FULL TEST DATA CLEANUP")
    print("=" * 60)

    async with AsyncSessionLocal() as db:
        # 1. Delete evidence (child of actions)
        r = await db.execute(delete(ActionEvidence))
        print(f"[OK] ActionEvidence deleted: {r.rowcount} rows")

        # 2. Delete corrective actions
        r = await db.execute(delete(CorrectiveAction))
        print(f"[OK] CorrectiveAction deleted: {r.rowcount} rows")

        # 3. Delete observations
        r = await db.execute(delete(Observation))
        print(f"[OK] Observation deleted: {r.rowcount} rows")

        # 4. Delete all inspections
        r = await db.execute(delete(Inspection))
        print(f"[OK] Inspection deleted: {r.rowcount} rows")

        # 5. Delete workflow transitions
        r = await db.execute(delete(WorkflowTransition))
        print(f"[OK] WorkflowTransition deleted: {r.rowcount} rows")

        # 6. Delete alerts
        r = await db.execute(delete(Alert))
        print(f"[OK] Alert deleted: {r.rowcount} rows")

        # 7. Delete audit logs
        r = await db.execute(delete(AuditLog))
        print(f"[OK] AuditLog deleted: {r.rowcount} rows")

        await db.commit()

    print("\n[DONE] Database cleaned! Baseline users, mine sites, and zones preserved.")
    print("The site is ready for fresh testing.")


if __name__ == "__main__":
    asyncio.run(clean())
