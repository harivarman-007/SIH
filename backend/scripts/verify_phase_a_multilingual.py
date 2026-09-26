"""
verify_phase_a_multilingual.py
Comprehensive automated test suite for Phase A of MULTILINGUAL_SUPPORT_PLAN.md:
- Database schema changes (User.preferred_language, MineSite.state)
- Migration 014 metadata & syntax
- Language resolution logic across all 8 supported languages
- State-to-language mappings and fallbacks
- Pydantic schema validation (LanguageUpdateRequest, UserOut, MineSite schemas)
- API endpoint route registrations in FastAPI app
"""
import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


def test_constants_and_resolution():
    print("\n--- 1. Testing Constants and Resolution Logic ---")
    from app.i18n.constants import (
        DEFAULT_LANGUAGE,
        FORMAL_REGISTER_LANGUAGE,
        STATE_LANGUAGE_MAP,
        SUPPORTED_LANGUAGES,
        LANGUAGE_METADATA,
        resolve_user_language,
        infer_state_from_location,
    )

    # Check 8 languages
    expected_langs = ["en", "sa", "hi", "bn", "or", "te", "mr", "sat"]
    assert SUPPORTED_LANGUAGES == expected_langs, f"Expected {expected_langs}, got {SUPPORTED_LANGUAGES}"
    assert DEFAULT_LANGUAGE == "en"
    assert FORMAL_REGISTER_LANGUAGE == "sa"
    assert len(LANGUAGE_METADATA) == 8
    print("[PASS] Supported languages and metadata verified (8 languages: en, sa, hi, bn, or, te, mr, sat)")

    # Test state-derived language resolution
    state_expectations = {
        "Jharkhand": "hi",
        "Madhya Pradesh": "hi",
        "Chhattisgarh": "hi",
        "West Bengal": "bn",
        "Odisha": "or",
        "Telangana": "te",
        "Maharashtra": "mr",
        "Unknown State": "en",
        None: "en",
        "": "en",
    }
    for state, expected_lang in state_expectations.items():
        derived = resolve_user_language(preferred_language=None, mine_site_state=state)
        assert derived == expected_lang, f"For state {state}: expected {expected_lang}, got {derived}"
    print("[PASS] State-to-language derivation matches specification")

    # Test explicit user preference overrides state
    for lang in SUPPORTED_LANGUAGES:
        # Even if mine site is in West Bengal, user preference takes priority
        resolved = resolve_user_language(preferred_language=lang, mine_site_state="West Bengal")
        assert resolved == lang, f"Expected user preference {lang}, got {resolved}"
    print("[PASS] User preferred_language override takes precedence over mine site state")

    # Test formal register (Sanskrit) opt-in
    sanskrit_resolved = resolve_user_language(preferred_language="sa", mine_site_state="Jharkhand")
    assert sanskrit_resolved == "sa"
    print("[PASS] Sanskrit (sa) correctly opted-in via preferred_language")

    # Test location string state inference
    assert infer_state_from_location("Jharia Coalfield, Dhanbad, Jharkhand") == "Jharkhand"
    assert infer_state_from_location("Raniganj Basin, West Bengal") == "West Bengal"
    assert infer_state_from_location("Korba, CG") == "Chhattisgarh"
    assert infer_state_from_location("Talcher, Odisha") == "Odisha"
    print("[PASS] Location string state inference works for abbreviations and full state names")

    # Test OCR Tesseract language mapping
    from app.i18n.constants import map_lang_to_tesseract
    assert map_lang_to_tesseract("en") == "eng"
    assert map_lang_to_tesseract("hi") == "eng+hin"
    assert map_lang_to_tesseract("bn") == "eng+ben"
    assert map_lang_to_tesseract("or") == "eng+ori"
    assert map_lang_to_tesseract("te") == "eng+tel"
    assert map_lang_to_tesseract("mr") == "eng+mar"
    assert map_lang_to_tesseract("sat") == "eng+sat"
    assert map_lang_to_tesseract("sa") == "eng+san"
    assert map_lang_to_tesseract("hin", include_english=False) == "hin"
    print("[PASS] OCR Tesseract language code resolution verified for all 8 languages")



def test_models_and_migration():
    print("\n--- 2. Testing Models and Alembic Migration ---")
    import importlib.util
    from app.models import User, MineSite

    mig_path = os.path.join(backend_dir, "alembic", "versions", "014_add_language_support.py")
    spec = importlib.util.spec_from_file_location("migration_014", mig_path)
    migration_014 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration_014)

    # Check SQLAlchemy model columns
    assert hasattr(User, "preferred_language"), "User model missing preferred_language column"
    assert hasattr(MineSite, "state"), "MineSite model missing state column"
    print("[PASS] User.preferred_language and MineSite.state columns present in models")

    # Check migration metadata
    assert migration_014.revision == "014_add_language_support"
    assert migration_014.down_revision == "013_add_mine_site_active"
    assert hasattr(migration_014, "upgrade"), "Migration missing upgrade()"
    assert hasattr(migration_014, "downgrade"), "Migration missing downgrade()"
    print("[PASS] Migration 014 has valid revision and down_revision chain")


def test_schemas():
    print("\n--- 3. Testing Pydantic Schemas ---")
    from pydantic import ValidationError
    from app.schemas.auth import LanguageUpdateRequest, UserOut
    from app.schemas.admin import MineSiteCreate, MineSiteUpdate, MineSiteOut
    from app.models import UserRole
    import uuid

    # Valid language updates
    for lang in ["en", "sa", "hi", "bn", "or", "te", "mr", "sat"]:
        req = LanguageUpdateRequest(language=lang)
        assert req.language == lang

    # Null language update (reset to site default)
    req_null = LanguageUpdateRequest(language=None)
    assert req_null.language is None

    # Invalid language should raise ValidationError
    try:
        LanguageUpdateRequest(language="klingon")
        assert False, "Should have raised ValidationError for invalid language"
    except (ValidationError, ValueError):
        pass
    print("[PASS] LanguageUpdateRequest validation verified (accepts 8 valid languages or null, rejects invalid)")

    # UserOut schema checks
    user_out = UserOut(
        id=uuid.uuid4(),
        email="test@mine.in",
        full_name="Test User",
        role=UserRole.inspector,
        mine_site_id=uuid.uuid4(),
        is_active=True,
        permissions=["OBSERVATION_CREATE"],
        scope={"mine_ids": []},
        preferred_language="bn",
        resolved_language="bn",
    )
    assert user_out.preferred_language == "bn"
    assert user_out.resolved_language == "bn"
    print("[PASS] UserOut includes preferred_language and resolved_language")

    # MineSite schemas checks
    site_create = MineSiteCreate(name="Talcher Pit 1", location_name="Angul, Odisha", state="Odisha")
    assert site_create.state == "Odisha"

    site_update = MineSiteUpdate(state="Telangana")
    assert site_update.state == "Telangana"

    from datetime import datetime, timezone

    site_out = MineSiteOut(
        id=uuid.uuid4(),
        name="Talcher Pit 1",
        location_name="Angul, Odisha",
        state="Odisha",
        created_at=datetime.now(timezone.utc),
    )
    assert site_out.state == "Odisha"
    print("[PASS] MineSiteCreate, MineSiteUpdate, and MineSiteOut schemas include state")


def test_api_routes():
    print("\n--- 4. Testing FastAPI Route Declarations ---")
    from app.main import app

    routes = [route.path for route in app.routes]
    expected_endpoints = [
        "/auth/me",
        "/auth/me/language",
        "/users/me",
        "/users/me/language",
        "/mine-sites",
        "/mine-sites/{site_id}",
        "/admin/mine-sites",
        "/admin/mine-sites/{site_id}",
    ]
    for endpoint in expected_endpoints:
        assert endpoint in routes, f"Endpoint {endpoint} not found in app routes: {routes}"
        print(f"  [FOUND] {endpoint}")
    print("[PASS] All required multilingual Phase A endpoints registered successfully")


if __name__ == "__main__":
    try:
        test_constants_and_resolution()
        test_models_and_migration()
        test_schemas()
        test_api_routes()
        print("\n=======================================================")
        print("ALL PHASE A MULTILINGUAL SUPPORT TESTS PASSED!")
        print("=======================================================\n")
    except Exception as e:
        print(f"\n[FAIL] Test failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
