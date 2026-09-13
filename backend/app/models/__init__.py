"""
All SQLAlchemy ORM models for Intellifusion.
Tables: users, mine_sites, zones, observations, audit_log, ocr_review_queue
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    corporate_management = "corporate_management"
    mine_official = "mine_official"
    inspector = "inspector"
    contractor = "contractor"
    regulator = "regulator"


class ObservationCategory(str, enum.Enum):
    safety = "safety"
    environment = "environment"
    labour = "labour"
    production = "production"


class RiskFlag(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ObservationStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    closed = "closed"
    escalated = "escalated"


class OcrReviewStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    mine_site_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    mine_site = relationship("MineSite", back_populates="users")
    observations = relationship("Observation", back_populates="inspector", foreign_keys="Observation.inspector_id")
    corporate_mine_accesses = relationship("CorporateMineAccess", back_populates="user", cascade="all, delete-orphan")
    contractor_assignments = relationship("ContractorAssignment", back_populates="contractor", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Mine Site & Zone
# ---------------------------------------------------------------------------

class MineSite(Base):
    __tablename__ = "mine_sites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location_name: Mapped[str] = mapped_column(String(255), nullable=False)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    zones = relationship("Zone", back_populates="mine_site")
    users = relationship("User", back_populates="mine_site")
    observations = relationship("Observation", back_populates="mine_site")
    corporate_accesses = relationship("CorporateMineAccess", back_populates="mine_site")


class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mine_site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    zone_type: Mapped[str] = mapped_column(String(50), nullable=False)  # surface / underground
    risk_baseline: Mapped[float] = mapped_column(Float, default=0.3)  # 0-1, used as feature
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    mine_site = relationship("MineSite", back_populates="zones")
    observations = relationship("Observation", back_populates="zone")


# ---------------------------------------------------------------------------
# Observation (core entity)
# ---------------------------------------------------------------------------

class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # client-side timestamp
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # set by server on receipt

    # Ownership
    inspector_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    mine_site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id"), nullable=False)
    zone_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=False)

    # Observation content
    category: Mapped[ObservationCategory] = mapped_column(Enum(ObservationCategory), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    has_photo: Mapped[bool] = mapped_column(Boolean, default=False)

    # Quantitative Gas / Sensor Telemetry Reading
    gas_reading_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    gas_reading_unit: Mapped[str | None] = mapped_column(String(20), nullable=True)  # e.g. "% CH4", "ppm"

    # Location
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)   # null if underground
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)   # null if underground
    beacon_id: Mapped[str | None] = mapped_column(String(100), nullable=True)  # underground stand-in

    # Edge (on-device) risk scoring
    edge_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    edge_flag: Mapped[RiskFlag | None] = mapped_column(Enum(RiskFlag), nullable=True)
    edge_reasons: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Cloud enrichment
    cloud_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    cloud_flag: Mapped[RiskFlag | None] = mapped_column(Enum(RiskFlag), nullable=True)
    cloud_reasons: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    suggested_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    enriched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Status & lifecycle
    status: Mapped[ObservationStatus] = mapped_column(Enum(ObservationStatus), default=ObservationStatus.open, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    closure_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    closure_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    escalated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Conflict tracking (append-only versions)
    version: Mapped[int] = mapped_column(Integer, default=1)
    versions_json: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)

    # Relationships
    inspector = relationship("User", back_populates="observations", foreign_keys=[inspector_id])
    mine_site = relationship("MineSite", back_populates="observations")
    zone = relationship("Zone", back_populates="observations")
    contractor_assignments = relationship("ContractorAssignment", back_populates="observation", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Audit Log (hash-chained, append-only)
# ---------------------------------------------------------------------------

class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    entry_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # "GENESIS" for first entry
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)  # null for system actions
    action: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "observation.created"
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# OCR Review Queue
# ---------------------------------------------------------------------------

class OcrReviewQueue(Base):
    __tablename__ = "ocr_review_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_map: Mapped[dict] = mapped_column(JSONB, nullable=False)
    overall_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[OcrReviewStatus] = mapped_column(Enum(OcrReviewStatus), default=OcrReviewStatus.pending)
    submitted_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Scope & Access Control (Explicit multi-mine and contractor assignment)
# ---------------------------------------------------------------------------

class CorporateMineAccess(Base):
    __tablename__ = "corporate_mine_access"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    mine_site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="corporate_mine_accesses")
    mine_site = relationship("MineSite", back_populates="corporate_accesses")


class ContractorAssignment(Base):
    __tablename__ = "contractor_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contractor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    observation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("observations.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    contractor = relationship("User", back_populates="contractor_assignments")
    observation = relationship("Observation", back_populates="contractor_assignments")
