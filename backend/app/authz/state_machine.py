"""state_machine.py

Pure state machine engine and transition tables for inspections, observations, and corrective actions.
Binding Decisions: D7, D8, D10, D11, D12, Section 5.

Every transition writes a row to workflow_transitions AND appends an entry to the audit log in the SAME transaction.
Enforces human-in-the-loop constraints (D12): actor_type='system' is rejected for closures/verifications.
"""
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, NamedTuple, Optional, Set, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import append_audit_entry
from app.authz.errors import AuthZException
from app.authz.permissions import Permission
from app.models import (
    ActionStatus,
    Inspection,
    InspectionStatus,
    Observation,
    ObservationStatus,
    User,
    UserRole,
    WorkflowTransition,
)


class TransitionRule(NamedTuple):
    from_state: str
    to_state: str
    required_permission: Optional[Permission]
    allowed_actor_types: Set[str]  # e.g. {"user"}, {"user", "system"}
    description: str


# ---------------------------------------------------------------------------
# Inspection Transitions
# ---------------------------------------------------------------------------
# States: SCHEDULED, IN_PROGRESS, COMPLETED, SUBMITTED, CANCELLED

INSPECTION_TRANSITIONS: List[TransitionRule] = [
    TransitionRule(
        from_state=InspectionStatus.scheduled.value,
        to_state=InspectionStatus.in_progress.value,
        required_permission=Permission.INSPECTION_START,
        allowed_actor_types={"user"},
        description="Inspector begins assigned inspection",
    ),
    TransitionRule(
        from_state=InspectionStatus.in_progress.value,
        to_state=InspectionStatus.completed.value,
        required_permission=Permission.INSPECTION_START,
        allowed_actor_types={"user"},
        description="Inspector marks all field checklists completed",
    ),
    TransitionRule(
        from_state=InspectionStatus.completed.value,
        to_state=InspectionStatus.submitted.value,
        required_permission=Permission.INSPECTION_SUBMIT,
        allowed_actor_types={"user"},
        description="Inspector submits completed inspection report for review",
    ),
    TransitionRule(
        from_state=InspectionStatus.in_progress.value,
        to_state=InspectionStatus.submitted.value,
        required_permission=Permission.INSPECTION_SUBMIT,
        allowed_actor_types={"user"},
        description="Inspector directly submits active inspection report for review",
    ),
    TransitionRule(
        from_state=InspectionStatus.scheduled.value,
        to_state=InspectionStatus.cancelled.value,
        required_permission=Permission.INSPECTION_CANCEL,
        allowed_actor_types={"user"},
        description="Mine official cancels scheduled inspection",
    ),
]

# Quick lookup: (from_state, to_state) -> TransitionRule
INSPECTION_TRANSITION_MAP: Dict[Tuple[str, str], TransitionRule] = {
    (t.from_state, t.to_state): t for t in INSPECTION_TRANSITIONS
}

ALL_INSPECTION_STATES: Set[str] = {s.value for s in InspectionStatus}


# ---------------------------------------------------------------------------
# Observation Transitions (Decision D8)
# ---------------------------------------------------------------------------
# States: open, under_review, action_required, in_progress, closed, escalated

OBSERVATION_TRANSITIONS: List[TransitionRule] = [
    TransitionRule(
        from_state=ObservationStatus.open.value,
        to_state=ObservationStatus.under_review.value,
        required_permission=Permission.OBSERVATION_REVIEW,
        allowed_actor_types={"user"},
        description="Mine official reviews synced observation",
    ),
    TransitionRule(
        from_state=ObservationStatus.under_review.value,
        to_state=ObservationStatus.action_required.value,
        required_permission=Permission.ACTION_CREATE,
        allowed_actor_types={"user"},
        description="Corrective action created and assigned to contractor",
    ),
    TransitionRule(
        from_state=ObservationStatus.open.value,
        to_state=ObservationStatus.action_required.value,
        required_permission=Permission.ACTION_CREATE,
        allowed_actor_types={"user"},
        description="Corrective action created directly for open observation",
    ),
    TransitionRule(
        from_state=ObservationStatus.under_review.value,
        to_state=ObservationStatus.closed.value,
        required_permission=Permission.OBSERVATION_CLOSE,
        allowed_actor_types={"user"},  # D12: Human-in-the-loop mandatory
        description="Mine official closes observation with 'no action required' note",
    ),
    TransitionRule(
        from_state=ObservationStatus.action_required.value,
        to_state=ObservationStatus.in_progress.value,
        required_permission=Permission.ACTION_START,
        allowed_actor_types={"user"},
        description="Contractor commences work on linked corrective action",
    ),
    TransitionRule(
        from_state=ObservationStatus.in_progress.value,
        to_state=ObservationStatus.closed.value,
        required_permission=Permission.ACTION_VERIFY,
        allowed_actor_types={"user"},  # D12: Human-in-the-loop mandatory
        description="Mine official verifies and approves all linked actions",
    ),
    # Auto-escalation transitions (by scheduler or manual RISK_ESCALATE)
    TransitionRule(
        from_state=ObservationStatus.open.value,
        to_state=ObservationStatus.escalated.value,
        required_permission=Permission.RISK_ESCALATE,
        allowed_actor_types={"user", "system"},
        description="SLA breached or manual risk escalation",
    ),
    TransitionRule(
        from_state=ObservationStatus.under_review.value,
        to_state=ObservationStatus.escalated.value,
        required_permission=Permission.RISK_ESCALATE,
        allowed_actor_types={"user", "system"},
        description="SLA breached during review",
    ),
    TransitionRule(
        from_state=ObservationStatus.action_required.value,
        to_state=ObservationStatus.escalated.value,
        required_permission=Permission.RISK_ESCALATE,
        allowed_actor_types={"user", "system"},
        description="SLA breached waiting for contractor assignment",
    ),
    TransitionRule(
        from_state=ObservationStatus.in_progress.value,
        to_state=ObservationStatus.escalated.value,
        required_permission=Permission.RISK_ESCALATE,
        allowed_actor_types={"user", "system"},
        description="SLA breached during contractor remediation",
    ),
    # Resumption from escalated state:
    TransitionRule(
        from_state=ObservationStatus.escalated.value,
        to_state=ObservationStatus.under_review.value,
        required_permission=Permission.OBSERVATION_REVIEW,
        allowed_actor_types={"user"},
        description="Mine official reviews escalated observation",
    ),
    TransitionRule(
        from_state=ObservationStatus.escalated.value,
        to_state=ObservationStatus.action_required.value,
        required_permission=Permission.ACTION_CREATE,
        allowed_actor_types={"user"},
        description="Corrective action created for escalated observation",
    ),
    TransitionRule(
        from_state=ObservationStatus.escalated.value,
        to_state=ObservationStatus.in_progress.value,
        required_permission=Permission.ACTION_START,
        allowed_actor_types={"user"},
        description="Contractor starts work on escalated action",
    ),
    TransitionRule(
        from_state=ObservationStatus.escalated.value,
        to_state=ObservationStatus.closed.value,
        required_permission=Permission.OBSERVATION_CLOSE,
        allowed_actor_types={"user"},
        description="Mine official closes escalated observation",
    ),
]

OBSERVATION_TRANSITION_MAP: Dict[Tuple[str, str], TransitionRule] = {
    (t.from_state, t.to_state): t for t in OBSERVATION_TRANSITIONS
}

ALL_OBSERVATION_STATES: Set[str] = {s.value for s in ObservationStatus}


# ---------------------------------------------------------------------------
# Corrective Action Transitions (Phase 26 / 27b)
# ---------------------------------------------------------------------------
# States: ASSIGNED, ACCEPTED, IN_PROGRESS, PENDING_VERIFICATION, REJECTED, VERIFIED, CLOSED
#
# Spec-compliant flow (MUST #4, Phase 27b):
#   ASSIGNED -> ACCEPTED            (contractor: /accept)
#   ACCEPTED -> IN_PROGRESS         (contractor: /start)
#   IN_PROGRESS -> PENDING_VERIFICATION (contractor: /submit)
#   PENDING_VERIFICATION -> VERIFIED (mine official: /verify)
#   VERIFIED -> CLOSED              (mine official: /verify, atomic D7)
#   PENDING_VERIFICATION -> REJECTED (mine official: /reject, mandatory reason)
#   REJECTED -> IN_PROGRESS         (contractor: /start – the ONLY re-entry path)
#
# REOPEN_IN_PROGRESS is removed: REJECTED IS the persistent state after rejection.
# The contractor sees the rejection reason on the action detail and calls /start
# to transition back to IN_PROGRESS before re-submitting evidence.

ACTION_TRANSITIONS: List[TransitionRule] = [
    TransitionRule(
        from_state=ActionStatus.ASSIGNED.value,
        to_state=ActionStatus.ACCEPTED.value,
        required_permission=Permission.ACTION_ACCEPT,
        allowed_actor_types={"user"},
        description="Contractor accepts assigned work order",
    ),
    TransitionRule(
        from_state=ActionStatus.ACCEPTED.value,
        to_state=ActionStatus.IN_PROGRESS.value,
        required_permission=Permission.ACTION_START,
        allowed_actor_types={"user"},
        description="Contractor commences remediation work",
    ),
    TransitionRule(
        from_state=ActionStatus.IN_PROGRESS.value,
        to_state=ActionStatus.PENDING_VERIFICATION.value,
        required_permission=Permission.ACTION_SUBMIT,
        allowed_actor_types={"user"},
        description="Contractor submits completed work with evidence for verification",
    ),
    TransitionRule(
        from_state=ActionStatus.PENDING_VERIFICATION.value,
        to_state=ActionStatus.VERIFIED.value,
        required_permission=Permission.ACTION_VERIFY,
        allowed_actor_types={"user"},  # D12: Human-in-the-loop mandatory
        description="Mine official verifies uploaded evidence and approves work",
    ),
    TransitionRule(
        from_state=ActionStatus.VERIFIED.value,
        to_state=ActionStatus.CLOSED.value,
        required_permission=Permission.ACTION_VERIFY,
        allowed_actor_types={"user"},  # D12: Human-in-the-loop mandatory
        description="Atomic closure transition of verified work order",
    ),
    TransitionRule(
        from_state=ActionStatus.PENDING_VERIFICATION.value,
        to_state=ActionStatus.REJECTED.value,
        required_permission=Permission.ACTION_REJECT,
        allowed_actor_types={"user"},
        description="Mine official rejects work evidence with mandatory reason; audit event ACTION_REJECTED",
    ),
    TransitionRule(
        from_state=ActionStatus.REJECTED.value,
        to_state=ActionStatus.IN_PROGRESS.value,
        required_permission=Permission.ACTION_START,
        allowed_actor_types={"user"},
        description="Contractor resumes work after rejection (only re-entry path)",
    ),
]

ACTION_TRANSITION_MAP: Dict[Tuple[str, str], TransitionRule] = {
    (t.from_state, t.to_state): t for t in ACTION_TRANSITIONS
}

ALL_ACTION_STATES: Set[str] = {s.value for s in ActionStatus}


# ---------------------------------------------------------------------------
# Transition Engine Helper
# ---------------------------------------------------------------------------

def validate_transition(
    entity_type: str,
    from_state: str,
    to_state: str,
    actor_type: str = "user",
) -> TransitionRule:
    """
    Validates that a transition from from_state to to_state is permissible.
    Raises HTTPException(400) on invalid transitions or D12 human-in-the-loop violations.
    """
    if entity_type == "inspection":
        rule = INSPECTION_TRANSITION_MAP.get((from_state, to_state))
    elif entity_type == "observation":
        rule = OBSERVATION_TRANSITION_MAP.get((from_state, to_state))
    elif entity_type == "action":
        rule = ACTION_TRANSITION_MAP.get((from_state, to_state))
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNKNOWN_ENTITY_TYPE",
                "message": f"Unsupported entity type '{entity_type}'.",
                "detail": f"Unsupported entity type '{entity_type}'.",
            },
        )

    if not rule:
        msg = f"Illegal transition for {entity_type} from '{from_state}' to '{to_state}'."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_STATE_TRANSITION",
                "message": msg,
                "detail": msg,
            },
        )

    # Enforce Decision D12: Human-in-the-loop check
    if actor_type not in rule.allowed_actor_types:
        msg = f"Transition to '{to_state}' requires human actor; '{actor_type}' is prohibited (D12)."
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "HUMAN_IN_THE_LOOP_REQUIRED",
                "message": msg,
                "detail": msg,
            },
        )

    return rule


async def execute_transition(
    db: AsyncSession,
    entity_type: str,
    entity_id: UUID,
    from_state: str,
    to_state: str,
    actor: Optional[User] = None,
    actor_type: str = "user",
    reason: Optional[str] = None,
    audit_action: Optional[str] = None,
    audit_payload: Optional[Dict[str, Any]] = None,
) -> WorkflowTransition:
    """
    Validates and executes a state transition.
    Atomically inserts a workflow_transitions record AND appends an audit ledger entry.
    """
    rule = validate_transition(entity_type, from_state, to_state, actor_type=actor_type)

    actor_id = actor.id if actor else None
    actor_role = actor.role.value if actor else "system"

    # 1. Record workflow transition row
    transition = WorkflowTransition(
        entity_type=entity_type,
        entity_id=entity_id,
        from_state=from_state,
        to_state=to_state,
        actor_id=actor_id,
        actor_role=actor_role,
        actor_type=actor_type,
        reason=reason,
    )
    db.add(transition)
    await db.flush()

    # 2. Append cryptographic audit log in the same transaction
    action_name = audit_action or f"{entity_type}.state_transition"
    payload = {
        "entity_type": entity_type,
        "entity_id": str(entity_id),
        "from_state": from_state,
        "to_state": to_state,
        "actor_type": actor_type,
        "reason": reason,
    }
    if audit_payload:
        payload.update(audit_payload)

    await append_audit_entry(
        db=db,
        action=action_name,
        payload=payload,
        actor_id=actor_id,
    )

    return transition
