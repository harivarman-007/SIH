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
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

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
    under_review = "under_review"
    action_required = "action_required"
    in_progress = "in_progress"
    closed = "closed"
    escalated = "escalated"


class InspectionStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    SUBMITTED = "SUBMITTED"
    CANCELLED = "CANCELLED"

    # Lowercase aliases for backward compatibility
    scheduled = "SCHEDULED"
    in_progress = "IN_PROGRESS"
    completed = "COMPLETED"
    submitted = "SUBMITTED"
    cancelled = "CANCELLED"


class ActionPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ActionStatus(str, enum.Enum):
    ASSIGNED = "ASSIGNED"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    REJECTED = "REJECTED"
    VERIFIED = "VERIFIED"
    CLOSED = "CLOSED"

    # Lowercase aliases for backward compatibility
    assigned = "ASSIGNED"
    accepted = "ACCEPTED"
    in_progress = "IN_PROGRESS"
    pending_verification = "PENDING_VERIFICATION"
    rejected = "REJECTED"
    verified = "VERIFIED"
    closed = "CLOSED"


class EvidenceKind(str, enum.Enum):
    before_photo = "before_photo"
    after_photo = "after_photo"
    document = "document"
    note = "note"

    BEFORE_PHOTO = "before_photo"
    AFTER_PHOTO = "after_photo"
    DOCUMENT = "document"
    NOTE = "note"


class OcrReviewStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


UNRESOLVED_STATUSES = {
    ObservationStatus.open,
    ObservationStatus.under_review,
    ObservationStatus.action_required,
    ObservationStatus.in_progress,
    ObservationStatus.escalated,
}


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="userrole", create_type=False), nullable=False)
    mine_site_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id"), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    mine_site = relationship("MineSite", back_populates="users")
    observations = relationship("Observation", back_populates="inspector", foreign_keys="Observation.inspector_id")
    corporate_mine_accesses = relationship("CorporateMineAccess", back_populates="user", cascade="all, delete-orphan")
    contractor_assignments = relationship("ContractorAssignment", back_populates="contractor", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


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
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=func.true())
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

    # Environmental & Production Statutory Threshold Compliance
    compliance_status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "compliant", "violation", "warning"
    threshold_breach_detail: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Location
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)   # null if underground
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)   # null if underground
    beacon_id: Mapped[str | None] = mapped_column(String(100), nullable=True)  # underground stand-in

    # Edge (on-device) risk scoring
    edge_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    edge_flag: Mapped[RiskFlag | None] = mapped_column(Enum(RiskFlag), nullable=True)
    edge_reasons: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    risk_score_source: Mapped[str] = mapped_column(String(50), default="ai_auto", server_default="ai_auto", nullable=False)
    manual_score_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

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

    # Workflow & Inspection link (Phase 25)
    inspection_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inspections.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    inspector = relationship("User", back_populates="observations", foreign_keys=[inspector_id])
    mine_site = relationship("MineSite", back_populates="observations")
    zone = relationship("Zone")
    closed_by = relationship("User", foreign_keys=[closed_by_id])
    inspection = relationship("Inspection", back_populates="observations")
    contractor_assignments = relationship("ContractorAssignment", back_populates="observation", cascade="all, delete-orphan")
    corrective_actions = relationship("CorrectiveAction", back_populates="observation", cascade="all, delete-orphan")


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


# ---------------------------------------------------------------------------
# Alert (in-app notification generated by auto-escalation scheduler)
# ---------------------------------------------------------------------------

class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # recipient_role: which role class this alert targets (mine_official, corporate_management, etc.)
    recipient_role: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # recipient_user_id: targeted user alert
    recipient_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    # mine_site_id: if set, alert is scoped to users of recipient_role at this site
    mine_site_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=True, index=True)
    # observation_id: the observation that triggered this alert
    observation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("observations.id", ondelete="CASCADE"), nullable=True, index=True)
    # action_id: future corrective action reference (FK-less for Phase 24 per spec D19)
    action_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("corrective_actions.id", ondelete="SET NULL"), nullable=True, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    recipient_user = relationship("User", foreign_keys=[recipient_user_id])
    action = relationship("CorrectiveAction", foreign_keys=[action_id])


# ---------------------------------------------------------------------------
# Sessions (UserSession per Phase 24)
# ---------------------------------------------------------------------------

class UserSession(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jti: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")


# ---------------------------------------------------------------------------
# Permissions & Role Permissions
# ---------------------------------------------------------------------------

class PermissionModel(Base):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(100), primary_key=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    resource: Mapped[str] = mapped_column(String(50), nullable=False)
    operation: Mapped[str] = mapped_column(String(50), nullable=False)


class RolePermissionModel(Base):
    __tablename__ = "role_permissions"

    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="userrole", create_type=False), primary_key=True)
    permission_code: Mapped[str] = mapped_column(String(100), ForeignKey("permissions.code", ondelete="CASCADE"), primary_key=True)

    permission = relationship("PermissionModel")


# ---------------------------------------------------------------------------
# Inspections (Phase 25)
# ---------------------------------------------------------------------------

class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    mine_site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    zone_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    assigned_inspector_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[InspectionStatus] = mapped_column(
        Enum(InspectionStatus, name="inspectionstatus", create_type=False),
        default=InspectionStatus.scheduled,
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    mine_site = relationship("MineSite")
    zone = relationship("Zone")
    assigned_inspector = relationship("User", foreign_keys=[assigned_inspector_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    observations = relationship("Observation", back_populates="inspection")


# ---------------------------------------------------------------------------
# Workflow Transitions (Phase 25)
# ---------------------------------------------------------------------------

class WorkflowTransition(Base):
    __tablename__ = "workflow_transitions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    from_state: Mapped[str] = mapped_column(String(32), nullable=False)
    to_state: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_role: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False, default="user")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    actor = relationship("User", foreign_keys=[actor_id])


# ---------------------------------------------------------------------------
# Corrective Actions & Evidence (Phase 26)
# ---------------------------------------------------------------------------

class CorrectiveAction(Base):
    __tablename__ = "corrective_actions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    observation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("observations.id", ondelete="CASCADE"), nullable=False, index=True)
    mine_site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    contractor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[ActionPriority] = mapped_column(
        Enum(ActionPriority, name="actionpriority", create_type=False),
        default=ActionPriority.medium,
        nullable=False,
    )
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[ActionStatus] = mapped_column(
        Enum(ActionStatus, name="actionstatus", create_type=False),
        default=ActionStatus.ASSIGNED,
        nullable=False,
        index=True,
    )
    submission_round: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    assigned_to_user_id = synonym("contractor_id")
    assigned_by_user_id = synonym("created_by_id")
    due_at = synonym("deadline")
    verified_by_user_id = synonym("verified_by_id")

    observation = relationship("Observation", back_populates="corrective_actions")
    mine_site = relationship("MineSite")
    contractor = relationship("User", foreign_keys=[contractor_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    verified_by = relationship("User", foreign_keys=[verified_by_id])
    evidence_items = relationship("ActionEvidence", back_populates="action", cascade="all, delete-orphan")

    @property
    def evidences(self):
        return self.evidence_items

    @property
    def safety_standards_referenced(self):
        return getattr(self, "_safety_standards", None)

    @safety_standards_referenced.setter
    def safety_standards_referenced(self, value):
        self._safety_standards = value


class ActionEvidence(Base):
    __tablename__ = "action_evidence"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("corrective_actions.id", ondelete="CASCADE"), nullable=False, index=True)
    round: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    kind: Mapped[EvidenceKind] = mapped_column(
        Enum(EvidenceKind, name="evidencekind", create_type=False),
        nullable=False,
    )
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    file_url = synonym("file_path")
    description = synonym("notes")

    @property
    def hash_sha256(self):
        return getattr(self, "_hash_sha256", None)

    @hash_sha256.setter
    def hash_sha256(self, val):
        self._hash_sha256 = val

    @property
    def file_size_bytes(self):
        return getattr(self, "_file_size_bytes", None)

    @file_size_bytes.setter
    def file_size_bytes(self, val):
        self._file_size_bytes = val

    action = relationship("CorrectiveAction", back_populates="evidence_items")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])


# ---------------------------------------------------------------------------
# Phase 30: System Settings, Compliance Rules, Reports & Contractor Profiles
# ---------------------------------------------------------------------------

class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    updated_by = relationship("User", foreign_keys=[updated_by_id])


class ComplianceRule(Base):
    __tablename__ = "compliance_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    default_severity: Mapped[str] = mapped_column(String(20), nullable=False)
    statutory_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    scope: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    generated_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    generated_by = relationship("User", foreign_keys=[generated_by_id])


class ContractorProfile(Base):
    __tablename__ = "contractor_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    license_no: Mapped[str] = mapped_column(String(100), nullable=False)
    cert_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])


# ---------------------------------------------------------------------------
# Labour Attendance & Statutory Labour Compliance (Item 1)
# ---------------------------------------------------------------------------

class Worker(Base):
    __tablename__ = "workers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    badge_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(128), default="General Miner")
    contractor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    mine_site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    mine_site = relationship("MineSite")
    contractor = relationship("User", foreign_keys=[contractor_id])
    attendance_records = relationship("LabourAttendance", back_populates="worker", cascade="all, delete-orphan")


class LabourAttendance(Base):
    __tablename__ = "labour_attendance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False, index=True)
    mine_site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    shift_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    shift_type: Mapped[str] = mapped_column(String(32), nullable=False)  # "day", "night", "morning", "evening"
    clock_in: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    clock_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hours_worked: Mapped[float] = mapped_column(Float, default=0.0)
    overtime_hours: Mapped[float] = mapped_column(Float, default=0.0)
    is_violation: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    violation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    worker = relationship("Worker", back_populates="attendance_records")
    mine_site = relationship("MineSite")


class LabourComplianceRule(Base):
    __tablename__ = "labour_compliance_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mine_site_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=True, unique=True)
    max_shift_hours: Mapped[float] = mapped_column(Float, default=8.0)
    max_overtime_hours: Mapped[float] = mapped_column(Float, default=2.0)
    min_rest_hours_between_shifts: Mapped[float] = mapped_column(Float, default=16.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    mine_site = relationship("MineSite")


# ---------------------------------------------------------------------------
# Environmental & Production Statutory Thresholds (Item 2)
# ---------------------------------------------------------------------------

class ComplianceThreshold(Base):
    __tablename__ = "compliance_thresholds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)  # "environment", "production"
    metric_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # e.g. "PM10", "blast_seismic_limit"
    max_value: Mapped[float] = mapped_column(Float, nullable=False)
    min_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    mine_site_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("mine_sites.id", ondelete="CASCADE"), nullable=True, index=True)
    statutory_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    mine_site = relationship("MineSite")
