"""
test_phase1.py
Comprehensive automated test suite for Phase 1 API endpoints and RBAC verification.
"""
import sys
import httpx as requests

BASE_URL = "http://localhost:8000"

def run_tests():
    print("==================================================")
    print("STARTING PHASE 1 VERIFICATION TEST SUITE")
    print("==================================================")
    passed = 0
    total = 0

    def assert_true(condition, msg):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {msg}")
        else:
            print(f"  [FAIL] {msg}")
            sys.exit(1)

    # 1. Health & Root
    print("\n1. Testing System Endpoints...")
    r = requests.get(f"{BASE_URL}/health")
    assert_true(r.status_code == 200 and r.json().get("status") == "ok", "GET /health returns status ok")

    r = requests.get(f"{BASE_URL}/")
    assert_true(r.status_code == 200 and "endpoints" in r.json(), "GET / returns API index")

    # 2. Auth - Login for various roles
    print("\n2. Testing Auth Endpoints & Tokens...")
    # Inspector login
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": "inspector1@mine.in", "password": "password123"})
    assert_true(r.status_code == 200, "POST /auth/login (inspector1@mine.in)")
    inspector_token = r.json()["access_token"]
    inspector_id = r.json()["user"]["id"]
    inspector_headers = {"Authorization": f"Bearer {inspector_token}"}

    # Mine Official login
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": "official1@mine.in", "password": "password123"})
    assert_true(r.status_code == 200, "POST /auth/login (official1@mine.in)")
    official_token = r.json()["access_token"]
    official_site_id = r.json()["user"]["mine_site_id"]
    official_headers = {"Authorization": f"Bearer {official_token}"}

    # Regulator login
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": "regulator@dgms.gov.in", "password": "password123"})
    assert_true(r.status_code == 200, "POST /auth/login (regulator@dgms.gov.in)")
    regulator_token = r.json()["access_token"]
    regulator_headers = {"Authorization": f"Bearer {regulator_token}"}

    # GET /auth/me
    r = requests.get(f"{BASE_URL}/auth/me", headers=inspector_headers)
    assert_true(r.status_code == 200 and r.json()["email"] == "inspector1@mine.in", "GET /auth/me with Bearer token")

    # Invalid login test
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": "inspector1@mine.in", "password": "wrongpassword"})
    assert_true(r.status_code == 401, "POST /auth/login rejects invalid password with 401")

    # Registration test
    reg_payload = {
        "email": "new_inspector@mine.in",
        "password": "securepassword123",
        "full_name": "Test Inspector",
        "role": "inspector",
        "mine_site_id": official_site_id,
    }
    r = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
    assert_true(r.status_code in (201, 400), "POST /auth/register succeeds or returns 400 if existing")

    # 3. RBAC Verification
    print("\n3. Testing Role-Based Access Control (RBAC)...")
    # Inspector should NOT be able to access /audit/log (regulator only)
    r = requests.get(f"{BASE_URL}/audit/log", headers=inspector_headers)
    assert_true(r.status_code == 403, "Inspector access to /audit/log is 403 Forbidden")

    # Mine Official should NOT be able to access /audit/log (regulator only)
    r = requests.get(f"{BASE_URL}/audit/log", headers=official_headers)
    assert_true(r.status_code == 403, "Mine Official access to /audit/log is 403 Forbidden")

    # Regulator CAN access /audit/log
    r = requests.get(f"{BASE_URL}/audit/log", headers=regulator_headers)
    assert_true(r.status_code == 200 and len(r.json()) > 0, "Regulator access to /audit/log is 200 OK")

    # 4. Hash-Chain Verification
    print("\n4. Testing Audit Log Hash-Chain Verification...")
    r = requests.get(f"{BASE_URL}/audit/verify", headers=inspector_headers)
    assert_true(r.status_code == 200, "GET /audit/verify status 200")
    audit_verify_data = r.json()
    assert_true(audit_verify_data["is_valid"] is True, f"Hash-chain is valid ({audit_verify_data['total_checked']} records checked)")
    assert_true(audit_verify_data["broken_at_id"] is None, "broken_at_id is None")

    # 5. Observations CRUD & Role-Scoping
    print("\n5. Testing Observations List, Detail & Scoping...")
    # List as Regulator (all)
    r = requests.get(f"{BASE_URL}/observations/?limit=100", headers=regulator_headers)
    assert_true(r.status_code == 200, "GET /observations/ as Regulator")
    all_obs = r.json()
    total_regulator_seen = len(all_obs)
    assert_true(total_regulator_seen > 0, f"Regulator sees observations ({total_regulator_seen} returned)")

    sample_obs = all_obs[0]
    sample_obs_id = sample_obs["id"]

    # List as Inspector (only own)
    r = requests.get(f"{BASE_URL}/observations/", headers=inspector_headers)
    assert_true(r.status_code == 200, "GET /observations/ as Inspector")
    inspector_obs = r.json()
    for o in inspector_obs:
        assert_true(o["inspector_id"] == inspector_id, f"Inspector only sees own obs (id: {o['id']})")

    # Detail as Regulator
    r = requests.get(f"{BASE_URL}/observations/{sample_obs_id}", headers=regulator_headers)
    assert_true(r.status_code == 200 and r.json()["id"] == sample_obs_id, f"GET /observations/{sample_obs_id}")

    # Risk Card
    r = requests.get(f"{BASE_URL}/observations/{sample_obs_id}/risk-card", headers=regulator_headers)
    assert_true(r.status_code == 200 and r.json()["observation_id"] == sample_obs_id, "GET /observations/{id}/risk-card")
    assert_true("category" in r.json() and "status" in r.json(), "Risk card contains category and status")

    # 6. Create Observation (Single)
    print("\n6. Testing POST /observations/ Creation...")
    create_payload = {
        "category": "safety",
        "description": "Loose boulder observed near haul road bend during shift inspection.",
        "mine_site_id": sample_obs["mine_site_id"],
        "zone_id": sample_obs["zone_id"],
        "photo_url": "https://storage.example.com/photos/boulder.jpg",
        "has_photo": True,
        "lat": 23.7960,
        "lng": 86.4310,
        "edge_score": 0.82,
        "edge_flag": "high",
        "edge_reasons": {"zone_risk_baseline": 0.75, "keyword_safety_flag": 1},
    }
    r = requests.post(f"{BASE_URL}/observations/", json=create_payload, headers=inspector_headers)
    assert_true(r.status_code == 201, "POST /observations/ creates observation (201 Created)")
    new_obs_id = r.json()["id"]

    # 7. Close Observation & RBAC
    print("\n7. Testing PATCH /observations/{id}/close...")
    # Inspector CANNOT close observation
    r = requests.patch(
        f"{BASE_URL}/observations/{new_obs_id}/close",
        json={"closure_note": "Inspector trying to close", "closure_photo_url": None},
        headers=inspector_headers,
    )
    assert_true(r.status_code == 403, "Inspector cannot close observation (403 Forbidden)")

    # Regulator or Mine Official CAN close observation
    r = requests.patch(
        f"{BASE_URL}/observations/{new_obs_id}/close",
        json={
            "closure_note": "Boulder cleared by earthmoving crew. Haul road inspected and cleared for transport.",
            "closure_photo_url": "https://storage.example.com/photos/cleared.jpg",
        },
        headers=regulator_headers,
    )
    assert_true(r.status_code == 200 and r.json()["status"] == "closed", "Regulator closes observation (200 OK, status: closed)")
    assert_true(r.json()["closure_note"] is not None, "Closure note persisted on observation")

    # 8. Batch Sync & Status KPI
    print("\n8. Testing Batch Sync & Sync KPI...")
    sync_payload = {
        "observations": [
            {
                "category": "environment",
                "description": "Water discharge turbidity above permissible threshold in Zone B runoff.",
                "mine_site_id": sample_obs["mine_site_id"],
                "zone_id": sample_obs["zone_id"],
                "edge_score": 0.65,
                "edge_flag": "medium",
                "edge_reasons": {"keyword_env_flag": 1},
            },
            {
                "category": "labour",
                "description": "PPE compliance check: 2 contractors missing high-visibility vests.",
                "mine_site_id": sample_obs["mine_site_id"],
                "zone_id": sample_obs["zone_id"],
                "edge_score": 0.35,
                "edge_flag": "low",
                "edge_reasons": {"keyword_labour_flag": 1},
            }
        ]
    }
    r = requests.post(f"{BASE_URL}/sync/batch", json=sync_payload, headers=inspector_headers)
    assert_true(r.status_code == 201, "POST /sync/batch creates batch (201 Created)")
    assert_true(r.json()["synced_count"] == 2, "POST /sync/batch returns synced_count: 2")

    # GET /sync/status
    r = requests.get(f"{BASE_URL}/sync/status", headers=inspector_headers)
    assert_true(r.status_code == 200, "GET /sync/status returns 200 OK")
    sync_status = r.json()
    assert_true("sync_rate_pct" in sync_status and sync_status["sync_rate_pct"] > 0, f"Sync rate KPI is {sync_status['sync_rate_pct']}%")

    # 9. KPI Summary
    print("\n9. Testing GET /kpi/...")
    r = requests.get(f"{BASE_URL}/kpi/", headers=regulator_headers)
    assert_true(r.status_code == 200, "GET /kpi/ returns 200 OK")
    kpi_data = r.json()
    assert_true(kpi_data["total_observations"] > 0, f"Total observations in KPI: {kpi_data['total_observations']}")
    assert_true("open_high_risk_count" in kpi_data, f"Open high risk count: {kpi_data['open_high_risk_count']}")
    assert_true("avg_time_to_closure_hours" in kpi_data, f"Avg closure hours: {kpi_data['avg_time_to_closure_hours']}")
    assert_true("by_category" in kpi_data and "safety" in kpi_data["by_category"], "Category breakdown in KPI")

    # 10. Audit Chain Re-verification (chain preserved after new writes)
    print("\n10. Re-verifying Audit Chain after new writes...")
    r = requests.get(f"{BASE_URL}/audit/verify", headers=regulator_headers)
    assert_true(r.status_code == 200, "GET /audit/verify status 200 after writes")
    assert_true(r.json()["is_valid"] is True, f"Hash-chain is still valid across {r.json()['total_checked']} records")

    print("\n==================================================")
    print(f"ALL {passed}/{total} PHASE 1 TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
