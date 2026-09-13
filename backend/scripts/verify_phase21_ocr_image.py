"""
verify_phase21_ocr_image.py
Phase 21 verification: OCR image persistence backend changes.

Checks:
1. OcrReviewQueue model has image_path column
2. Migration 004_add_ocr_image_path.py exists and is correct
3. ocr.py submit_ocr saves image bytes to settings.ocr_upload_path
4. ocr.py has GET /queue/{id}/image endpoint
5. OcrQueueItemOut schema derives image_url from image_path via model_validator
6. Frontend OcrQueueItem type includes image_url field
7. OcrQueueView.tsx contains no Unsplash URLs, no hardcoded mineSite/location/shift/severity/category
8. OcrQueueView.tsx renders real metadata: document_name, submitted_by_id, created_at,
   overall_confidence, uncertain words count
"""
import ast
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).parent.parent
DASHBOARD = BACKEND.parent / "dashboard"


def check(label: str, condition: bool) -> bool:
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}")
    return condition


def main():
    failures = 0

    print("\n=== Phase 21: OCR Image Persistence Verification ===\n")

    # 1. Model has image_path
    models_path = BACKEND / "app" / "models" / "__init__.py"
    models_text = models_path.read_text()
    ok = check(
        "OcrReviewQueue model has image_path column",
        "image_path" in models_text and "OcrReviewQueue" in models_text
    )
    failures += not ok

    # 2. Migration 004 exists and references image_path
    mig = BACKEND.parent / "backend" / "alembic" / "versions" / "004_add_ocr_image_path.py"
    ok = check(
        "Migration 004_add_ocr_image_path.py exists",
        mig.exists()
    )
    failures += not ok
    if mig.exists():
        mig_text = mig.read_text()
        ok = check(
            "Migration 004 adds image_path column",
            "image_path" in mig_text and "add_column" in mig_text
        )
        failures += not ok

    # 3. submit_ocr saves image bytes to disk
    ocr_api = BACKEND / "app" / "api" / "ocr.py"
    ocr_text = ocr_api.read_text()
    ok = check(
        "submit_ocr saves image bytes to ocr_upload_path",
        "ocr_upload_path" in ocr_text and "saved_path.write_bytes(content)" in ocr_text
    )
    failures += not ok

    ok = check(
        "submit_ocr sets image_path on queue_item",
        "image_path=str(saved_path)" in ocr_text
    )
    failures += not ok

    # 4. Image streaming endpoint exists
    ok = check(
        "GET /queue/{id}/image endpoint defined in ocr.py",
        "get_ocr_queue_item_image" in ocr_text and "FileResponse" in ocr_text
    )
    failures += not ok

    # 5. Schema derives image_url from image_path
    schema_path = BACKEND / "app" / "schemas" / "ocr.py"
    schema_text = schema_path.read_text()
    ok = check(
        "OcrQueueItemOut has image_url field",
        "image_url" in schema_text
    )
    failures += not ok
    ok = check(
        "OcrQueueItemOut uses model_validator to derive image_url from image_path",
        "model_validator" in schema_text and "_derive_image_url" in schema_text
    )
    failures += not ok

    # 6. Frontend type includes image_url
    ocr_ts = DASHBOARD / "src" / "api" / "ocr.ts"
    ocr_ts_text = ocr_ts.read_text()
    ok = check(
        "OcrQueueItem TypeScript interface includes image_url field",
        "image_url" in ocr_ts_text
    )
    failures += not ok

    # 7. OcrQueueView.tsx has no hardcoded fakes
    view_path = DASHBOARD / "src" / "components" / "OcrQueueView.tsx"
    view_text = view_path.read_text()

    ok = check(
        "OcrQueueView.tsx has no Unsplash URL",
        "unsplash.com" not in view_text.lower()
    )
    failures += not ok

    fake_fields = [
        ("hardcoded mineSite", "'Jharia Coalfield Central"),
        ("hardcoded shift", "'Daily Statutory Shift'"),
        ("hardcoded location", "'Gallery 4 Underground Section'"),
        ("hardcoded severity string", "severity: 'high'"),
        ("hardcoded category string", "category: 'Safety'"),
    ]
    for label, snippet in fake_fields:
        ok = check(f"No {label} in OcrQueueView.tsx", snippet not in view_text)
        failures += not ok

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
        ok = check(f"OcrQueueView.tsx references real field: {label}", snippet in view_text)
        failures += not ok

    print()
    if failures == 0:
        print(f"PASS: All {21} Phase 21 checks PASSED")
    else:
        print(f"FAIL: {failures} check(s) FAILED")
    return failures


if __name__ == "__main__":
    sys.exit(main())
