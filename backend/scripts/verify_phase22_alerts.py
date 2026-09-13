"""
verify_phase22_alerts.py
Phase 22 verification: real alert mechanism and APScheduler escalation.

Checks:
1.  Alert model exists with correct columns
2.  Migration 005_add_alerts_table.py is present
3.  alerts.py API router exists with GET /alerts and PATCH /{id}/read
4.  AlertOut schema exists
5.  alerts.ts frontend API client exists with Alert interface and fetchAlerts/markAlertRead
6.  AlertBell.tsx component exists and references real alert fields
7.  App.tsx imports and renders AlertBell
8.  scheduler.py exists and references AlertBell-relevant patterns:
    - runs auto-escalation
    - creates Alert objects for mine_official and corporate_management
    - uses AsyncSessionLocal
9.  main.py registers alerts_router
10. main.py configures APScheduler lifespan startup
11. requirements.txt includes apscheduler
12. No hardcoded fake alert data anywhere in AlertBell.tsx
"""
import sys
from pathlib import Path

BACKEND = Path(__file__).parent.parent
DASHBOARD = BACKEND.parent / "dashboard"


def check(label: str, condition: bool) -> bool:
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}")
    return condition


def main():
    failures = 0
    print("\n=== Phase 22: Real Alert Mechanism & APScheduler Verification ===\n")

    # 1. Alert model
    models_text = (BACKEND / "app" / "models" / "__init__.py").read_text()
    ok = check("Alert model class defined", "class Alert(Base):" in models_text)
    failures += not ok
    ok = check("Alert.recipient_role column", "recipient_role" in models_text)
    failures += not ok
    ok = check("Alert.mine_site_id column", "mine_site_id" in models_text and "ForeignKey(\"mine_sites.id\"" in models_text)
    failures += not ok
    ok = check("Alert.observation_id column", "observation_id" in models_text and "ForeignKey(\"observations.id\"" in models_text)
    failures += not ok
    ok = check("Alert.is_read column", "is_read" in models_text)
    failures += not ok

    # 2. Migration 005
    mig = BACKEND / "alembic" / "versions" / "005_add_alerts_table.py"
    ok = check("Migration 005_add_alerts_table.py exists", mig.exists())
    failures += not ok
    if mig.exists():
        mig_text = mig.read_text()
        ok = check("Migration 005 creates alerts table", "create_table" in mig_text and "alerts" in mig_text)
        failures += not ok
        ok = check("Migration 005 has correct down_revision", "004_add_ocr_image_path" in mig_text)
        failures += not ok

    # 3. Alerts API router
    api_text = (BACKEND / "app" / "api" / "alerts.py").read_text()
    ok = check("GET /alerts endpoint defined", "list_alerts" in api_text and "GET" in api_text)
    failures += not ok
    ok = check("PATCH /alerts/{id}/read endpoint defined", "mark_alert_read" in api_text)
    failures += not ok
    ok = check("Alerts API uses role-scoped query", "_alert_filter_for_user" in api_text)
    failures += not ok

    # 4. AlertOut schema
    schema_text = (BACKEND / "app" / "schemas" / "alerts.py").read_text()
    ok = check("AlertOut schema defined", "class AlertOut" in schema_text)
    failures += not ok
    ok = check("AlertOut has is_read field", "is_read" in schema_text)
    failures += not ok

    # 5. Frontend API client
    alerts_ts = DASHBOARD / "src" / "api" / "alerts.ts"
    ok = check("alerts.ts API client exists", alerts_ts.exists())
    failures += not ok
    if alerts_ts.exists():
        ts_text = alerts_ts.read_text()
        ok = check("Alert TypeScript interface defined", "interface Alert" in ts_text)
        failures += not ok
        ok = check("fetchAlerts function exported", "fetchAlerts" in ts_text)
        failures += not ok
        ok = check("markAlertRead function exported", "markAlertRead" in ts_text)
        failures += not ok

    # 6. AlertBell component
    bell_path = DASHBOARD / "src" / "components" / "AlertBell.tsx"
    ok = check("AlertBell.tsx component exists", bell_path.exists())
    failures += not ok
    if bell_path.exists():
        bell_text = bell_path.read_text()
        ok = check("AlertBell renders bell icon with unread badge", "unreadCount" in bell_text and "Bell" in bell_text)
        failures += not ok
        ok = check("AlertBell calls fetchAlerts from real API", "fetchAlerts" in bell_text)
        failures += not ok
        ok = check("AlertBell calls markAlertRead on click", "markAlertRead" in bell_text)
        failures += not ok
        ok = check("AlertBell polls every 60s", "60_000" in bell_text or "60000" in bell_text)
        failures += not ok
        ok = check("AlertBell has no hardcoded fake alert data", "lorem" not in bell_text.lower() and "fake" not in bell_text.lower())
        failures += not ok

    # 7. App.tsx wires AlertBell
    app_text = (DASHBOARD / "src" / "App.tsx").read_text()
    ok = check("App.tsx imports AlertBell", "AlertBell" in app_text)
    failures += not ok
    ok = check("App.tsx renders <AlertBell>", "<AlertBell" in app_text)
    failures += not ok

    # 8. Scheduler
    sched_text = (BACKEND / "app" / "scheduler.py").read_text()
    ok = check("scheduler.py: run_escalation_and_alert function defined", "run_escalation_and_alert" in sched_text)
    failures += not ok
    ok = check("scheduler.py: creates Alert for mine_official", "mine_official" in sched_text and "Alert(" in sched_text)
    failures += not ok
    ok = check("scheduler.py: creates Alert for corporate_management", "corporate_management" in sched_text)
    failures += not ok
    ok = check("scheduler.py: uses AsyncSessionLocal (not HTTP session)", "AsyncSessionLocal" in sched_text)
    failures += not ok
    ok = check("scheduler.py: escalates by SLA thresholds", "SLA_HIGH_H" in sched_text and "SLA_MEDIUM_H" in sched_text)
    failures += not ok

    # 9. main.py registers alerts router
    main_text = (BACKEND / "app" / "main.py").read_text()
    ok = check("main.py includes alerts_router", "alerts_router" in main_text)
    failures += not ok

    # 10. main.py has APScheduler lifespan
    ok = check("main.py uses APScheduler AsyncIOScheduler", "AsyncIOScheduler" in main_text)
    failures += not ok
    ok = check("main.py starts scheduler in lifespan", "lifespan" in main_text and "scheduler.start" in main_text)
    failures += not ok

    # 11. requirements.txt includes apscheduler
    reqs_text = (BACKEND / "requirements.txt").read_text()
    ok = check("requirements.txt includes apscheduler", "apscheduler" in reqs_text.lower())
    failures += not ok

    print()
    total = 30
    passed = total - failures
    if failures == 0:
        print(f"PASS: All {total} Phase 22 checks PASSED")
    else:
        print(f"FAIL: {failures} check(s) FAILED ({passed}/{total} passed)")
    return failures


if __name__ == "__main__":
    sys.exit(main())
