from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

FEATURE_NAMES: List[str] = [
    "category_safety",
    "category_environment",
    "category_labour",
    "hour_of_day_norm",
    "day_of_week_norm",
    "zone_risk_baseline",
    "keyword_safety_flag",
    "keyword_env_flag",
    "keyword_labour_flag",
    "inspector_historical_high_rate",
    "days_since_last_inspection_norm",
    "has_photo",
]

SAFETY_KEYWORDS: List[str] = [
    "crack", "spall", "fall", "leak", "methane", "gas", "fire", "smoke",
    "blasting", "explosive", "failure", "collapse", "inundation", "flyrock",
    "subsidence", "hazard", "unsupported", "defective", "damage", "strata",
]

ENV_KEYWORDS: List[str] = [
    "spill", "turbidity", "discharge", "exceedance", "slurry", "overflow",
    "acid", "leachate", "contamination", "seepage", "dust plume", "effluent",
]

LABOUR_KEYWORDS: List[str] = [
    "missing", "violation", "unauthorized", "unregistered", "fatigue",
    "overtime", "non-compliance", "without ppe", "penalty", "expired",
]


def extract_features(obs: Dict[str, Any]) -> Tuple[List[float], Dict[str, float]]:
    """
    Extracts the 12-feature vector from an observation dictionary.
    Returns: (feature_vector_list, feature_dict)
    """
    cat = (obs.get("category") or "safety").lower()
    desc = (obs.get("description") or "").lower()

    # 1-3. Category one-hot
    cat_safety = 1.0 if cat == "safety" else 0.0
    cat_env = 1.0 if cat == "environment" else 0.0
    cat_labour = 1.0 if cat == "labour" else 0.0

    # 4-5. Time features
    created_at = obs.get("created_at")
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
    dow_norm = round(dt.weekday() / 6.0, 4)

    # 6. Zone risk baseline (0.0 to 1.0)
    zone_baseline = float(obs.get("zone_risk_baseline", 0.4))
    zone_baseline = max(0.0, min(1.0, zone_baseline))

    # 7-9. Keyword flags
    kw_safety = 1.0 if any(kw in desc for kw in SAFETY_KEYWORDS) else 0.0
    kw_env = 1.0 if any(kw in desc for kw in ENV_KEYWORDS) else 0.0
    kw_labour = 1.0 if any(kw in desc for kw in LABOUR_KEYWORDS) else 0.0

    # 10. Inspector historical high rate (default 0.25)
    insp_rate = float(obs.get("inspector_historical_high_rate", 0.25))
    insp_rate = max(0.0, min(1.0, insp_rate))

    # 11. Days since last zone inspection (normalized to max 30 days)
    days_since = float(obs.get("days_since_last_zone_inspection", 7))
    days_norm = round(min(days_since, 30.0) / 30.0, 4)

    # 12. Photo attached
    has_photo = 1.0 if bool(obs.get("has_photo") or obs.get("photo_url")) else 0.0

    feature_dict = {
        "category_safety": cat_safety,
        "category_environment": cat_env,
        "category_labour": cat_labour,
        "hour_of_day_norm": hour_norm,
        "day_of_week_norm": dow_norm,
        "zone_risk_baseline": zone_baseline,
        "keyword_safety_flag": kw_safety,
        "keyword_env_flag": kw_env,
        "keyword_labour_flag": kw_labour,
        "inspector_historical_high_rate": insp_rate,
        "days_since_last_inspection_norm": days_norm,
        "has_photo": has_photo,
    }

    vec = [feature_dict[name] for name in FEATURE_NAMES]
    return vec, feature_dict
