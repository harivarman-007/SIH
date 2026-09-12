"""
ocr.py
Pydantic schemas for the OCR ingestion, review queue, and correction endpoints.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models import OcrReviewStatus


class WordConfidence(BaseModel):
    word: str
    confidence: float


class OcrSubmitResponse(BaseModel):
    requires_review: bool
    status: OcrReviewStatus
    overall_confidence: float
    raw_text: str
    word_count: int
    low_confidence_words: List[WordConfidence] = Field(default_factory=list)
    queue_id: Optional[UUID] = None
    document_name: Optional[str] = None


class OcrQueueItemOut(BaseModel):
    id: UUID
    document_name: Optional[str] = None
    raw_text: str
    overall_confidence: float
    confidence_map: Dict[str, Any]
    status: OcrReviewStatus
    submitted_by_id: Optional[UUID] = None
    reviewer_id: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OcrReviewActionRequest(BaseModel):
    status: OcrReviewStatus  # approved or rejected
    corrected_text: Optional[str] = None
    notes: Optional[str] = None
