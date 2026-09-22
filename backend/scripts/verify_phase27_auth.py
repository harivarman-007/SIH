"""
verify_phase27_auth.py
Phase 27 Backend Verification Suite (Updated per user directive):
  1a. AccessDeniedReportRequest valid path
  1b. AccessDeniedReportRequest rejects >200 chars (capped path length)
  1c. Control characters (\r\n\x00) are stripped before writing to audit log
  2. POST /auth/access-denied writes ACCESS_DENIED audit entry with user session & role
  3. Deduplication: repeated denial with same path within 30s is dropped
  4. Per-user rate limit & varying-path spam: max 20 per minute; excess calls (21-25) dropped
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.authz.permissions import Permission, PERMISSIONS_REGISTRY
from app.database import AsyncSessionLocal
from app.models import AuditLog, User, UserRole
from app.schemas.auth import AccessDeniedReportRequest
from app.api.auth import report_access_denied, _user_deny_counts
from sqlalchemy import select, desc

PASS = "PASS"
FAIL = "FAIL"
results = []


def check(name: str, condition: bool, detail: str = "") -> None:
    status = PASS if condition else FAIL
    results.append((status, name, detail))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))


async def main():
    print("=" * 60)
    print("Phase 27 Auth Endpoint Verification Suite")
    print("=" * 60)

    # 1a. Schema length limit check (max 200 chars)
    try:
        req = AccessDeniedReportRequest(path="/manager/actions")
        check("1a. AccessDeniedReportRequest valid path", req.path == "/manager/actions")
    except Exception as e:
        check("1a. AccessDeniedReportRequest valid path", False, str(e))

    # 1b. Schema rejects >200 chars
    try:
        too_long = "/" + "a" * 205
        AccessDeniedReportRequest(path=too_long)
        check("1b. AccessDeniedReportRequest rejects >200 chars", False, "Expected ValidationError")
    except Exception:
        check("1b. AccessDeniedReportRequest rejects >200 chars", True)

    async with AsyncSessionLocal() as db:
        # Load a test user
        stmt = select(User).where(User.role == UserRole.contractor)
        res = await db.execute(stmt)
        contractor = res.scalars().first()

        if not contractor:
            stmt = select(User)
            res = await db.execute(stmt)
            contractor = res.scalars().first()

        if not contractor:
            print("[FAIL] No user found to test POST /auth/access-denied")
            sys.exit(1)

        # Clear rate limit bucket for test user to start fresh
        _user_deny_counts.pop(contractor.id, None)

        # 1c. Control character stripping test
        ctrl_path = f"/admin/evil\r\n\x00path-{uuid.uuid4().hex[:6]}"
        req_ctrl = AccessDeniedReportRequest(path=ctrl_path)
        await report_access_denied(req=req_ctrl, current_user=contractor, db=db)
        await db.commit()

        audit_stmt = (
            select(AuditLog)
            .where(AuditLog.action == "ACCESS_DENIED", AuditLog.actor_id == contractor.id)
            .order_by(desc(AuditLog.ts))
            .limit(1)
        )
        ctrl_entry = (await db.execute(audit_stmt)).scalar_one_or_none()
        expected_clean = ctrl_path.replace("\r", "").replace("\n", "").replace("\x00", "")
        check(
            "1c. Control characters stripped from path",
            ctrl_entry is not None and ctrl_entry.payload.get("path") == expected_clean,
            f"Logged: {ctrl_entry.payload.get('path') if ctrl_entry else 'None'}",
        )

        # 2. Call report_access_denied with standard clean path
        unique_path = f"/admin/super-secret-{uuid.uuid4().hex[:8]}"
        req = AccessDeniedReportRequest(path=unique_path)
        await report_access_denied(req=req, current_user=contractor, db=db)
        await db.commit()

        audit_stmt = (
            select(AuditLog)
            .where(AuditLog.action == "ACCESS_DENIED", AuditLog.actor_id == contractor.id)
            .order_by(desc(AuditLog.ts))
            .limit(1)
        )
        entry = (await db.execute(audit_stmt)).scalar_one_or_none()

        check(
            "2. POST /auth/access-denied writes ACCESS_DENIED audit entry",
            entry is not None and entry.payload.get("path") == unique_path,
            f"Logged path: {entry.payload.get('path') if entry else 'None'}",
        )

        # 3. Deduplication check: second call with same path within 30s
        audit_count_before = len(
            (await db.execute(select(AuditLog).where(AuditLog.action == "ACCESS_DENIED", AuditLog.actor_id == contractor.id))).scalars().all()
        )

        await report_access_denied(req=req, current_user=contractor, db=db)
        await db.commit()

        audit_count_after = len(
            (await db.execute(select(AuditLog).where(AuditLog.action == "ACCESS_DENIED", AuditLog.actor_id == contractor.id))).scalars().all()
        )

        check(
            "3. Deduplication: repeated denial with same path within 30s is dropped",
            audit_count_before == audit_count_after,
            f"Count before: {audit_count_before}, after: {audit_count_after}",
        )

        # 4. Per-user rate limiting & varying-path spam check (max 20 per minute)
        # Create a fresh isolated test user to measure exact 20-call limit
        test_spam_user = User(
            id=uuid.uuid4(),
            email=f"spam-test-{uuid.uuid4().hex[:6]}@mine.in",
            password_hash="test",
            full_name="Spam Tester",
            role=UserRole.contractor,
            is_active=True,
        )
        db.add(test_spam_user)
        await db.commit()

        _user_deny_counts.pop(test_spam_user.id, None)

        # Send 25 varying paths
        for i in range(25):
            varying_req = AccessDeniedReportRequest(path=f"/admin/resource-{i}-{uuid.uuid4().hex[:4]}")
            await report_access_denied(req=varying_req, current_user=test_spam_user, db=db)

        await db.commit()

        spam_entries = (
            await db.execute(select(AuditLog).where(AuditLog.action == "ACCESS_DENIED", AuditLog.actor_id == test_spam_user.id))
        ).scalars().all()

        check(
            "4. Per-user rate limit: 25 varying-path requests capped at exactly 20 audit entries",
            len(spam_entries) == 20,
            f"Expected 20, recorded: {len(spam_entries)} (excess 5 dropped silently with 204)",
        )

    print("=" * 60)
    print("PHASE 27 BACKEND AUTH VERIFICATION SUMMARY")
    print("=" * 60)
    passed = sum(1 for s, _, _ in results if s == PASS)
    failed = sum(1 for s, _, _ in results if s == FAIL)
    print(f"Total Tests: {len(results)} | Passed: {passed} | Failed: {failed}")

    if failed > 0:
        sys.exit(1)
    print("\nALL PHASE 27 BACKEND CHECKS PASSED!\n")


if __name__ == "__main__":
    asyncio.run(main())
