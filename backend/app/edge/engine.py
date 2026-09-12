import json
import math
import os
from typing import Any, Dict, List, Optional, Tuple

from app.edge.features import FEATURE_NAMES, extract_features
from app.edge.rules import check_critical_rules


def c_factor(n: int) -> float:
    if n <= 1:
        return 1.0
    if n == 2:
        return 1.0
    euler_mascheroni = 0.57721566490153286
    return 2.0 * (math.log(n - 1.0) + euler_mascheroni) - (2.0 * (n - 1.0) / float(n))


class RiskScoringEngine:
    """
    On-Device Risk Scoring Engine.
    Evaluates observation risk using a two-layer approach:
      1. Immediate safety/environmental critical rule matching.
      2. Isolation Forest path length anomaly scoring + feature attribution.
    """

    def __init__(self, model_path: Optional[str] = None):
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), "model_weights.json")

        with open(model_path, "r", encoding="utf-8") as f:
            self.model_data = json.load(f)

        self.trees = self.model_data["trees"]
        self.c_n = self.model_data["c_factor"]
        self.feature_names = self.model_data["feature_names"]
        self.threshold_high = self.model_data["thresholds"]["high"]
        self.threshold_medium = self.model_data["thresholds"]["medium"]

    def _traverse_tree(self, tree: Dict[str, Any], x: List[float]) -> float:
        nodes = tree["nodes"]
        curr_id = 0
        depth = 0

        while True:
            node = nodes[curr_id]
            if node["is_leaf"]:
                samples = node["samples"]
                if samples > 1:
                    return float(depth) + c_factor(samples)
                return float(depth)

            f_idx = node["feature"]
            thresh = node["threshold"]

            if x[f_idx] <= thresh:
                curr_id = node["left"]
            else:
                curr_id = node["right"]

            depth += 1

    def _compute_anomaly_score(self, x: List[float]) -> float:
        """Computes Isolation Forest anomaly score between 0.0 and 1.0."""
        total_path = sum(self._traverse_tree(tree, x) for tree in self.trees)
        mean_path = total_path / float(len(self.trees))
        # Anomaly score formula: s(x, n) = 2^(-E(h(x)) / c(n))
        score = 2.0 ** (-(mean_path / self.c_n))
        return min(1.0, max(0.0, score))

    def _compute_feature_contributions(
        self, x: List[float], baseline_score: float, feat_dict: Dict[str, float]
    ) -> List[str]:
        """Identifies top contributing factors that increase anomaly score."""
        nominal_baselines = {
            "category_safety": 0.0,
            "category_environment": 0.0,
            "category_labour": 0.0,
            "hour_of_day_norm": 0.5,
            "day_of_week_norm": 0.5,
            "zone_risk_baseline": 0.3,
            "keyword_safety_flag": 0.0,
            "keyword_env_flag": 0.0,
            "keyword_labour_flag": 0.0,
            "inspector_historical_high_rate": 0.2,
            "days_since_last_inspection_norm": 0.2,
            "has_photo": 1.0,
        }

        deltas = {}
        for idx, name in enumerate(self.feature_names):
            x_perturbed = list(x)
            x_perturbed[idx] = nominal_baselines.get(name, 0.0)
            perturbed_score = self._compute_anomaly_score(x_perturbed)
            # Impact is how much this feature increased the score above nominal
            impact = baseline_score - perturbed_score
            deltas[name] = impact

        sorted_contributors = sorted(deltas.items(), key=lambda item: -item[1])
        # Return features with positive impact, top 3
        top = [name for name, val in sorted_contributors if val > 0][:3]
        if not top:
            # Fallback to highest relative features
            top = [k for k, v in feat_dict.items() if v > 0.5][:3]
        return top

    def score_observation(self, observation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main inference entry point.
        Takes observation dictionary and returns:
          - score: float in [0.0, 1.0]
          - flag: 'low' | 'medium' | 'high'
          - reasons: dict with top contributors and rule flags
          - rule_triggered: bool
        """
        desc = observation.get("description", "")

        # 1. Rule layer check
        is_critical, rule_id, rationale = check_critical_rules(desc)
        if is_critical:
            _, feat_dict = extract_features(observation)
            return {
                "score": 0.95,
                "flag": "high",
                "reasons": {
                    "rule_override": rule_id,
                    "rationale": rationale,
                    "top_contributors": ["critical_hazard_trigger", "zone_risk_baseline"],
                    "features": feat_dict,
                },
                "rule_triggered": True,
            }

        # 2. Anomaly scoring layer
        vec, feat_dict = extract_features(observation)
        raw_score = self._compute_anomaly_score(vec)

        # Calibrated Isolation Forest component (maps [0.42, 0.68] to [0.0, 1.0])
        if_component = min(1.0, max(0.0, (raw_score - 0.42) / (0.68 - 0.42)))

        # Domain risk factor
        domain_factor = (
            0.40 * feat_dict["zone_risk_baseline"]
            + 0.35 * max(
                feat_dict["keyword_safety_flag"],
                feat_dict["keyword_env_flag"],
                feat_dict["keyword_labour_flag"],
            )
            + 0.15 * feat_dict["inspector_historical_high_rate"]
            + 0.10 * feat_dict["days_since_last_inspection_norm"]
        )

        calibrated = 0.45 * if_component + 0.55 * domain_factor
        score = round(min(1.0, max(0.05, calibrated)), 3)

        if score >= 0.60:
            flag = "high"
        elif score >= 0.35:
            flag = "medium"
        else:
            flag = "low"

        top_contributors = self._compute_feature_contributions(vec, score, feat_dict)

        return {
            "score": score,
            "flag": flag,
            "reasons": {
                "top_contributors": top_contributors,
                "anomaly_score": round(raw_score, 3),
                "features": feat_dict,
            },
            "rule_triggered": False,
        }


# Global singleton instance for backend usage
_engine_instance: Optional[RiskScoringEngine] = None


def get_risk_scoring_engine() -> RiskScoringEngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = RiskScoringEngine()
    return _engine_instance
