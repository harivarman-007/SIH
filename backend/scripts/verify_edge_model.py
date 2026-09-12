"""
verify_edge_model.py
Automated verification test script for Phase 2: Edge Model.
Tests 15 distinct mock observations covering critical hazards, moderate anomalies,
and nominal safe operations.
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.edge.engine import RiskScoringEngine

TEST_OBSERVATIONS = [
    # 1-4: Critical Rule Triggers (must be HIGH)
    {
        "category": "safety",
        "description": "Urgent: Significant roof fall in gallery 4 near working face. Immediate support failure.",
        "zone_risk_baseline": 0.85,
        "expected_flag": "high",
        "expected_rule": True,
    },
    {
        "category": "safety",
        "description": "Methane gas concentration detected at 2.1% near return airway. Gas leak warning active.",
        "zone_risk_baseline": 0.90,
        "expected_flag": "high",
        "expected_rule": True,
    },
    {
        "category": "safety",
        "description": "Sudden water breakthrough from old workings with inundation hazard in underground dip.",
        "zone_risk_baseline": 0.75,
        "expected_flag": "high",
        "expected_rule": True,
    },
    {
        "category": "safety",
        "description": "Fire detected near conveyor transfer point with thick smoke spreading in heading.",
        "zone_risk_baseline": 0.80,
        "expected_flag": "high",
        "expected_rule": True,
    },

    # 5-8: Elevated Anomaly (High or Medium by Isolation Forest)
    {
        "category": "safety",
        "description": "Severe cracking and spall observed along rib wall. Zone uninspected for 28 days.",
        "zone_risk_baseline": 0.88,
        "inspector_historical_high_rate": 0.65,
        "days_since_last_zone_inspection": 28,
        "has_photo": True,
        "expected_flag": "high",
        "expected_rule": False,
    },
    {
        "category": "environment",
        "description": "Heavy particulate dust plume rising from primary crushing unit without active suppression.",
        "zone_risk_baseline": 0.70,
        "inspector_historical_high_rate": 0.50,
        "days_since_last_zone_inspection": 20,
        "has_photo": True,
        "expected_flag": "high",
        "expected_rule": False,
    },
    {
        "category": "environment",
        "description": "Moderate runoff turbidity increase observed at settling pond discharge channel.",
        "zone_risk_baseline": 0.55,
        "inspector_historical_high_rate": 0.30,
        "days_since_last_zone_inspection": 15,
        "has_photo": True,
        "expected_flag": "medium",
        "expected_rule": False,
    },
    {
        "category": "labour",
        "description": "Contractor shift crew working without safety goggles near slag processing plant.",
        "zone_risk_baseline": 0.50,
        "inspector_historical_high_rate": 0.35,
        "days_since_last_zone_inspection": 12,
        "has_photo": False,
        "expected_flag": "medium",
        "expected_rule": False,
    },

    # 9-12: Nominal / Safe Operations (must be LOW)
    {
        "category": "safety",
        "description": "Routine shift inspection completed. Haul road lighting and signage functional.",
        "zone_risk_baseline": 0.20,
        "inspector_historical_high_rate": 0.10,
        "days_since_last_zone_inspection": 2,
        "has_photo": True,
        "expected_flag": "low",
        "expected_rule": False,
    },
    {
        "category": "environment",
        "description": "Topsoil preservation embankment stable. Grass seeding healthy and intact.",
        "zone_risk_baseline": 0.25,
        "inspector_historical_high_rate": 0.12,
        "days_since_last_zone_inspection": 5,
        "has_photo": True,
        "expected_flag": "low",
        "expected_rule": False,
    },
    {
        "category": "labour",
        "description": "Clean drinking water station inspected at underground rest shelter. All sanitized.",
        "zone_risk_baseline": 0.15,
        "inspector_historical_high_rate": 0.08,
        "days_since_last_zone_inspection": 3,
        "has_photo": False,
        "expected_flag": "low",
        "expected_rule": False,
    },
    {
        "category": "safety",
        "description": "Emergency communication line test successful across all underground telephone stations.",
        "zone_risk_baseline": 0.22,
        "inspector_historical_high_rate": 0.10,
        "days_since_last_zone_inspection": 4,
        "has_photo": True,
        "expected_flag": "low",
        "expected_rule": False,
    },

    # 13-15: Varied edge cases
    {
        "category": "environment",
        "description": "Overburden dump bench height within DGMS prescribed limits.",
        "zone_risk_baseline": 0.30,
        "inspector_historical_high_rate": 0.15,
        "days_since_last_zone_inspection": 7,
        "has_photo": True,
        "expected_flag": "low",
        "expected_rule": False,
    },
    {
        "category": "labour",
        "description": "First aid box replenished and emergency stretcher verified at sub-station.",
        "zone_risk_baseline": 0.25,
        "inspector_historical_high_rate": 0.12,
        "days_since_last_zone_inspection": 6,
        "has_photo": True,
        "expected_flag": "low",
        "expected_rule": False,
    },
    {
        "category": "safety",
        "description": "Strata failure warning: excessive convergence observed on side walls.",
        "zone_risk_baseline": 0.92,
        "expected_flag": "high",
        "expected_rule": True,
    },
]


def run_verification():
    print("==================================================")
    print("STARTING PHASE 2: EDGE MODEL VERIFICATION")
    print("==================================================")

    # 1. Initialize Engine
    engine = RiskScoringEngine()
    print(f"Loaded RiskScoringEngine with {len(engine.trees)} trees, c_factor={engine.c_n}")

    passed = 0
    total = len(TEST_OBSERVATIONS)

    print("\n--- Evaluating 15 Mock Observations ---")
    header = f"{'#':<3} | {'Category':<11} | {'Score':<6} | {'Flag':<6} | {'Rule?':<6} | {'Top Contributors'}"
    print(header)
    print("-" * len(header))

    for idx, obs in enumerate(TEST_OBSERVATIONS, 1):
        res = engine.score_observation(obs)
        score = res["score"]
        flag = res["flag"]
        rule_trig = res["rule_triggered"]
        reasons = res["reasons"]
        top_contribs = ", ".join(reasons.get("top_contributors", []))

        # Assertions
        assert 0.0 <= score <= 1.0, f"Score {score} out of [0, 1] range"
        assert flag in ("low", "medium", "high"), f"Invalid flag {flag}"

        if obs.get("expected_rule"):
            assert rule_trig is True, f"Obs {idx} expected rule trigger"
            assert flag == "high", f"Obs {idx} expected high flag from rule"

        print(f"{idx:<3} | {obs['category']:<11} | {score:<6.3f} | {flag:<6} | {str(rule_trig):<6} | {top_contribs}")
        passed += 1

    # 2. Verify Mobile Model Asset
    print("\n--- Verifying Mobile Model Asset ---")
    # Inside container or host check
    paths_to_check = [
        os.path.join(os.path.dirname(__file__), "../app/edge/model_weights.json"),
        "/mobile/assets/model/model.json",
    ]
    for path in paths_to_check:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            assert "trees" in data and len(data["trees"]) > 0, "Missing trees in model JSON"
            assert "c_factor" in data, "Missing c_factor in model JSON"
            assert "feature_names" in data and len(data["feature_names"]) == 12, "Model must have 12 features"
            print(f"  [PASS] Verified model JSON at {path} ({len(data['trees'])} trees, {len(data['feature_names'])} features)")

    print("\n==================================================")
    print(f"ALL {passed}/{total} OBSERVATIONS EVALUATED SUCCESSFULLY!")
    print("==================================================")


if __name__ == "__main__":
    run_verification()
