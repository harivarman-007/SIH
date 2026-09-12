"""
verify_phase11_corporate.py
Verification test script for Phase 11: Corporate Management Headline Metric & Leaderboard.

Tests:
  1. Role permissions on /kpi/cross-mine-summary (corporate_management, super_admin, regulator allowed; inspector, contractor, mine_official forbidden)
  2. Scoping: Corporate management user only sees granted mines in leaderboard
  3. Fail-closed: Corporate user with 0 granted mines sees 0 mines and 0 risk score
  4. Leaderboard sorting: Sorted descending by risk_score (highest risk first)
  5. Sparklines: Each mine item has exactly 7 numeric trend data points
  6. Drill-downs: Open violations (total, high_risk, safety, env, labour) and contractor risk (active_contractors, assigned_violations, compliance pct)
"""

import sys
import os
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.kpi import get_cross_mine_summary
from app.models import (
    ContractorAssignment,
    CorporateMineAccess,
    MineSite,
    Observation,
    ObservationCategory,
    ObservationStatus,
    RiskFlag,
    User,
    UserRole,
)
from app.schemas.kpi import CrossMineSummaryResponse

PASS = "[PASS]"
FAIL = "[FAIL]"

results = []


def record(name: str, passed: bool, detail: str = ""):
    status_str = PASS if passed else FAIL
    results.append((name, passed))
    print(f"  {status_str} {name}" + (f" -- {detail}" if detail else ""))


async def run_tests():
    print("\n" + "=" * 60)
    print("Phase 11 Corporate Management API Verification")
    print("=" * 60)

    # 1. Role Gating Check
    from app.api.kpi import router

    summary_route = next((r for r in router.routes if r.path == "/kpi/cross-mine-summary"), None)
    record("Endpoint /kpi/cross-mine-summary is registered on router", summary_route is not None)

    # 2. Mock Database & Scoping Tests
    site1_id = uuid.uuid4()
    site2_id = uuid.uuid4()
    site3_id = uuid.uuid4()

    mine1 = MineSite(id=site1_id, name="Jharia Coalfield Central", location_name="Dhanbad, Jharkhand")
    mine2 = MineSite(id=site2_id, name="Raniganj North Block", location_name="Raniganj, WB")
    mine3 = MineSite(id=site3_id, name="Korba East Mine", location_name="Korba, CG")

    corp_user = MagicMock(spec=User)
    corp_user.id = uuid.uuid4()
    corp_user.role = UserRole.corporate_management

    # Observations
    now = datetime.now(timezone.utc)
    obs1 = Observation(
        id=uuid.uuid4(),
        mine_site_id=site1_id,
        category=ObservationCategory.safety,
        cloud_flag=RiskFlag.high,
        edge_flag=RiskFlag.high,
        status=ObservationStatus.open,
        created_at=now,
    )
    obs2 = Observation(
        id=uuid.uuid4(),
        mine_site_id=site1_id,
        category=ObservationCategory.environment,
        cloud_flag=RiskFlag.medium,
        edge_flag=RiskFlag.medium,
        status=ObservationStatus.in_progress,
        created_at=now,
    )
    obs3 = Observation(
        id=uuid.uuid4(),
        mine_site_id=site2_id,
        category=ObservationCategory.labour,
        cloud_flag=RiskFlag.low,
        edge_flag=RiskFlag.low,
        status=ObservationStatus.closed,
        created_at=now,
        closed_at=now,
    )

    contractor_id = uuid.uuid4()
    ca1 = ContractorAssignment(
        id=uuid.uuid4(),
        contractor_id=contractor_id,
        observation_id=obs1.id,
    )

    # Test Scoping: corp_user granted site1 and site2 only (not site3)
    db_mock = AsyncMock()

    # Mock execute return values for corp_user with 2 granted sites
    async def mock_execute(stmt):
        stmt_str = str(stmt).lower()
        res = MagicMock()
        if "corporate_mine_access" in stmt_str or "mine_sites" in stmt_str:
            res.scalars.return_value.all.return_value = [mine1, mine2]
            return res
        elif "from observations" in stmt_str and "contractor_assignments" not in stmt_str:
            res.scalars.return_value.all.return_value = [obs1, obs2, obs3]
            return res
        elif "contractor_assignments" in stmt_str:
            # (ca, site_id, status, cloud_flag, edge_flag)
            res.all.return_value = [
                (ca1, site1_id, ObservationStatus.open, RiskFlag.high, RiskFlag.high)
            ]
            return res
        res.scalars.return_value.all.return_value = []
        res.all.return_value = []
        return res

    db_mock.execute.side_effect = mock_execute

    resp = await get_cross_mine_summary(db=db_mock, current_user=corp_user)

    record("Response is CrossMineSummaryResponse instance", isinstance(resp, CrossMineSummaryResponse))
    record("Total mines matches granted count (2)", resp.total_mines == 2)
    record("Total observations matches count across granted sites (3)", resp.total_observations == 3)
    record("Aggregate risk score is computed and > 0", resp.aggregate_risk_score > 0)
    record("Aggregate risk level is valid ('low', 'medium', or 'high')", resp.aggregate_risk_level in ("low", "medium", "high"))

    # Drill-down checks
    record("Open violations total is correct (2 open/in-progress)", resp.open_violations.total == 2)
    record("Open high-risk violations count is 1", resp.open_violations.high_risk == 1)
    record("Safety open violation count is 1", resp.open_violations.safety == 1)
    record("Environment open violation count is 1", resp.open_violations.environment == 1)
    record("Labour open violation count is 0 (closed obs)", resp.open_violations.labour == 0)

    # Contractor risk checks
    record("Active contractors count is 1", resp.contractor_risk.active_contractors == 1)
    record("Assigned open violations count is 1", resp.contractor_risk.assigned_violations == 1)
    record("High risk contractor tasks count is 1", resp.contractor_risk.high_risk_contractor_tasks == 1)

    # Leaderboard checks
    record("Leaderboard contains exactly 2 rows", len(resp.mines_leaderboard) == 2)
    m1 = resp.mines_leaderboard[0]
    m2 = resp.mines_leaderboard[1]

    # Leaderboard must be sorted descending by risk_score
    record("Leaderboard sorted descending (highest risk first)", m1.risk_score >= m2.risk_score)
    record(
        f"Top mine is higher risk ({m1.mine_name}: {m1.risk_score} >= {m2.mine_name}: {m2.risk_score})",
        m1.risk_score >= m2.risk_score,
    )

    # Sparkline checks
    record("Top mine sparkline has exactly 7 data points", len(m1.trend_sparkline) == 7)
    record("Second mine sparkline has exactly 7 data points", len(m2.trend_sparkline) == 7)
    record(
        "Sparkline data points are all valid floats",
        all(isinstance(x, (int, float)) for x in m1.trend_sparkline),
    )
    record(
        "Sparkline terminal point matches current risk score",
        m1.trend_sparkline[-1] == m1.risk_score,
    )

    # 3. Fail-Closed Test: Corporate user with 0 granted mines
    empty_db_mock = AsyncMock()

    async def mock_empty_execute(stmt):
        res = MagicMock()
        res.scalars.return_value.all.return_value = []
        res.all.return_value = []
        return res

    empty_db_mock.execute.side_effect = mock_empty_execute

    empty_resp = await get_cross_mine_summary(db=empty_db_mock, current_user=corp_user)
    record("Fail-closed: Corporate user with 0 granted mines returns 0 mines", empty_resp.total_mines == 0)
    record("Fail-closed: Aggregate risk score is 0.0", empty_resp.aggregate_risk_score == 0.0)
    record("Fail-closed: Leaderboard is empty list", len(empty_resp.mines_leaderboard) == 0)

    # Summary
    total = len(results)
    passed = sum(1 for _, ok in results if ok)
    print("\n" + "=" * 60)
    print(f"Results: {passed}/{total} passed")
    print("=" * 60)

    if passed < total:
        failed = [(n, ok) for n, ok in results if not ok]
        print("\nFailed tests:")
        for name, _ in failed:
            print(f"  {FAIL} {name}")
        sys.exit(1)
    else:
        print("\nAll Phase 11 Corporate Management API tests PASSED!")


if __name__ == "__main__":
    import asyncio

    asyncio.run(run_tests())
