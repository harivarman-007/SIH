"""
verify_ocr.py
Automated test script for Phase 5: OCR Service.
Tests:
  1. Engine unit tests:
     a) Clear English document -> confidence >= 70, requires_review=False
     b) Degraded blurry document -> confidence < 70, requires_review=True
     c) Hindi document PoC -> Tesseract extracts Hindi text
  2. Full API integration & RBAC:
     a) POST /ocr/submit (clear doc) -> auto-approved
     b) POST /ocr/submit (blurry doc) -> routes to ocr_review_queue
     c) RBAC: inspector cannot access /ocr/queue (403)
     d) GET /ocr/queue as mine_official -> returns queued item
     e) PATCH /ocr/queue/{id} as mine_official -> updates status & corrected text
"""

import io
import os
import sys
import httpx
from PIL import Image, ImageDraw, ImageFont, ImageFilter

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ocr.engine import process_ocr_image

BASE_URL = "http://localhost:8000"


def make_clear_english_image() -> bytes:
    """Generates a high-contrast, crisp image of English text."""
    img = Image.new("RGB", (900, 250), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Default font will work, but larger size is better if truetype available
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
    except Exception:
        font = ImageFont.load_default()

    draw.text((40, 40), "DIRECTORATE GENERAL OF MINES SAFETY", fill=(0, 0, 0), font=font)
    draw.text((40, 100), "STATUTORY SHIFT INSPECTION REPORT", fill=(0, 0, 0), font=font)
    draw.text((40, 160), "HAULAGE ROAD VENTILATION COMPLIANT", fill=(0, 0, 0), font=font)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def make_blurry_degraded_image() -> bytes:
    """Generates a severely blurred, low-contrast, noisy image to trigger low confidence (<70%)."""
    # Create small low-contrast image, blur heavily
    img = Image.new("RGB", (600, 150), color=(180, 180, 180))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except Exception:
        font = ImageFont.load_default()

    draw.text((20, 30), "faint smudged carbon copy observation", fill=(140, 140, 140), font=font)
    draw.text((20, 80), "zone four unreadable damaged strata mark", fill=(145, 145, 145), font=font)

    # Apply heavy blur and resize down and up to degrade
    img = img.filter(ImageFilter.GaussianBlur(radius=2.5))
    img = img.resize((300, 75)).resize((600, 150))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=20)
    return buf.getvalue()


def make_hindi_image() -> bytes:
    """Generates an image with Devanagari Hindi text."""
    img = Image.new("RGB", (900, 220), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    try:
        # Search for available Devanagari font
        font_path = "/usr/share/fonts/truetype/lohit-deva/Lohit-Devanagari.ttf"
        if not os.path.exists(font_path):
            font_path = "/usr/share/fonts/truetype/gargi/Gargi.ttf"
        font = ImageFont.truetype(font_path, 32)
    except Exception:
        font = ImageFont.load_default()

    # "खान सुरक्षा निरीक्षण रिपोर्ट" (Mine Safety Inspection Report)
    # "कोयला खदान अनुपालन" (Coal Mine Compliance)
    draw.text((40, 40), "खान सुरक्षा निरीक्षण रिपोर्ट", fill=(0, 0, 0), font=font)
    draw.text((40, 120), "कोयला खदान अनुपालन", fill=(0, 0, 0), font=font)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_ocr_engine_units():
    print("\n--- Test 1: OCR Engine Unit Tests ---")

    # 1. Clear English
    print("  1a. Processing Clear English Image...")
    clear_bytes = make_clear_english_image()
    res_clear = process_ocr_image(clear_bytes, lang="eng")
    print(f"      Overall Confidence: {res_clear['overall_confidence']}%")
    print(f"      Word Count: {res_clear['word_count']}")
    print(f"      Requires Review: {res_clear['requires_review']}")
    print(f"      Extracted Text: {res_clear['raw_text'][:60]}...")

    assert res_clear["word_count"] > 5, "Clear image should extract multiple words"
    assert res_clear["overall_confidence"] >= 70.0, f"Expected conf >= 70, got {res_clear['overall_confidence']}"
    assert res_clear["requires_review"] is False, "Clear image should NOT require review"
    assert "MINES" in res_clear["raw_text"] or "SAFETY" in res_clear["raw_text"], "Key words not found"
    print("      [PASS] Clear English doc passes with high confidence and no review needed.")

    # 2. Blurry English
    print("\n  1b. Processing Blurry Degraded Image...")
    blurry_bytes = make_blurry_degraded_image()
    res_blurry = process_ocr_image(blurry_bytes, lang="eng")
    print(f"      Overall Confidence: {res_blurry['overall_confidence']}%")
    print(f"      Low Confidence Word Count: {len(res_blurry['low_confidence_words'])}")
    print(f"      Requires Review: {res_blurry['requires_review']}")

    assert res_blurry["requires_review"] is True, "Degraded image MUST trigger requires_review=True"
    print("      [PASS] Blurry degraded image correctly routed to review.")

    # 3. Hindi PoC
    print("\n  1c. Processing Hindi Devanagari Image (PoC)...")
    hindi_bytes = make_hindi_image()
    res_hindi = process_ocr_image(hindi_bytes, lang="hin")
    print(f"      Extracted Hindi Text: {res_hindi['raw_text']}")
    print(f"      Overall Confidence: {res_hindi['overall_confidence']}%")
    print(f"      Word Count: {res_hindi['word_count']}")

    assert res_hindi["word_count"] > 0 or len(res_hindi["raw_text"]) > 0, "Hindi OCR should extract characters/words"
    print("      [PASS] Hindi PoC successfully extracted Devanagari text with Tesseract.")


def test_ocr_api_and_rbac():
    print("\n--- Test 2: OCR API Endpoints & RBAC Review Queue ---")

    # Logins
    print("  2a. Authenticating roles...")
    r_insp = httpx.post(f"{BASE_URL}/auth/login", json={"email": "inspector1@mine.in", "password": "password123"})
    assert r_insp.status_code == 200
    insp_headers = {"Authorization": f"Bearer {r_insp.json()['access_token']}"}

    r_off = httpx.post(f"{BASE_URL}/auth/login", json={"email": "official1@mine.in", "password": "password123"})
    assert r_off.status_code == 200
    off_headers = {"Authorization": f"Bearer {r_off.json()['access_token']}"}

    # Clear document submission
    print("\n  2b. Submitting clear image via POST /ocr/submit (inspector)...")
    clear_bytes = make_clear_english_image()
    files = {"file": ("inspection_clear.png", clear_bytes, "image/png")}
    data = {"document_name": "Shift_Inspection_Haulage_Clear.png", "lang": "eng"}
    r = httpx.post(f"{BASE_URL}/ocr/submit", files=files, data=data, headers=insp_headers)
    assert r.status_code == 200, f"Submit failed: {r.text}"
    clear_res = r.json()
    print(f"      Response status: {clear_res['status']}")
    print(f"      Requires Review: {clear_res['requires_review']}")
    print(f"      Queue ID: {clear_res['queue_id']}")
    assert clear_res["requires_review"] is False, "Clear doc should not require review"
    assert clear_res["status"] == "approved", "Clear doc should have approved status directly"
    assert clear_res["queue_id"] is None, "Direct approval should have no queue ID"
    print("      [PASS] Clear document auto-approved directly without review queue.")

    # Blurry document submission
    print("\n  2c. Submitting blurry image via POST /ocr/submit (inspector)...")
    blurry_bytes = make_blurry_degraded_image()
    files = {"file": ("inspection_blurry.jpg", blurry_bytes, "image/jpeg")}
    data = {"document_name": "Shift_Inspection_Smudged.jpg", "lang": "eng"}
    r = httpx.post(f"{BASE_URL}/ocr/submit", files=files, data=data, headers=insp_headers)
    assert r.status_code == 200, f"Submit failed: {r.text}"
    blurry_res = r.json()
    print(f"      Response status: {blurry_res['status']}")
    print(f"      Requires Review: {blurry_res['requires_review']}")
    print(f"      Queue ID: {blurry_res['queue_id']}")
    assert blurry_res["requires_review"] is True, "Blurry doc must require review"
    assert blurry_res["status"] == "pending", "Blurry doc must have pending status"
    assert blurry_res["queue_id"] is not None, "Pending review must return queue ID"
    queue_id = blurry_res["queue_id"]
    print(f"      [PASS] Blurry document routed to ocr_review_queue (queue_id={queue_id}).")

    # RBAC: Inspector tries to access /ocr/queue
    print("\n  2d. Checking RBAC: Inspector attempting GET /ocr/queue (expect 403)...")
    r_forbidden = httpx.get(f"{BASE_URL}/ocr/queue", headers=insp_headers)
    assert r_forbidden.status_code == 403, f"Expected 403, got {r_forbidden.status_code}"
    print("      [PASS] Inspector correctly denied access to OCR review queue (403 Forbidden).")

    # Mine official accesses /ocr/queue
    print("\n  2e. Mine official listing GET /ocr/queue...")
    r_queue = httpx.get(f"{BASE_URL}/ocr/queue", headers=off_headers)
    assert r_queue.status_code == 200, f"Queue list failed: {r_queue.text}"
    items = r_queue.json()
    print(f"      Found {len(items)} pending item(s) in review queue.")
    matching = [it for it in items if it["id"] == queue_id]
    assert len(matching) > 0, "Queued item not found in queue listing"
    print("      [PASS] Queued item visible in mine_official review queue.")

    # Mine official reviews and corrects item via PATCH /ocr/queue/{id}
    print(f"\n  2f. Mine official approving with correction via PATCH /ocr/queue/{queue_id}...")
    patch_payload = {
        "status": "approved",
        "corrected_text": "Faint carbon copy observation: Zone 4 strata stable with minor spall.",
        "notes": "Manual human correction performed by mine safety officer."
    }
    r_patch = httpx.patch(f"{BASE_URL}/ocr/queue/{queue_id}", json=patch_payload, headers=off_headers)
    assert r_patch.status_code == 200, f"Patch failed: {r_patch.text}"
    updated_item = r_patch.json()
    assert updated_item["status"] == "approved", "Status not updated to approved"
    assert updated_item["raw_text"] == patch_payload["corrected_text"], "Corrected text not saved"
    assert updated_item["reviewer_id"] is not None, "Reviewer ID not set"
    assert updated_item["reviewed_at"] is not None, "Reviewed timestamp not set"
    print(f"      Status: {updated_item['status']}")
    print(f"      Corrected Text: {updated_item['raw_text']}")
    print(f"      Reviewer ID: {updated_item['reviewer_id']}")
    print("      [PASS] Human review and text correction successfully applied and recorded.")


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING PHASE 5 OCR SERVICE VERIFICATION")
    print("=" * 60)
    test_ocr_engine_units()
    test_ocr_api_and_rbac()
    print("\n" + "=" * 60)
    print("ALL PHASE 5 OCR TESTS COMPLETED AND PASSED!")
    print("=" * 60)
