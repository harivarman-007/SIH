import re
from typing import Optional, Tuple

CRITICAL_HAZARD_RULES = [
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


def check_critical_rules(description: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Evaluates observation description against life-critical rule triggers.
    Returns: (is_critical, rule_id, rationale)
    """
    if not description:
        return False, None, None

    text = description.strip()
    for rule_id, pattern, rationale in CRITICAL_HAZARD_RULES:
        match = pattern.search(text)
        if match:
            trigger_term = match.group(0)
            detailed_rationale = f"{rationale} (trigger: '{trigger_term}')"
            return True, rule_id, detailed_rationale

    return False, None, None
