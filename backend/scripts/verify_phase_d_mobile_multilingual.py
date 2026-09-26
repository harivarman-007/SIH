"""
verify_phase_d_mobile_multilingual.py
Comprehensive verification script for Phase D Mobile Multilingual Support (8 languages):
- English (en - default)
- Sanskrit (sa - formal statutory register)
- Hindi (hi - Jharkhand, MP, CG)
- Bengali (bn - West Bengal)
- Odia (or - Odisha)
- Telugu (te - Telangana)
- Marathi (mr - Maharashtra)
- Santali (sat - Ol Chiki script, tribal belt)
"""

import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MOBILE_DIR = os.path.join(BASE_DIR, "mobile")
LOCALES_DIR = os.path.join(MOBILE_DIR, "src", "i18n", "locales")

EXPECTED_LANGUAGES = ["en", "sa", "hi", "bn", "or", "te", "mr", "sat"]

EXPECTED_SECTIONS = [
    "brand",
    "nav",
    "dashboard",
    "inspections",
    "new_obs",
    "actions",
    "queue",
    "settings",
    "auth",
    "common",
]

def check_locales():
    print("\n--- 1. Testing Mobile Locale JSON Files ---")
    en_path = os.path.join(LOCALES_DIR, "en.json")
    if not os.path.exists(en_path):
        print(f"[FAIL] Missing en.json at {en_path}")
        return False

    with open(en_path, "r", encoding="utf-8") as f:
        en_data = json.load(f)

    # Count keys in en
    total_en_keys = sum(len(v) if isinstance(v, dict) else 1 for v in en_data.values())
    print(f"[PASS] Source-of-truth en.json verified with {len(en_data)} sections and {total_en_keys} keys.")

    all_passed = True
    for lang in EXPECTED_LANGUAGES:
        lang_path = os.path.join(LOCALES_DIR, f"{lang}.json")
        if not os.path.exists(lang_path):
            print(f"[FAIL] Missing {lang}.json")
            all_passed = False
            continue

        try:
            with open(lang_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            missing_sections = [sec for sec in EXPECTED_SECTIONS if sec not in data]
            if missing_sections:
                print(f"[FAIL] {lang}.json missing sections: {missing_sections}")
                all_passed = False
                continue

            # Verify no empty strings
            empty_keys = []
            for sec, content in data.items():
                if isinstance(content, dict):
                    for k, v in content.items():
                        if not str(v).strip():
                            empty_keys.append(f"{sec}.{k}")

            if empty_keys:
                print(f"[FAIL] {lang}.json contains empty keys: {empty_keys}")
                all_passed = False
            else:
                key_count = sum(len(v) if isinstance(v, dict) else 1 for v in data.values())
                print(f"[PASS] {lang}.json validated: all {len(data)} sections present ({key_count} keys, no empty strings).")
        except Exception as e:
            print(f"[FAIL] Error reading {lang}.json: {e}")
            all_passed = False

    return all_passed

def check_i18n_module():
    print("\n--- 2. Testing Mobile i18n Module & Types ---")
    index_path = os.path.join(MOBILE_DIR, "src", "i18n", "index.tsx")
    types_path = os.path.join(MOBILE_DIR, "src", "i18n", "types.ts")

    if not os.path.exists(index_path) or not os.path.exists(types_path):
        print(f"[FAIL] Missing index.tsx or types.ts in mobile/src/i18n")
        return False

    with open(types_path, "r", encoding="utf-8") as f:
        types_content = f.read()

    for lang in EXPECTED_LANGUAGES:
        if f'"{lang}"' not in types_content and f"'{lang}'" not in types_content:
            print(f"[FAIL] types.ts missing language code: {lang}")
            return False

    if "STATE_LANGUAGE_MAP" not in types_content:
        print("[FAIL] types.ts missing STATE_LANGUAGE_MAP")
        return False

    with open(index_path, "r", encoding="utf-8") as f:
        index_content = f.read()

    expected_symbols = [
        "I18nProvider",
        "useTranslation",
        "deriveLanguageFromState",
        "STORAGE_LANG_KEY",
        "translate",
        "SUPPORTED_LANGUAGES",
    ]
    for sym in expected_symbols:
        if sym not in index_content:
            print(f"[FAIL] index.tsx missing symbol: {sym}")
            return False

    print("[PASS] Mobile i18n module and types exports verified successfully.")
    return True

def check_screens_integration():
    print("\n--- 3. Testing Screen Integrations & SettingsScreen ---")
    settings_screen_path = os.path.join(MOBILE_DIR, "src", "screens", "SettingsScreen.tsx")
    nav_path = os.path.join(MOBILE_DIR, "src", "navigation", "AppNavigator.tsx")
    bottom_nav_path = os.path.join(MOBILE_DIR, "src", "components", "BottomNavBar.tsx")
    app_path = os.path.join(MOBILE_DIR, "App.tsx")
    auth_store_path = os.path.join(MOBILE_DIR, "src", "store", "authStore.ts")

    files_to_check = {
        "SettingsScreen.tsx": (settings_screen_path, ["useTranslation", "SUPPORTED_LANGUAGES", "derivedLanguage", "resetToDefaultLanguage"]),
        "AppNavigator.tsx": (nav_path, ["SettingsScreen", 'name="Settings"']),
        "BottomNavBar.tsx": (bottom_nav_path, ["useTranslation", 'name: "Settings"']),
        "App.tsx": (app_path, ["I18nProvider", "<I18nProvider>"]),
        "authStore.ts": (auth_store_path, ["updateUserLanguagePreference", "updatePreferredLanguage", "i18n.setLanguage"]),
    }

    all_passed = True
    for fname, (fpath, keywords) in files_to_check.items():
        if not os.path.exists(fpath):
            print(f"[FAIL] Missing {fname} at {fpath}")
            all_passed = False
            continue

        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()

        missing_kw = [kw for kw in keywords if kw not in content]
        if missing_kw:
            print(f"[FAIL] {fname} missing keywords: {missing_kw}")
            all_passed = False
        else:
            print(f"[PASS] {fname} verified with required integrations.")

    return all_passed

def main():
    print("=======================================================")
    print("VERIFYING PHASE D: MOBILE MULTILINGUAL SUPPORT")
    print("=======================================================")

    p1 = check_locales()
    p2 = check_i18n_module()
    p3 = check_screens_integration()

    if p1 and p2 and p3:
        print("\n=======================================================")
        print("ALL PHASE D MOBILE MULTILINGUAL TESTS PASSED!")
        print("=======================================================\n")
        sys.exit(0)
    else:
        print("\n[FAILED] One or more tests failed.\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
