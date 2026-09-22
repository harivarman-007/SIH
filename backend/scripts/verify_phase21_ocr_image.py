"""
verify_phase21_ocr_image.py
Phase 21 verification: OCR image persistence backend changes.

Checks:
1. OcrReviewQueue model has image_path column
2. Migration 004_add_ocr_image_path.py exists and is correct
3. ocr.py submit_ocr saves image bytes to settings.ocr_upload_path
4. ocr.py has GET /queue/{id}/image endpoint
5. OcrQueueItemOut schema derives image_url from image_path via model_validator
6. Frontend OcrQueueItem type includes image_url field  (SKIP if dashboard/ not mounted)
7. OcrQueueView.tsx contains no Unsplash URLs, no hardcoded fakes  (SKIP if not mounted)
8. OcrQueueView.tsx renders real metadata  (SKIP if not mounted)
"""
import sys
from pathlib import Path

# Resolve paths: prefer /repo bind-mount (docker-compose.override.yml dev profile)
_REPO = Path("/repo")
BACKEND = _REPO / "backend" if _REPO.is_dir() else Path(__file__).parent.parent
DASHBOARD = _REPO / "dashboard" if _REPO.is_dir() else BACKEND.parent / "dashboard"

_passed = 0
_failed = 0
_skipped = 0


def check(label: str, condition: bool) -> bool:
    global _passed, _failed
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}")
    if condition:
        _passed += 1
    else:
        _failed += 1
    return condition


def skip(label: str, reason: str = "dashboard/ not mounted") -> None:
    global _skipped
    print(f"  [SKIP] {label} — {reason}")
    _skipped += 1


def main():
    global _passed, _failed, _skipped
    _passed = _failed = _skipped = 0

    print("\n=== Phase 21: OCR Image Persistence Verification ===\n")

    # 1. Model has image_path
    models_path = BACKEND / "app" / "models" / "__init__.py"
    models_text = models_path.read_text()
    check(
        "OcrReviewQueue model has image_path column",
        "image_path" in models_text and "OcrReviewQueue" in models_text
    )

    # 2. Migration 004 exists and references image_path
    mig = BACKEND / "alembic" / "versions" / "004_add_ocr_image_path.py"
    check("Migration 004_add_ocr_image_path.py exists", mig.exists())
    if mig.exists():
        mig_text = mig.read_text()
        check("Migration 004 adds image_path column", "image_path" in mig_text and "add_column" in mig_text)

    # 3. submit_ocr saves image bytes to disk
    ocr_api = BACKEND / "app" / "api" / "ocr.py"
    ocr_text = ocr_api.read_text()
    check(
        "submit_ocr saves image bytes to ocr_upload_path",
        "ocr_upload_path" in ocr_text and "saved_path.write_bytes(content)" in ocr_text
    )
    check("submit_ocr sets image_path on queue_item", "image_path=str(saved_path)" in ocr_text)

    # 4. Image streaming endpoint exists
    check(
        "GET /queue/{id}/image endpoint defined in ocr.py",
        "get_ocr_queue_item_image" in ocr_text and "FileResponse" in ocr_text
    )

    # 5. Schema derives image_url from image_path
    schema_path = BACKEND / "app" / "schemas" / "ocr.py"
    schema_text = schema_path.read_text()
    check("OcrQueueItemOut has image_url field", "image_url" in schema_text)
    check(
        "OcrQueueItemOut uses model_validator to derive image_url from image_path",
        "model_validator" in schema_text and "_derive_image_url" in schema_text
    )

    # 6-8. Frontend checks
    if DASHBOARD.is_dir():
        # 6. Frontend type includes image_url
        ocr_ts = DASHBOARD / "src" / "api" / "ocr.ts"
        ocr_ts_text = ocr_ts.read_text()
        check("OcrQueueItem TypeScript interface includes image_url field", "image_url" in ocr_ts_text)

        # 7. OcrQueueView.tsx has no hardcoded fakes
        view_path = DASHBOARD / "src" / "components" / "OcrQueueView.tsx"
        view_text = view_path.read_text()

        check("OcrQueueView.tsx has no Unsplash URL", "unsplash.com" not in view_text.lower())

        fake_fields = [
            ("hardcoded mineSite", "'Jharia Coalfield Central"),
            ("hardcoded shift", "'Daily Statutory Shift'"),
            ("hardcoded location", "'Gallery 4 Underground Section'"),
            ("hardcoded severity string", "severity: 'high'"),
            ("hardcoded category string", "category: 'Safety'"),
        ]
        for label, snippet in fake_fields:
            check(f"No {label} in OcrQueueView.tsx", snippet not in view_text)

        # 8. OcrQueueView.tsx renders real metadata
        real_fields = [
            ("document_name", "document_name"),
            ("submitted_by_id", "submitted_by_id"),
            ("created_at", "created_at"),
            ("overall_confidence", "overall_confidence"),
            ("confidence_map (uncertain words)", "confidence_map"),
            ("authenticated image blob loading", "useAuthedImage"),
        ]
        for label, snippet in real_fields:
            check(f"OcrQueueView.tsx references real field: {label}", snippet in view_text)
    else:
        DASHBOARD_CHECKS = [
            "OcrQueueItem TypeScript interface includes image_url field",
            "OcrQueueView.tsx has no Unsplash URL",
            "No hardcoded mineSite in OcrQueueView.tsx",
            "No hardcoded shift in OcrQueueView.tsx",
            "No hardcoded location in OcrQueueView.tsx",
            "No hardcoded severity string in OcrQueueView.tsx",
            "No hardcoded category string in OcrQueueView.tsx",
            "OcrQueueView.tsx references real field: document_name",
            "OcrQueueView.tsx references real field: submitted_by_id",
            "OcrQueueView.tsx references real field: created_at",
            "OcrQueueView.tsx references real field: overall_confidence",
            "OcrQueueView.tsx references real field: confidence_map (uncertain words)",
            "OcrQueueView.tsx references real field: authenticated image blob loading",
        ]
        for lbl in DASHBOARD_CHECKS:
            skip(lbl, "dashboard/ not mounted — add docker-compose.override.yml for full coverage")

    print()
    total = _passed + _failed + _skipped
    if _failed == 0:
        print(f"PASS: {_passed}/{_passed + _failed} Phase 21 checks PASSED  [{_skipped} SKIPPED]")
    else:
        print(f"FAIL: {_failed} check(s) FAILED  ({_passed}/{_passed + _failed} passed, {_skipped} SKIPPED)")
    return _failed


if __name__ == "__main__":
    sys.exit(main())
