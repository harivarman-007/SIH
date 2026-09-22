"""
verify_phase22_alerts.py
Phase 22 verification: real alert mechanism and APScheduler escalation.

Checks (backend-only: 17; dashboard: 13; total: 30):
1.  Alert model exists with correct columns
2.  Migration 005_add_alerts_table.py is present
3.  alerts.py API router exists with GET /alerts and PATCH /{id}/read
4.  AlertOut schema exists
5-7. Frontend: alerts.ts, AlertBell.tsx, App.tsx (SKIP when dashboard/ not mounted)
8.  scheduler.py: run_escalation_and_alert, Alert(mine_official/corporate), AsyncSessionLocal, SLA thresholds
9.  main.py registers alerts_router
10. main.py configures APScheduler lifespan startup
11. requirements.txt includes apscheduler
"""
import sys
from pathlib import Path

# Resolve paths: prefer /repo bind-mount (docker-compose.override.yml dev profile)
_REPO = Path("/repo")
BACKEND = _REPO / "backend" if _REPO.is_dir() else Path(__file__).parent.parent
DASHBOARD = _REPO / "dashboard" if _REPO.is_dir() else BACKEND.parent / "dashboard"

_passed = 0
_failed = 0
_skipped = 0


def check(label: str, condition: bool) -> bool:
    global _passed, _failed
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}")
    if condition:
        _passed += 1
    else:
        _failed += 1
    return condition


def skip(label: str, reason: str = "dashboard/ not mounted") -> None:
    global _skipped
    print(f"  [SKIP] {label} — {reason}")
    _skipped += 1


def main():
    global _passed, _failed, _skipped
    _passed = _failed = _skipped = 0

    print("\n=== Phase 22: Real Alert Mechanism & APScheduler Verification ===\n")

    # 1. Alert model
    models_text = (BACKEND / "app" / "models" / "__init__.py").read_text()
    check("Alert model class defined", "class Alert(Base):" in models_text)
    check("Alert.recipient_role column", "recipient_role" in models_text)
    check("Alert.mine_site_id column", "mine_site_id" in models_text and "ForeignKey(\"mine_sites.id\"" in models_text)
    check("Alert.observation_id column", "observation_id" in models_text and "ForeignKey(\"observations.id\"" in models_text)
    check("Alert.is_read column", "is_read" in models_text)

    # 2. Migration 005
    mig = BACKEND / "alembic" / "versions" / "005_add_alerts_table.py"
    check("Migration 005_add_alerts_table.py exists", mig.exists())
    if mig.exists():
        mig_text = mig.read_text()
        check("Migration 005 creates alerts table", "create_table" in mig_text and "alerts" in mig_text)
        check("Migration 005 has correct down_revision", "004_add_ocr_image_path" in mig_text)

    # 3. Alerts API router
    api_text = (BACKEND / "app" / "api" / "alerts.py").read_text()
    check("GET /alerts endpoint defined", "list_alerts" in api_text and "GET" in api_text)
    check("PATCH /alerts/{id}/read endpoint defined", "mark_alert_read" in api_text)
    check("Alerts API uses role-scoped query", "_alert_filter_for_user" in api_text)

    # 4. AlertOut schema
    schema_text = (BACKEND / "app" / "schemas" / "alerts.py").read_text()
    check("AlertOut schema defined", "class AlertOut" in schema_text)
    check("AlertOut has is_read field", "is_read" in schema_text)

    # 5-7. Frontend Dashboard Checks
    if DASHBOARD.is_dir():
        alerts_ts = DASHBOARD / "src" / "api" / "alerts.ts"
        check("alerts.ts API client exists", alerts_ts.exists())
        if alerts_ts.exists():
            ts_text = alerts_ts.read_text()
            check("Alert TypeScript interface defined", "interface Alert" in ts_text)
            check("fetchAlerts function exported", "fetchAlerts" in ts_text)
            check("markAlertRead function exported", "markAlertRead" in ts_text)
        else:
            skip("Alert TypeScript interface defined")
            skip("fetchAlerts function exported")
            skip("markAlertRead function exported")

        bell_path = DASHBOARD / "src" / "components" / "AlertBell.tsx"
        check("AlertBell.tsx component exists", bell_path.exists())
        if bell_path.exists():
            bell_text = bell_path.read_text()
            check("AlertBell renders bell icon with unread badge", "unreadCount" in bell_text and "Bell" in bell_text)
            check("AlertBell calls fetchAlerts from real API", "fetchAlerts" in bell_text)
            check("AlertBell calls markAlertRead on click", "markAlertRead" in bell_text)
            check("AlertBell polls every 60s", "60_000" in bell_text or "60000" in bell_text)
            check("AlertBell has no hardcoded fake alert data", "lorem" not in bell_text.lower() and "fake" not in bell_text.lower())
        else:
            for lbl in ["AlertBell renders bell icon", "fetchAlerts", "markAlertRead", "60s poll", "no fake data"]:
                skip(lbl)

        layout_path = DASHBOARD / "src" / "components" / "AppLayout.tsx"
        layout_text = layout_path.read_text() if layout_path.exists() else ""
        app_text = (DASHBOARD / "src" / "App.tsx").read_text()
        has_import = "AlertBell" in app_text or "AlertBell" in layout_text
        has_render = "<AlertBell" in app_text or "<AlertBell" in layout_text
        check("AppLayout.tsx imports AlertBell", has_import)
        check("AppLayout.tsx renders <AlertBell>", has_render)
    else:
        DASHBOARD_CHECKS = [
            "alerts.ts API client exists",
            "Alert TypeScript interface defined",
            "fetchAlerts function exported",
            "markAlertRead function exported",
            "AlertBell.tsx component exists",
            "AlertBell renders bell icon with unread badge",
            "AlertBell calls fetchAlerts from real API",
            "AlertBell calls markAlertRead on click",
            "AlertBell polls every 60s",
            "AlertBell has no hardcoded fake alert data",
            "App.tsx imports AlertBell",
            "App.tsx renders <AlertBell>",
        ]
        for lbl in DASHBOARD_CHECKS:
            skip(lbl, "dashboard/ not mounted — add docker-compose.override.yml for full coverage")

    # 8. Scheduler
    sched_text = (BACKEND / "app" / "scheduler.py").read_text()
    check("scheduler.py: run_escalation_and_alert function defined", "run_escalation_and_alert" in sched_text)
    check("scheduler.py: creates Alert for mine_official", "mine_official" in sched_text and "Alert(" in sched_text)
    check("scheduler.py: creates Alert for corporate_management", "corporate_management" in sched_text)
    check("scheduler.py: uses AsyncSessionLocal (not HTTP session)", "AsyncSessionLocal" in sched_text)
    check("scheduler.py: escalates by SLA thresholds", "SLA_HIGH_H" in sched_text and "SLA_MEDIUM_H" in sched_text)

    # 9. main.py registers alerts router
    main_text = (BACKEND / "app" / "main.py").read_text()
    check("main.py includes alerts_router", "alerts_router" in main_text)

    # 10. main.py has APScheduler lifespan
    check("main.py uses APScheduler AsyncIOScheduler", "AsyncIOScheduler" in main_text)
    check("main.py starts scheduler in lifespan", "lifespan" in main_text and "scheduler.start" in main_text)

    # 11. requirements.txt includes apscheduler
    reqs_text = (BACKEND / "requirements.txt").read_text()
    check("requirements.txt includes apscheduler", "apscheduler" in reqs_text.lower())

    # Summary
    print()
    total = _passed + _failed + _skipped
    if _failed == 0:
        print(f"PASS: {_passed}/{_passed + _failed} Phase 22 checks PASSED  [{_skipped} SKIPPED]")
    else:
        print(f"FAIL: {_failed} check(s) FAILED  ({_passed}/{_passed + _failed} passed, {_skipped} SKIPPED)")
    return _failed


if __name__ == "__main__":
    sys.exit(main())
