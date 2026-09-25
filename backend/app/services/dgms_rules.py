"""
dgms_rules.py
Statutory DGMS Critical Hazard Rules Engine (Backend).
Enforces hard safety floor (0.95 HIGH) for life-safety critical patterns:
- Roof / Strata failure
- Fire / Explosion
- Toxic / Methane gas leak
- Inundation / Flooding
- Fatal or haulage failure

Regardless of whether scoring was triggered via AI auto or Manual inspector entry,
DGMS critical keyword match forces risk_score_source="dgms_override", edge_score=0.95, edge_flag="high".
"""
import re
from typing import Dict, Any, Tuple, Optional

CRITICAL_RULES = [
    (
        "ROOF_STRATA_COLLAPSE",
        re.compile(r"\b(roof\s*fall|strata\s*failure|bench\s*collapse|side\s*fall|slope\s*failure|landslide|cave\s*in)\b", re.IGNORECASE),
        "Imminent strata failure or collapse detected in working gallery/bench",
    ),
    (
        "EXPLOSION_OR_FIRE",
        re.compile(r"\b(explosion|fire|spontaneous\s*combustion|smoke\s*detected|blast\s*misfire|detonator\s*damage)\b", re.IGNORECASE),
        "Fire or explosive hazard detected requiring emergency evacuation protocol",
    ),
    (
        "HAZARDOUS_GAS_LEAK",
        re.compile(r"\b(methane|ch4|carbon\s*monoxide|co\s*level|toxic\s*gas|noxious\s*gas|oxygen\s*depletion|gas\s*leak)\b", re.IGNORECASE),
        "Dangerous accumulation or leak of hazardous/toxic mine gas",
    ),
    (
        "WATER_INUNDATION",
        re.compile(r"\b(inundation|flooding|water\s*breakthrough|sump\s*overflow|drowning\s*hazard)\b", re.IGNORECASE),
        "Underground water breakthrough or inundation hazard",
    ),
    (
        "FATAL_OR_HAUL_FAILURE",
        re.compile(r"\b(fatal|critical\s*injury|conveyor\s*snap|haul\s*truck\s*brake|runaway\s*vehicle|electrocution)\b", re.IGNORECASE),
        "Critical mechanical or high-voltage hazard with life-safety impact",
    ),
]


def check_critical_rules(description: str) -> Dict[str, Any]:
    text = description or ""
    for rule_id, pattern, rationale in CRITICAL_RULES:
        match = pattern.search(text)
        if match:
            return {
                "matched": True,
                "rule_id": rule_id,
                "rationale": rationale,
                "match_text": match.group(0),
            }
    return {"matched": False}


def apply_dgms_safety_floor(
    description: str,
    requested_source: Optional[str],
    requested_score: Optional[float],
    requested_flag: Optional[Any],
    requested_reasons: Optional[Dict[str, Any]],
    manual_reason: Optional[str] = None,
) -> Tuple[str, float, str, Dict[str, Any], Optional[str]]:
    """
    Returns (final_source, final_score, final_flag_str, final_reasons, final_manual_reason)
    Enforces that if a critical pattern matches, DGMS override wins over any manual or AI score.
    """
    critical = check_critical_rules(description)
    reasons = dict(requested_reasons or {})

    if critical.get("matched"):
        reasons["rule_override"] = f"CRITICAL HAZARD RULE: {critical['rationale']} [MATCH: '{critical.get('match_text', '')}']"
        reasons["rule_triggered"] = True
        return (
            "dgms_override",
            0.95,
            "high",
            reasons,
            manual_reason,
        )

    # If no critical rule matched, respect manual vs ai_auto
    source = requested_source if requested_source in ("manual", "ai_auto", "dgms_override") else "ai_auto"
    score = requested_score if requested_score is not None else 0.35
    flag_str = requested_flag.value if hasattr(requested_flag, "value") else str(requested_flag or "low")

    return (
        source,
        score,
        flag_str,
        reasons,
        manual_reason if source == "manual" else None,
    )
