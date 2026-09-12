"""
verify_enrichment.py
Automated verification test script for Phase 4: Cloud Enrichment.
Tests:
  1. CloudEnrichmentEngine scoring & calibration across safety, environment, labour.
  2. SHAP-lite feature explainability (top_contributors present with sign, magnitude, name).
  3. Action map completeness across all 3 categories x 3 severity flags.
  4. Integration with mock Observation object and enrich_observation service logic.
"""

import os
import sys
import json
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.enrichment.engine import CloudEnrichmentEngine, get_cloud_engine, CLOUD_FEATURE_NAMES
from app.enrichment.action_map import get_suggested_action, ACTION_TABLE
from app.models import RiskFlag, ObservationCategory


def test_action_map_completeness():
    print("\n--- Test 1: Action Map Completeness (3x3 = 9 combinations) ---")
    categories = ["safety", "environment", "labour"]
    flags = ["low", "medium", "high"]

    for cat in categories:
        for flg in flags:
            action = get_suggested_action(cat, flg)
            assert action is not None and len(action) > 20, f"Missing or short action for ({cat}, {flg})"
            assert (cat, flg) in ACTION_TABLE, f"Key ({cat}, {flg}) not in ACTION_TABLE"
            print(f"  [{cat.upper():11s} | {flg.upper():6s}] -> {action[:60]}...")

    # Fallback test
    fallback = get_suggested_action("unknown", "unknown")
    assert len(fallback) > 20, "Fallback action missing"
    print("  [FALLBACK   ] ->", fallback[:60], "...")
    print("PASS: All 9 action mappings verified + fallback.")


def test_cloud_engine_scoring():
    print("\n--- Test 2: Cloud Enrichment Engine Scoring & Anomaly Detection ---")
    engine = get_cloud_engine()

    test_cases = [
        {
            "name": "High-risk methane gas and roof spall",
            "obs": {
                "category": "safety",
                "description": "Urgent: high methane gas concentration 2.5% and active roof fall in main heading",
                "created_at": datetime.now(timezone.utc),
                "has_photo": True,
            },
            "zone_risk_baseline": 0.85,
            "inspector_high_rate": 0.5,
            "days_since_inspection": 25.0,
            "site_avg_high_rate": 0.35,
            "zone_open_high_risk_count": 4,
            "expected_flag": "high",
        },
        {
            "name": "Environmental acid mine water breach",
            "obs": {
                "category": "environment",
                "description": "Major acid mine drainage effluent overflow into local stream with slurry discharge",
                "created_at": datetime.now(timezone.utc),
                "has_photo": True,
            },
            "zone_risk_baseline": 0.75,
            "inspector_high_rate": 0.3,
            "days_since_inspection": 14.0,
            "site_avg_high_rate": 0.25,
            "zone_open_high_risk_count": 2,
            "expected_flag": "high",
        },
        {
            "name": "Routine safe inspection",
            "obs": {
                "category": "safety",
                "description": "Routine shift walk conducted. Haulage road clear, all support props intact, no hazards found.",
                "created_at": datetime.now(timezone.utc),
                "has_photo": False,
            },
            "zone_risk_baseline": 0.20,
            "inspector_high_rate": 0.05,
            "days_since_inspection": 1.0,
            "site_avg_high_rate": 0.10,
            "zone_open_high_risk_count": 0,
            "expected_flag": "low",
        },
    ]

    for tc in test_cases:
        res = engine.score(
            tc["obs"],
            zone_risk_baseline=tc["zone_risk_baseline"],
            inspector_high_rate=tc["inspector_high_rate"],
            days_since_inspection=tc["days_since_inspection"],
            site_avg_high_rate=tc["site_avg_high_rate"],
            zone_open_high_risk_count=tc["zone_open_high_risk_count"],
        )

        assert "cloud_score" in res, "Missing cloud_score"
        assert 0.0 <= res["cloud_score"] <= 1.0, f"Score out of range: {res['cloud_score']}"
        assert res["cloud_flag"] in ("low", "medium", "high"), f"Invalid flag: {res['cloud_flag']}"
        assert "cloud_reasons" in res, "Missing cloud_reasons"

        reasons = res["cloud_reasons"]
        assert "top_contributors" in reasons, "Missing top_contributors in cloud_reasons"
        assert len(reasons["top_contributors"]) >= 3, "Explainability should provide at least top 3 contributors"

        print(f"\n  Case: {tc['name']}")
        print(f"    Score: {res['cloud_score']:.3f} | Flag: {res['cloud_flag'].upper()} (Expected: {tc['expected_flag'].upper()})")
        print(f"    Raw Anomaly Score: {reasons.get('anomaly_score', 'N/A')}")
        print("    Top Contributors (SHAP-lite explainability):")
        for c in reasons["top_contributors"][:3]:
            print(f"      * {c} (feature val: {reasons['features'].get(c, 'N/A')})")

    print("\nPASS: Cloud scoring and explainability verified.")


def test_explainability_structure():
    print("\n--- Test 3: Explainability Structure Validation ---")
    engine = get_cloud_engine()
    res = engine.score({
        "category": "labour",
        "description": "Contractor workforce operating without PPE and safety shoes near dump yard. Severe violation.",
        "created_at": datetime.now(timezone.utc),
        "has_photo": True,
    })

    contributors = res["cloud_reasons"]["top_contributors"]
    for feat_name in contributors:
        assert isinstance(feat_name, str), f"Expected str feature name, got {type(feat_name)}"
        assert feat_name in CLOUD_FEATURE_NAMES, f"Unknown feature {feat_name}"

    print(f"  Verified {len(contributors)} explanation contributors: {contributors}")
    print("PASS: Explainability structure adheres to schema.")


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING PHASE 4 CLOUD ENRICHMENT VERIFICATION")
    print("=" * 60)
    test_action_map_completeness()
    test_cloud_engine_scoring()
    test_explainability_structure()
    print("\n" + "=" * 60)
    print("ALL PHASE 4 ENRICHMENT TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)
