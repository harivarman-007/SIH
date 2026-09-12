"""
ocr.py
API router for OCR submission and human-in-the-loop review queue.
Endpoints:
  POST  /ocr/submit       — Upload image, run OCR, auto-pass if all word conf >= 70, else queue
  GET   /ocr/queue        — List pending review items (mine_official, regulator)
  GET   /ocr/queue/{id}   — Get specific review item detail
  PATCH /ocr/queue/{id}   — Approve, reject, or correct text (mine_official, regulator)
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import append_audit_entry
from app.database import get_db
from app.models import OcrReviewQueue, OcrReviewStatus, User, UserRole
from app.ocr.engine import process_ocr_image
from app.schemas.ocr import (
    OcrQueueItemOut,
    OcrReviewActionRequest,
    OcrSubmitResponse,
    WordConfidence,
)
from app.services.auth import get_current_user, require_roles

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/submit", response_model=OcrSubmitResponse, status_code=status.HTTP_200_OK)
async def submit_ocr(
    file: UploadFile = File(...),
    document_name: Optional[str] = Form(None),
    lang: str = Form("eng"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ingests an image file and processes it via pytesseract.
    If all words have confidence >= 70%, returns extracted text directly.
    If any word confidence < 70%, routes to ocr_review_queue and returns the queue item ID.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File must be an image, received {file.content_type}",
        )

    try:
        content = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read uploaded file: {exc}",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    doc_name = document_name or file.filename or "uploaded_document"

    try:
        ocr_result = process_ocr_image(content, lang=lang)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR execution failed: {err}",
        )

    low_conf_words = [
        WordConfidence(word=w["word"], confidence=w["confidence"])
        for w in ocr_result["low_confidence_words"]
    ]

    requires_review = ocr_result["requires_review"]

    if not requires_review:
        # High confidence throughout — return text directly
        return OcrSubmitResponse(
            requires_review=False,
            status=OcrReviewStatus.approved,
            overall_confidence=ocr_result["overall_confidence"],
            raw_text=ocr_result["raw_text"],
            word_count=ocr_result["word_count"],
            low_confidence_words=[],
            queue_id=None,
            document_name=doc_name,
        )

    # Low confidence detected — insert into human review queue
    queue_item = OcrReviewQueue(
        document_name=doc_name,
        raw_text=ocr_result["raw_text"],
        confidence_map=ocr_result["confidence_map"],
        overall_confidence=ocr_result["overall_confidence"],
        status=OcrReviewStatus.pending,
        submitted_by_id=current_user.id,
    )
    db.add(queue_item)
    await db.commit()
    await db.refresh(queue_item)

    # Append audit entry
    await append_audit_entry(
        db=db,
        action="ocr.submitted_to_queue",
        payload={
            "queue_id": str(queue_item.id),
            "document_name": doc_name,
            "overall_confidence": queue_item.overall_confidence,
            "low_confidence_count": len(low_conf_words),
            "word_count": ocr_result["word_count"],
        },
        actor_id=current_user.id,
    )

    return OcrSubmitResponse(
        requires_review=True,
        status=OcrReviewStatus.pending,
        overall_confidence=ocr_result["overall_confidence"],
        raw_text=ocr_result["raw_text"],
        word_count=ocr_result["word_count"],
        low_confidence_words=low_conf_words,
        queue_id=queue_item.id,
        document_name=doc_name,
    )


@router.get(
    "/queue",
    response_model=List[OcrQueueItemOut],
    dependencies=[Depends(require_roles(UserRole.mine_official, UserRole.regulator))],
)
async def list_ocr_queue(
    status_filter: Optional[OcrReviewStatus] = Query(OcrReviewStatus.pending),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists documents awaiting manual review in the OCR queue.
    Accessible only to mine_official and regulator roles.
    """
    stmt = select(OcrReviewQueue)
    if status_filter:
        stmt = stmt.where(OcrReviewQueue.status == status_filter)
    stmt = stmt.order_by(desc(OcrReviewQueue.created_at)).limit(limit)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/queue/{item_id}",
    response_model=OcrQueueItemOut,
    dependencies=[Depends(require_roles(UserRole.mine_official, UserRole.regulator))],
)
async def get_ocr_queue_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns full details for an OCR review queue item including confidence map.
    """
    item = await db.get(OcrReviewQueue, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OCR review queue item not found",
        )
    return item


@router.patch(
    "/queue/{item_id}",
    response_model=OcrQueueItemOut,
    dependencies=[Depends(require_roles(UserRole.mine_official, UserRole.regulator))],
)
async def review_ocr_queue_item(
    item_id: UUID,
    req: OcrReviewActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve, reject, or correct a queued OCR document.
    Accessible only to mine_official and regulator roles.
    """
    item = await db.get(OcrReviewQueue, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OCR review queue item not found",
        )

    now_utc = datetime.now(timezone.utc)
    item.status = req.status
    item.reviewer_id = current_user.id
    item.reviewed_at = now_utc

    if req.corrected_text is not None:
        item.raw_text = req.corrected_text

    await db.commit()
    await db.refresh(item)

    # Append audit trail
    await append_audit_entry(
        db=db,
        action="ocr.review_decision",
        payload={
            "queue_id": str(item.id),
            "new_status": item.status.value,
            "has_correction": req.corrected_text is not None,
            "notes": req.notes,
        },
        actor_id=current_user.id,
    )

    return item
