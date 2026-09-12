"""
verify_sync_enrichment_e2e.py
End-to-end integration test verifying that POST /sync/batch enriches observations
with cloud_score, cloud_flag, cloud_reasons, and suggested_action.
"""

import sys
from datetime import datetime, timezone
import httpx

BASE_URL = "http://localhost:8000"

def test_sync_enrichment_e2e():
    print("=" * 60)
    print("RUNNING END-TO-END SYNC & ENRICHMENT TEST")
    print("=" * 60)

    # 1. Login as Inspector
    print("\n1. Logging in as inspector...")
    r = httpx.post(f"{BASE_URL}/auth/login", json={"email": "inspector1@mine.in", "password": "password123"})
    assert r.status_code == 200, f"Inspector login failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   Inspector authenticated.")

    # 1b. Also login as regulator to inspect existing observations
    r_reg = httpx.post(f"{BASE_URL}/auth/login", json={"email": "regulator@dgms.gov.in", "password": "password123"})
    assert r_reg.status_code == 200
    reg_headers = {"Authorization": f"Bearer {r_reg.json()['access_token']}"}

    # 2. Fetch an existing observation to obtain valid mine_site_id and zone_id
    print("\n2. Fetching existing observation for valid site/zone IDs...")
    r = httpx.get(f"{BASE_URL}/observations/?limit=5", headers=reg_headers)
    assert r.status_code == 200, f"Failed to get observations: {r.text}"
    existing_obs = r.json()
    assert len(existing_obs) > 0, "No existing observations found in database"
    site_id = existing_obs[0]["mine_site_id"]
    zone_id = existing_obs[0]["zone_id"]
    print(f"   Using mine_site_id={site_id}, zone_id={zone_id}")

    # 3. Post a batch of 3 observations via /sync/batch
    print("\n3. POST /sync/batch with safety, environment, and labour observations...")
    batch_payload = {
        "observations": [
            {
                "mine_site_id": site_id,
                "zone_id": zone_id,
                "category": "safety",
                "description": "Urgent: Significant roof fall in gallery 4 near working face. Immediate support failure.",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "has_photo": True,
                "edge_score": 0.95,
                "edge_flag": "high",
                "edge_reasons": {"rule_triggers": ["crack/spall/fall"], "baseline": 0.85},
            },
            {
                "mine_site_id": site_id,
                "zone_id": zone_id,
                "category": "environment",
                "description": "Heavy particulate dust plume and effluent runoff into settling pond exceeding norm.",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "has_photo": True,
                "edge_score": 0.72,
                "edge_flag": "high",
                "edge_reasons": {"rule_triggers": ["dust plume"]},
            },
            {
                "mine_site_id": site_id,
                "zone_id": zone_id,
                "category": "labour",
                "description": "Routine shift changeover. PPE inspection showed 2 workers missing helmets, advisory given.",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "has_photo": False,
                "edge_score": 0.25,
                "edge_flag": "low",
                "edge_reasons": {},
            }
        ]
    }

    r = httpx.post(f"{BASE_URL}/sync/batch", json=batch_payload, headers=headers)
    assert r.status_code == 201, f"Sync batch failed ({r.status_code}): {r.text}"
    res = r.json()
    assert res["synced_count"] == 3, f"Expected 3 synced, got {res['synced_count']}"
    created_ids = res["created_ids"]
    print(f"   Successfully synced 3 observations. IDs: {created_ids}")

    # 4. Fetch each observation and verify enrichment fields
    print("\n4. Verifying cloud enrichment fields on created observations...")
    for obs_id in created_ids:
        r = httpx.get(f"{BASE_URL}/observations/{obs_id}", headers=headers)
        assert r.status_code == 200, f"Failed to get observation {obs_id}: {r.text}"
        obs = r.json()

        print(f"\n   Observation ID: {obs['id']}")
        print(f"     Category:         {obs['category']}")
        print(f"     Edge Score/Flag:  {obs.get('edge_score')} / {obs.get('edge_flag')}")
        print(f"     Cloud Score:      {obs.get('cloud_score')}")
        print(f"     Cloud Flag:       {obs.get('cloud_flag')}")
        print(f"     Cloud Reasons:    {obs.get('cloud_reasons')}")
        print(f"     Suggested Action: {obs.get('suggested_action')}")
        print(f"     Enriched At:      {obs.get('enriched_at')}")

        assert obs.get("cloud_score") is not None, f"cloud_score missing for {obs_id}"
        assert obs.get("cloud_flag") is not None, f"cloud_flag missing for {obs_id}"
        assert obs.get("suggested_action") is not None, f"suggested_action missing for {obs_id}"
        assert len(obs["suggested_action"]) > 20, "Suggested action text is too short"
        assert obs.get("cloud_reasons") is not None, f"cloud_reasons missing for {obs_id}"
        assert "top_contributors" in obs["cloud_reasons"], "top_contributors missing"

    # 5. Check sync status endpoint
    print("\n5. Checking /sync/status endpoint...")
    r = httpx.get(f"{BASE_URL}/sync/status", headers=headers)
    assert r.status_code == 200, f"Sync status failed: {r.text}"
    status_data = r.json()
    print(f"   Sync Status: {status_data}")
    assert status_data["synced_observations"] >= 3, "Synced count not reflecting synced items"

    print("\n" + "=" * 60)
    print("ALL END-TO-END SYNC & ENRICHMENT CHECKS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    test_sync_enrichment_e2e()
