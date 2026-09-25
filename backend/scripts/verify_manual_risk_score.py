"""
verify_manual_risk_score.py
Automated end-to-end test for Manual Risk Score Feature & DGMS Safety Floor.
Verifies:
1. Auto (AI) mode persists risk_score_source="ai_auto".
2. Manual mode with justification persists risk_score_source="manual" & manual_score_reason.
3. Manual mode with DGMS critical keyword ("roof collapse") cannot bypass safety floor:
   forced to risk_score_source="dgms_override", edge_score=0.95, edge_flag="high".
4. Batch sync endpoint (/sync/batch) replicates identical behavior for mobile offline outbox.
"""
import sys
import asyncio
import httpx

BASE_URL = "http://localhost:8000"

async def main():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        # 1. Login as inspector
        login_res = await client.post(
            "/auth/login",
            json={"email": "inspector1@mine.in", "password": "password123"}
        )
        
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Logged in successfully.")

        # Test Case 1: Auto (AI) Mode
        obs_auto_payload = {
            "category": "safety",
            "description": "Routine roadway clearance and belt conveyor roller check at West Level.",
            "edge_score": 0.35,
            "edge_flag": "low",
            "risk_score_source": "ai_auto",
            "manual_score_reason": None,
        }
        res1 = await client.post("/observations/", json=obs_auto_payload, headers=headers)
        assert res1.status_code == 201, f"Test 1 failed: {res1.text}"
        data1 = res1.json()
        assert data1["risk_score_source"] == "ai_auto", f"Expected ai_auto, got {data1['risk_score_source']}"
        assert data1["manual_score_reason"] is None, f"Expected None reason, got {data1['manual_score_reason']}"
        print("Test 1 PASS: Auto mode correctly tagged as 'ai_auto'.")

        # Test Case 2: Manual Mode with Justification
        obs_manual_payload = {
            "category": "safety",
            "description": "Loose coal rib spalling observed during shift handover. Temporary prop erected.",
            "edge_score": 0.70,
            "edge_flag": "medium",
            "risk_score_source": "manual",
            "manual_score_reason": "Visual inspection revealed 3 props bowed; inspector escalated risk index above AI baseline.",
        }
        res2 = await client.post("/observations/", json=obs_manual_payload, headers=headers)
        assert res2.status_code == 201, f"Test 2 failed: {res2.text}"
        data2 = res2.json()
        assert data2["risk_score_source"] == "manual", f"Expected manual, got {data2['risk_score_source']}"
        assert data2["manual_score_reason"] == obs_manual_payload["manual_score_reason"], f"Reason mismatch: {data2['manual_score_reason']}"
        assert data2["edge_score"] == 0.70, f"Expected 0.70, got {data2['edge_score']}"
        print("Test 2 PASS: Manual mode correctly tagged as 'manual' with justification preserved.")

        # Test Case 3: Manual Mode attempting to suppress DGMS Critical Keyword ("roof collapse")
        obs_critical_bypass_attempt = {
            "category": "safety",
            "description": "Major strata failure and roof collapse detected along gallery 4 north heading.",
            "edge_score": 0.10,  # Deliberate low score attempt
            "edge_flag": "low",  # Deliberate low flag attempt
            "risk_score_source": "manual",
            "manual_score_reason": "Inspector believes area is barricaded so score should be low.",
        }
        res3 = await client.post("/observations/", json=obs_critical_bypass_attempt, headers=headers)
        assert res3.status_code == 201, f"Test 3 failed: {res3.text}"
        data3 = res3.json()
        assert data3["risk_score_source"] == "dgms_override", f"Expected dgms_override, got {data3['risk_score_source']}"
        assert data3["edge_score"] == 0.95, f"Expected 0.95 floor, got {data3['edge_score']}"
        assert data3["edge_flag"] == "high", f"Expected high flag floor, got {data3['edge_flag']}"
        print("Test 3 PASS: DGMS critical keyword ('roof collapse') strictly enforced safety floor (0.95 HIGH, dgms_override) over manual attempt.")

        # Test Case 4: Sync Batch (Offline sync from Mobile)
        sync_payload = {
            "observations": [
                {
                    "category": "safety",
                    "description": "Inspection of pit haul road grader. Oil leak noted.",
                    "edge_score": 0.50,
                    "edge_flag": "medium",
                    "risk_score_source": "manual",
                    "manual_score_reason": "Grader brake hydraulic line weeping, classified medium severity.",
                },
                {
                    "category": "safety",
                    "description": "Hazardous gas leak detected near ventilation door 3: methane CH4 2.1%.",
                    "edge_score": 0.20,
                    "edge_flag": "low",
                    "risk_score_source": "manual",
                    "manual_score_reason": "Trying to bypass gas leak floor.",
                }
            ]
        }
        res4 = await client.post("/sync/batch", json=sync_payload, headers=headers)
        assert res4.status_code == 201, f"Test 4 sync failed: {res4.text}"
        sync_res = res4.json()
        assert sync_res["synced_count"] == 2, f"Expected 2 synced, got {sync_res['synced_count']}"
        synced_ids = sync_res["created_ids"]

        # Fetch synced observations from GET /observations/
        res_list = await client.get("/observations/?limit=10", headers=headers)
        assert res_list.status_code == 200
        all_obs = {item["id"]: item for item in res_list.json()}

        obs_synced_manual = all_obs.get(synced_ids[0])
        obs_synced_gas = all_obs.get(synced_ids[1])

        assert obs_synced_manual["risk_score_source"] == "manual"
        assert obs_synced_manual["manual_score_reason"] == "Grader brake hydraulic line weeping, classified medium severity."

        assert obs_synced_gas["risk_score_source"] == "dgms_override"
        assert obs_synced_gas["edge_score"] == 0.95
        assert obs_synced_gas["edge_flag"] == "high"

        print("Test 4 PASS: Batch sync endpoint persisted manual scoring & enforced DGMS critical floor identically.")
        print("\nALL 4 STATUTORY SAFETY VERIFICATIONS SUCCEEDED!")

if __name__ == "__main__":
    asyncio.run(main())
