"""
backend/app/i18n/constants.py
Multilingual configuration and state-to-language mappings for MINEGOV-AI.

Languages supported (8 total):
- en: English (major / primary default system language)
- sa: Sanskrit (classical / official 8th Schedule language; formal statutory register)
- hi: Hindi (Jharkhand, Madhya Pradesh, Chhattisgarh)
- bn: Bengali (West Bengal - Raniganj, ECL)
- or: Odia (Odisha - Talcher, IB Valley, MCL)
- te: Telugu (Telangana - Singareni, SCCL)
- mr: Marathi (Maharashtra - Chandrapur, Nagpur, WCL)
- sat: Santali / Ol Chiki (Jharkhand / WB / Odisha tribal mining belt)
"""
from typing import Any, Dict, List, Optional

SUPPORTED_LANGUAGES: List[str] = ["en", "sa", "hi", "bn", "or", "te", "mr", "sat"]

STATE_LANGUAGE_MAP: Dict[str, str] = {
    "Jharkhand": "hi",
    "Madhya Pradesh": "hi",
    "Chhattisgarh": "hi",
    "West Bengal": "bn",
    "Odisha": "or",
    "Telangana": "te",
    "Maharashtra": "mr",
}

DEFAULT_LANGUAGE: str = "en"
FORMAL_REGISTER_LANGUAGE: str = "sa"

LANGUAGE_METADATA: Dict[str, Dict[str, Any]] = {
    "en": {
        "name": "English",
        "native_name": "English",
        "script": "Latin",
        "role": "major_default",
    },
    "sa": {
        "name": "Sanskrit",
        "native_name": "संस्कृतम्",
        "script": "Devanagari",
        "role": "major_formal_register",
    },
    "hi": {
        "name": "Hindi",
        "native_name": "हिन्दी",
        "script": "Devanagari",
        "role": "regional",
        "states": ["Jharkhand", "Madhya Pradesh", "Chhattisgarh"],
    },
    "bn": {
        "name": "Bengali",
        "native_name": "বাংলা",
        "script": "Bengali",
        "role": "regional",
        "states": ["West Bengal"],
    },
    "or": {
        "name": "Odia",
        "native_name": "ଓଡ଼ିଆ",
        "script": "Odia",
        "role": "regional",
        "states": ["Odisha"],
    },
    "te": {
        "name": "Telugu",
        "native_name": "తెలుగు",
        "script": "Telugu",
        "role": "regional",
        "states": ["Telangana"],
    },
    "mr": {
        "name": "Marathi",
        "native_name": "मराठी",
        "script": "Devanagari",
        "role": "regional",
        "states": ["Maharashtra"],
    },
    "sat": {
        "name": "Santali",
        "native_name": "ᱥᱟᱱᱛᱟᱲᱤ",
        "script": "Ol Chiki",
        "role": "regional",
        "states": ["Jharkhand", "West Bengal", "Odisha"],
    },
}

STATE_ALIAS_MAP: Dict[str, str] = {
    "jharkhand": "Jharkhand",
    "madhya pradesh": "Madhya Pradesh",
    "mp": "Madhya Pradesh",
    "chhattisgarh": "Chhattisgarh",
    "cg": "Chhattisgarh",
    "west bengal": "West Bengal",
    "wb": "West Bengal",
    "bengal": "West Bengal",
    "odisha": "Odisha",
    "orissa": "Odisha",
    "telangana": "Telangana",
    "ts": "Telangana",
    "maharashtra": "Maharashtra",
    "mh": "Maharashtra",
}


def infer_state_from_location(location_name: Optional[str]) -> Optional[str]:
    """
    Infers coal state from location string if present.
    """
    if not location_name:
        return None
    loc_lower = location_name.lower()
    for alias, canonical_state in STATE_ALIAS_MAP.items():
        if alias in loc_lower:
            return canonical_state
    return None


def resolve_user_language(preferred_language: Optional[str], mine_site_state: Optional[str]) -> str:
    """
    Language resolution order (per MULTILINGUAL_SUPPORT_PLAN.md Section 3):
    1. If User.preferred_language is explicitly set and supported -> use it
       (this is also how a user opts into Sanskrit 'sa').
    2. Else derive from User.mine_site.state via STATE_LANGUAGE_MAP.
    3. Else fall back to 'en' (DEFAULT_LANGUAGE).
    """
    if preferred_language:
        clean_pref = preferred_language.strip().lower()
        if clean_pref in SUPPORTED_LANGUAGES:
            return clean_pref

    if mine_site_state:
        clean_state = mine_site_state.strip().lower()
        canonical = STATE_ALIAS_MAP.get(clean_state, mine_site_state.strip())
        if canonical in STATE_LANGUAGE_MAP:
            return STATE_LANGUAGE_MAP[canonical]

    return DEFAULT_LANGUAGE


UI_TO_TESSERACT_LANG_MAP: Dict[str, str] = {
    "en": "eng",
    "sa": "san",
    "hi": "hin",
    "bn": "ben",
    "or": "ori",
    "te": "tel",
    "mr": "mar",
    "sat": "sat",
}

TESSERACT_SUPPORTED_LANGS: List[str] = [
    "eng", "san", "hin", "ben", "ori", "tel", "mar", "sat"
]


def map_lang_to_tesseract(lang: Optional[str], include_english: bool = True) -> str:
    """
    Maps UI language code or Tesseract code into a valid Tesseract lang spec.
    If include_english is True and the primary language is not English,
    returns 'eng+<lang>' to ensure numerals and alphanumeric headers parse accurately.
    """
    if not lang or lang.strip().lower() in ("auto", "none"):
        return "eng"

    parts = [p.strip().lower() for p in lang.split("+") if p.strip()]
    resolved: List[str] = []

    for part in parts:
        if part in UI_TO_TESSERACT_LANG_MAP:
            resolved.append(UI_TO_TESSERACT_LANG_MAP[part])
        elif part in TESSERACT_SUPPORTED_LANGS:
            resolved.append(part)
        else:
            resolved.append("eng")

    # Deduplicate while preserving order
    seen = set()
    deduped = [x for x in resolved if not (x in seen or seen.add(x))]

    if include_english and "eng" not in deduped:
        deduped = ["eng"] + deduped

    return "+".join(deduped) if deduped else "eng"

