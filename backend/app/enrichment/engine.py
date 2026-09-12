"""
engine.py
Cloud-side enrichment engine.

Uses a deeper Isolation Forest (more estimators, cross-zone context) than the
edge model, plus a SHAP-lite explainability layer based on path-length delta
perturbation (same principle as the edge model but with richer features and
full zone/site context available from the database).

Produces:
  cloud_score   float [0.0 – 1.0]
  cloud_flag    low | medium | high
  cloud_reasons { top_contributors: [...], features: {...}, anomaly_score: float }
"""

import math
import os
import json
import numpy as np
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# ─────────────────────────────────────────────────────────────────────────────
# Training is done offline (once). The cloud engine trains on a richer
# synthetic dataset when first instantiated, then caches the model in memory.
# For a real deployment this would be persisted to disk / MLflow.
# ─────────────────────────────────────────────────────────────────────────────

_CLOUD_ENGINE_INSTANCE: Optional["CloudEnrichmentEngine"] = None


# ─── Feature set (15 features, superset of the 12 edge features) ─────────────

CLOUD_FEATURE_NAMES: List[str] = [
    "category_safety",                # 0
    "category_environment",           # 1
    "category_labour",                # 2
    "hour_of_day_norm",               # 3
    "day_of_week_norm",               # 4
    "zone_risk_baseline",             # 5
    "keyword_safety_flag",            # 6
    "keyword_env_flag",               # 7
    "keyword_labour_flag",            # 8
    "inspector_historical_high_rate", # 9
    "days_since_last_inspection_norm",# 10
    "has_photo",                      # 11
    "site_avg_high_rate",             # 12 – cross-zone: site-level baseline
    "zone_open_high_risk_count_norm", # 13 – unresolved high-risk in same zone
    "description_length_norm",        # 14 – longer descriptions → more detail
]

SAFETY_KW  = ["crack","spall","fall","leak","methane","gas","fire","smoke","blasting",
               "explosive","failure","collapse","inundation","flyrock","subsidence",
               "hazard","unsupported","defective","damage","strata"]
ENV_KW     = ["spill","turbidity","discharge","exceedance","slurry","overflow",
               "acid","leachate","contamination","seepage","dust plume","effluent"]
LABOUR_KW  = ["missing","violation","unauthorized","unregistered","fatigue",
               "overtime","non-compliance","without ppe","penalty","expired"]


def _euler_mascheroni() -> float:
    return 0.57721566490153286


def _c_factor(n: int) -> float:
    if n <= 1:
        return 1.0
    if n == 2:
        return 1.0
    return 2.0 * (math.log(n - 1) + _euler_mascheroni()) - 2.0 * (n - 1) / n


def extract_cloud_features(
    obs_dict: Dict[str, Any],
    *,
    zone_risk_baseline: float = 0.4,
    inspector_high_rate: float = 0.25,
    days_since_inspection: float = 7.0,
    site_avg_high_rate: float = 0.20,
    zone_open_high_risk_count: int = 0,
    zone_open_high_risk_max: int = 10,
) -> Tuple[List[float], Dict[str, float]]:
    """Extract 15-feature vector from observation + site/zone context."""

    cat = (obs_dict.get("category") or "safety").lower()
    desc = (obs_dict.get("description") or "").lower()

    cat_safety = 1.0 if cat == "safety" else 0.0
    cat_env    = 1.0 if cat == "environment" else 0.0
    cat_labour = 1.0 if cat == "labour" else 0.0

    created_at = obs_dict.get("created_at")
    if isinstance(created_at, str):
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            dt = datetime.now(timezone.utc)
    elif isinstance(created_at, datetime):
        dt = created_at
    else:
        dt = datetime.now(timezone.utc)

    hour_norm = round(dt.hour / 23.0, 4)
    dow_norm  = round(dt.weekday() / 6.0, 4)

    zone_base    = max(0.0, min(1.0, zone_risk_baseline))
    kw_safety    = 1.0 if any(kw in desc for kw in SAFETY_KW) else 0.0
    kw_env       = 1.0 if any(kw in desc for kw in ENV_KW)    else 0.0
    kw_labour    = 1.0 if any(kw in desc for kw in LABOUR_KW) else 0.0
    insp_rate    = max(0.0, min(1.0, inspector_high_rate))
    days_norm    = round(min(days_since_inspection, 30.0) / 30.0, 4)
    has_photo    = 1.0 if (obs_dict.get("has_photo") or obs_dict.get("photo_url")) else 0.0
    site_avg     = max(0.0, min(1.0, site_avg_high_rate))
    zone_open    = min(zone_open_high_risk_count, zone_open_high_risk_max) / zone_open_high_risk_max
    desc_len     = min(len(desc), 500) / 500.0

    feat_dict = {
        "category_safety":                cat_safety,
        "category_environment":           cat_env,
        "category_labour":                cat_labour,
        "hour_of_day_norm":               hour_norm,
        "day_of_week_norm":               dow_norm,
        "zone_risk_baseline":             round(zone_base, 4),
        "keyword_safety_flag":            kw_safety,
        "keyword_env_flag":               kw_env,
        "keyword_labour_flag":            kw_labour,
        "inspector_historical_high_rate": round(insp_rate, 4),
        "days_since_last_inspection_norm": days_norm,
        "has_photo":                      has_photo,
        "site_avg_high_rate":             round(site_avg, 4),
        "zone_open_high_risk_count_norm": round(zone_open, 4),
        "description_length_norm":        round(desc_len, 4),
    }
    vec = [feat_dict[name] for name in CLOUD_FEATURE_NAMES]
    return vec, feat_dict


# ─── Cloud IsolationForest wrapper ───────────────────────────────────────────

class CloudEnrichmentEngine:
    """
    Server-side enrichment engine.
    Trained on a richer synthetic dataset (3 000 samples) with 15 features.
    """

    def __init__(self) -> None:
        from sklearn.ensemble import IsolationForest  # type: ignore

        rng = np.random.RandomState(7)
        X = self._generate_training_data(3000, rng)

        self._clf = IsolationForest(
            n_estimators=100,
            max_samples=256,
            contamination=0.18,
            random_state=7,
        )
        self._clf.fit(X)
        self._n = 256  # max_samples used for c_factor
        self._c_n = _c_factor(self._n)

    # ── Training data ────────────────────────────────────────────────────────

    def _generate_training_data(self, n: int, rng: np.random.RandomState) -> np.ndarray:
        rows = []
        n_nominal   = int(n * 0.82)
        n_anomalous = n - n_nominal

        nominal_descs = [
            "Routine inspection completed. No issues observed.",
            "Water discharge within standard pH limits.",
            "PPE adherence verified across crew.",
            "Haul road watered for dust suppression.",
            "Conveyor rollers greased and aligned.",
        ]
        for _ in range(n_nominal):
            cat = rng.choice(["safety","environment","labour"], p=[0.5,0.3,0.2])
            obs = {
                "category": cat,
                "description": rng.choice(nominal_descs),
                "has_photo": rng.choice([0, 1], p=[0.4, 0.6]),
            }
            vec, _ = extract_cloud_features(
                obs,
                zone_risk_baseline=float(rng.uniform(0.15, 0.45)),
                inspector_high_rate=float(rng.uniform(0.05, 0.25)),
                days_since_inspection=float(rng.randint(1, 14)),
                site_avg_high_rate=float(rng.uniform(0.10, 0.30)),
                zone_open_high_risk_count=int(rng.randint(0, 3)),
            )
            rows.append(vec)

        anomaly_descs = [
            "Strata failure warning: roof convergence exceeding safe limits.",
            "Methane sensor triggered near return airway.",
            "Heavy slurry overflow from settling pond embankment.",
            "Coal dust concentration exceeding DGMS threshold.",
            "Uncertified operator found maneuvering excavator near bench edge.",
        ]
        for _ in range(n_anomalous):
            cat = rng.choice(["safety","environment","labour"], p=[0.65,0.25,0.1])
            obs = {
                "category": cat,
                "description": rng.choice(anomaly_descs),
                "has_photo": rng.choice([0, 1], p=[0.1, 0.9]),
            }
            vec, _ = extract_cloud_features(
                obs,
                zone_risk_baseline=float(rng.uniform(0.65, 0.95)),
                inspector_high_rate=float(rng.uniform(0.40, 0.80)),
                days_since_inspection=float(rng.randint(18, 30)),
                site_avg_high_rate=float(rng.uniform(0.35, 0.65)),
                zone_open_high_risk_count=int(rng.randint(4, 10)),
            )
            rows.append(vec)

        return np.array(rows, dtype=np.float32)

    # ── Scoring ──────────────────────────────────────────────────────────────

    def _raw_score(self, vec: List[float]) -> float:
        x = np.array([vec], dtype=np.float32)
        # decision_function: negative = anomaly.  Map to [0,1].
        df = float(self._clf.decision_function(x)[0])
        # decision_function ~ -score+offset; anomaly score = 2^(-E(h(x))/c(n))
        # sklearn wraps it but we reproduce the calibrated version:
        raw = float(self._clf.score_samples(x)[0])   # log-scale
        anomaly = 2.0 ** raw   # sklearn score_samples returns log2 version
        return min(1.0, max(0.0, anomaly))

    def _contributions(
        self, vec: List[float], baseline: float
    ) -> List[str]:
        """Path-length delta per feature — same principle as edge engine."""
        nominal = {
            "category_safety": 0.0, "category_environment": 0.0,
            "category_labour": 0.0, "hour_of_day_norm": 0.5,
            "day_of_week_norm": 0.5, "zone_risk_baseline": 0.3,
            "keyword_safety_flag": 0.0, "keyword_env_flag": 0.0,
            "keyword_labour_flag": 0.0, "inspector_historical_high_rate": 0.2,
            "days_since_last_inspection_norm": 0.2, "has_photo": 1.0,
            "site_avg_high_rate": 0.2, "zone_open_high_risk_count_norm": 0.0,
            "description_length_norm": 0.3,
        }
        deltas: Dict[str, float] = {}
        for idx, name in enumerate(CLOUD_FEATURE_NAMES):
            perturbed = list(vec)
            perturbed[idx] = nominal.get(name, 0.0)
            pert_score = self._raw_score(perturbed)
            deltas[name] = baseline - pert_score

        top = sorted(deltas.items(), key=lambda kv: -kv[1])
        positive = [k for k, v in top if v > 0]
        if len(positive) >= 3:
            return positive[:5]
        # Return top 3 highest delta features even if delta <= 0
        return [k for k, _ in top[:3]]

    def score(
        self,
        obs_dict: Dict[str, Any],
        *,
        zone_risk_baseline: float = 0.4,
        inspector_high_rate: float = 0.25,
        days_since_inspection: float = 7.0,
        site_avg_high_rate: float = 0.20,
        zone_open_high_risk_count: int = 0,
    ) -> Dict[str, Any]:
        """
        Returns:
          cloud_score:    float [0.0 – 1.0]
          cloud_flag:     'low' | 'medium' | 'high'
          cloud_reasons:  { top_contributors, features, anomaly_score }
        """
        vec, feat_dict = extract_cloud_features(
            obs_dict,
            zone_risk_baseline=zone_risk_baseline,
            inspector_high_rate=inspector_high_rate,
            days_since_inspection=days_since_inspection,
            site_avg_high_rate=site_avg_high_rate,
            zone_open_high_risk_count=zone_open_high_risk_count,
        )

        raw = self._raw_score(vec)

        # Calibrated IF component [0.42, 0.68] → [0.0, 1.0]
        if_component = min(1.0, max(0.0, (raw - 0.42) / (0.68 - 0.42)))

        # Domain factor (richer than edge because we have site + zone context)
        max_kw = max(
            feat_dict["keyword_safety_flag"],
            feat_dict["keyword_env_flag"],
            feat_dict["keyword_labour_flag"],
        )
        domain = (
            0.30 * feat_dict["zone_risk_baseline"]
            + 0.25 * max_kw
            + 0.15 * feat_dict["inspector_historical_high_rate"]
            + 0.10 * feat_dict["days_since_last_inspection_norm"]
            + 0.10 * feat_dict["site_avg_high_rate"]
            + 0.10 * feat_dict["zone_open_high_risk_count_norm"]
        )

        calibrated = 0.45 * if_component + 0.55 * domain
        score = round(min(1.0, max(0.05, calibrated)), 3)

        flag: str
        if score >= 0.60:
            flag = "high"
        elif score >= 0.35:
            flag = "medium"
        else:
            flag = "low"

        top = self._contributions(vec, raw)

        return {
            "cloud_score": score,
            "cloud_flag":  flag,
            "cloud_reasons": {
                "top_contributors": top,
                "anomaly_score":    round(raw, 3),
                "features":         feat_dict,
            },
        }


def get_cloud_engine() -> CloudEnrichmentEngine:
    global _CLOUD_ENGINE_INSTANCE
    if _CLOUD_ENGINE_INSTANCE is None:
        _CLOUD_ENGINE_INSTANCE = CloudEnrichmentEngine()
    return _CLOUD_ENGINE_INSTANCE
