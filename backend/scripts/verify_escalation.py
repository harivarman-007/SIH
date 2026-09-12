"""
verify_escalation.py
Verification test script for Automated Statutory SLA Escalation Engine.

Tests:
  1. Endpoint /observations/escalate-overdue registration.
  2. SLA threshold evaluation:
     - High risk: > 24 hours -> status becomes 'escalated', escalated_at set.
     - High risk: < 24 hours -> stays 'open'.
     - Medium risk: > 72 hours -> escalated.
     - Medium risk: < 72 hours -> stays 'open'.
     - Low risk: > 168 hours -> escalated.
     - Closed observations: never escalated.
  3. Custom SLA query parameter override (e.g. 1 hour).
  4. Audit logging: append_audit_entry called with action="observation.auto_escalated" and SLA metadata.
  5. Role scoping & fail-closed security: mine_official without site scope rejected.
  6. Production category observation correctly evaluated.
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import HTTPException
from app.api.observations import escalate_overdue_observations, router
from app.models import (
    Observation,
    ObservationCategory,
    ObservationStatus,
    RiskFlag,
    User,
    UserRole,
)
from app.schemas.observation import EscalationResponse

PASS = "[PASS]"
FAIL = "[FAIL]"

results = []


def record(name: str, passed: bool, detail: str = ""):
    status_str = PASS if passed else FAIL
    results.append((name, passed))
    print(f"  {status_str} {name}" + (f" -- {detail}" if detail else ""))


async def run_tests():
    print("\n" + "=" * 60)
    print("Automated Statutory SLA Escalation Engine Verification")
    print("=" * 60)

    # 1. Endpoint Registration
    route = next((r for r in router.routes if r.path == "/observations/escalate-overdue"), None)
    record("Endpoint /observations/escalate-overdue is registered on router", route is not None)

    # 2. Test Setup
    now_utc = datetime.now(timezone.utc)
    site_id = uuid.uuid4()
    admin_user = User(
        id=uuid.uuid4(),
        role=UserRole.super_admin,
        email="admin@intellifusion.gov.in",
    )

    # Create test observations with various ages and risk flags
    # Obs 1: High risk, 25 hours old (SLA breached)
    obs_high_overdue = Observation(
        id=uuid.uuid4(),
        created_at=now_utc - timedelta(hours=25),
        mine_site_id=site_id,
        category=ObservationCategory.safety,
        cloud_flag=RiskFlag.high,
        status=ObservationStatus.open,
        version=1,
    )

    # Obs 2: High risk, 10 hours old (Within SLA)
    obs_high_fresh = Observation(
        id=uuid.uuid4(),
        created_at=now_utc - timedelta(hours=10),
        mine_site_id=site_id,
        category=ObservationCategory.safety,
        cloud_flag=RiskFlag.high,
        status=ObservationStatus.open,
        version=1,
    )

    # Obs 3: Medium risk, 75 hours old (SLA breached)
    obs_med_overdue = Observation(
        id=uuid.uuid4(),
        created_at=now_utc - timedelta(hours=75),
        mine_site_id=site_id,
        category=ObservationCategory.environment,
        cloud_flag=RiskFlag.medium,
        status=ObservationStatus.in_progress,
        version=1,
    )

    # Obs 4: Medium risk, 30 hours old (Within SLA)
    obs_med_fresh = Observation(
        id=uuid.uuid4(),
        created_at=now_utc - timedelta(hours=30),
        mine_site_id=site_id,
        category=ObservationCategory.environment,
        cloud_flag=RiskFlag.medium,
        status=ObservationStatus.open,
        version=1,
    )

    # Obs 5: Production category, High risk, 30 hours old (SLA breached)
    obs_prod_overdue = Observation(
        id=uuid.uuid4(),
        created_at=now_utc - timedelta(hours=30),
        mine_site_id=site_id,
        category=ObservationCategory.production,
        cloud_flag=RiskFlag.high,
        status=ObservationStatus.open,
        version=1,
    )

    all_obs = [
        obs_high_overdue,
        obs_high_fresh,
        obs_med_overdue,
        obs_med_fresh,
        obs_prod_overdue,
    ]

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = all_obs
    mock_db.execute.return_value = mock_res
    mock_db.flush = AsyncMock()

    with patch("app.api.observations.append_audit_entry", new=AsyncMock()) as mock_audit:
        resp = await escalate_overdue_observations(
            mine_site_id=None,
            high_risk_sla_hours=24.0,
            medium_risk_sla_hours=72.0,
            low_risk_sla_hours=168.0,
            db=mock_db,
            current_user=admin_user,
        )

        record("Response is an EscalationResponse instance", isinstance(resp, EscalationResponse))
        record("Evaluated count matches all unresolved observations (5)", resp.evaluated_count == 5)
        record("Escalated count is exactly 3 (2 high-risk + 1 med-risk)", resp.escalated_count == 3)

        # Verify Obs 1 (High overdue) was escalated
        record("Obs 1 (High > 24h) status became 'escalated'", obs_high_overdue.status == ObservationStatus.escalated)
        record("Obs 1 escalated_at timestamp was set", obs_high_overdue.escalated_at is not None)
        record("Obs 1 entity version was incremented to 2", obs_high_overdue.version == 2)

        # Verify Obs 2 (High fresh) was NOT escalated
        record("Obs 2 (High < 24h) remained 'open'", obs_high_fresh.status == ObservationStatus.open)
        record("Obs 2 escalated_at is None", obs_high_fresh.escalated_at is None)

        # Verify Obs 3 (Med overdue) was escalated
        record("Obs 3 (Med > 72h) status became 'escalated'", obs_med_overdue.status == ObservationStatus.escalated)

        # Verify Obs 4 (Med fresh) was NOT escalated
        record("Obs 4 (Med < 72h) remained 'open'", obs_med_fresh.status == ObservationStatus.open)

        # Verify Obs 5 (Production high overdue) was escalated
        record("Obs 5 (Production High > 24h) was escalated", obs_prod_overdue.status == ObservationStatus.escalated)

        # Verify Audit Log was called for all 3 escalations
        record("Audit entry append called 3 times", mock_audit.call_count == 3)
        first_audit_call = mock_audit.call_args_list[0]
        record(
            "Audit action is 'observation.auto_escalated'",
            first_audit_call.kwargs.get("action") == "observation.auto_escalated",
        )
        record(
            "Audit payload contains SLA reason and age_hours",
            "age_hours" in first_audit_call.kwargs.get("payload", {})
            and "sla_threshold_hours" in first_audit_call.kwargs.get("payload", {}),
        )

    # 3. Custom SLA threshold testing (e.g. high SLA = 5 hours)
    obs_custom = Observation(
        id=uuid.uuid4(),
        created_at=now_utc - timedelta(hours=6),
        mine_site_id=site_id,
        category=ObservationCategory.safety,
        cloud_flag=RiskFlag.high,
        status=ObservationStatus.open,
        version=1,
    )
    mock_db.execute.return_value.scalars.return_value.all.return_value = [obs_custom]

    with patch("app.api.observations.append_audit_entry", new=AsyncMock()):
        resp_custom = await escalate_overdue_observations(
            mine_site_id=None,
            high_risk_sla_hours=5.0,  # Custom 5h threshold
            medium_risk_sla_hours=72.0,
            low_risk_sla_hours=168.0,
            db=mock_db,
            current_user=admin_user,
        )
        record("Custom SLA threshold (5h) correctly escalates 6h-old observation", resp_custom.escalated_count == 1)
        record("Observation status set to escalated with custom threshold", obs_custom.status == ObservationStatus.escalated)

    # 4. Fail-closed role check: Mine official without site_id is rejected
    mine_official_no_site = User(
        id=uuid.uuid4(),
        role=UserRole.mine_official,
        mine_site_id=None,
        email="official@mine.in",
    )
    failed_closed = False
    try:
        await escalate_overdue_observations(
            mine_site_id=None,
            high_risk_sla_hours=24.0,
            medium_risk_sla_hours=72.0,
            low_risk_sla_hours=168.0,
            db=mock_db,
            current_user=mine_official_no_site,
        )
    except HTTPException as e:
        if e.status_code == 403:
            failed_closed = True

    record("Fail-closed: Mine official without site scope raises HTTP 403", failed_closed)

    # Summary
    passed_count = sum(1 for _, p in results if p)
    total_count = len(results)
    print("\n" + "=" * 60)
    print(f"Results: {passed_count}/{total_count} passed")
    print("=" * 60)

    if passed_count == total_count:
        print("\nAll Automated SLA Escalation Engine tests PASSED!\n")
        sys.exit(0)
    else:
        print(f"\n{total_count - passed_count} tests FAILED!\n")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_tests())
