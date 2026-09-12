"""
engine.py
Core OCR processing using pytesseract with word-level confidence extraction.
Supports English ('eng') and Hindi ('hin').
"""

import io
import logging
from typing import Any, Dict, List, Tuple
from PIL import Image
import pytesseract

log = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 70.0


def process_ocr_image(
    image_bytes: bytes,
    lang: str = "eng",
    threshold: float = CONFIDENCE_THRESHOLD,
) -> Dict[str, Any]:
    """
    Runs pytesseract on the given image bytes, extracting text and word-level confidence.

    Args:
        image_bytes: Raw bytes of the image file.
        lang: Language string for Tesseract ('eng', 'hin', 'eng+hin').
        threshold: Confidence cutoff below which a word is marked low confidence.

    Returns:
        dict with:
          - raw_text: str
          - overall_confidence: float (0.0 - 100.0)
          - word_count: int
          - confidence_map: list of word confidence dicts
          - low_confidence_words: list of words with conf < threshold
          - requires_review: bool (True if any valid word conf < threshold or no text extracted)
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        # Convert paletted or RGBA to RGB for consistent OCR
        if image.mode not in ("L", "RGB"):
            image = image.convert("RGB")
    except Exception as exc:
        log.error("Failed to open image for OCR: %s", exc)
        raise ValueError(f"Invalid image format or corrupted file: {exc}")

    # Extract detailed word-level data
    try:
        data = pytesseract.image_to_data(image, lang=lang, output_type=pytesseract.Output.DICT)
    except Exception as exc:
        log.error("pytesseract image_to_data failed: %s", exc)
        raise RuntimeError(f"OCR execution failed: {exc}")

    words_info: List[Dict[str, Any]] = []
    low_confidence: List[Dict[str, Any]] = []
    valid_confidences: List[float] = []

    n_boxes = len(data.get("text", []))
    for i in range(n_boxes):
        text = data["text"][i]
        conf_str = data["conf"][i]

        try:
            conf = float(conf_str)
        except (ValueError, TypeError):
            continue

        clean_text = text.strip() if text else ""
        # Ignore empty tokens or non-word bounding boxes with conf == -1
        if not clean_text or conf < 0:
            continue

        valid_confidences.append(conf)
        entry = {
            "word": clean_text,
            "confidence": round(conf, 2),
            "left": data.get("left", [0])[i],
            "top": data.get("top", [0])[i],
            "width": data.get("width", [0])[i],
            "height": data.get("height", [0])[i],
        }
        words_info.append(entry)

        if conf < threshold:
            low_confidence.append({"word": clean_text, "confidence": round(conf, 2)})

    # Also extract full clean text using image_to_string for natural line breaks
    try:
        raw_text = pytesseract.image_to_string(image, lang=lang).strip()
    except Exception:
        raw_text = " ".join([w["word"] for w in words_info])

    word_count = len(words_info)
    if word_count > 0:
        overall_conf = round(sum(valid_confidences) / word_count, 2)
        # Any word below threshold triggers manual review
        requires_review = len(low_confidence) > 0
    else:
        overall_conf = 0.0
        requires_review = True

    return {
        "raw_text": raw_text,
        "overall_confidence": overall_conf,
        "word_count": word_count,
        "confidence_map": {
            "words": words_info,
            "threshold": threshold,
            "lang": lang,
        },
        "low_confidence_words": low_confidence,
        "requires_review": requires_review,
    }
