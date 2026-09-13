"""
ocr.py
Pydantic schemas for the OCR ingestion, review queue, and correction endpoints.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

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
    image_url: Optional[str] = None


class OcrQueueItemOut(BaseModel):
    id: UUID
    document_name: Optional[str] = None
    image_path: Optional[str] = None  # raw filesystem path (internal)
    image_url: Optional[str] = None   # derived URL for the browser
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

    @model_validator(mode="after")
    def _derive_image_url(self) -> "OcrQueueItemOut":
        """Populate image_url from image_path if not already set."""
        if self.image_url is None and self.image_path:
            self.image_url = f"/ocr/queue/{self.id}/image"
        return self


class OcrReviewActionRequest(BaseModel):
    status: OcrReviewStatus  # approved or rejected
    corrected_text: Optional[str] = None
    notes: Optional[str] = None
