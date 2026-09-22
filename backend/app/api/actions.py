"""actions.py

API router for Corrective Actions, Evidence Upload, & Verification/Closure Workflow (Phase 26).
Binding Decisions: D1, D3, D5, D7, D10, D11, D12, D18, D19, D21, D22.
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import append_audit_entry
from app.authz.deps import require_permission
from app.authz.errors import forbidden
from app.authz.permissions import Permission
from app.authz.scope import apply_action_scope, assert_can_access_action
from app.authz.state_machine import execute_transition
from app.database import get_db
from app.models import (
    ActionEvidence,
    ActionPriority,
    ActionStatus,
    Alert,
    ContractorAssignment,
    CorrectiveAction,
    EvidenceKind,
    Observation,
    ObservationStatus,
    User,
    UserRole,
)
from app.schemas.actions import (
    ActionCreate,
    ActionDetailOut,
    ActionOut,
    ActionRejectRequest,
    EvidenceCreate,
    EvidenceOut,
)

router = APIRouter(prefix="/actions", tags=["actions"])


async def _generate_action_code(db: AsyncSession) -> str:
    """Generates sequential code ACT-0001 per Decision D21."""
    stmt = select(func.count(CorrectiveAction.id))
    result = await db.execute(stmt)
    count = result.scalar() or 0
    return f"ACT-{count + 1:04d}"


@router.post("", response_model=ActionOut, status_code=status.HTTP_201_CREATED)
async def create_action(
    req: ActionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ACTION_CREATE)),
):
    """
    Creates and assigns a new corrective action for a compliance observation.
    Restricted to users with ACTION_CREATE permission (e.g. Mine Official, Super Admin).
    Generates ACT-xxxx code and dispatches alert to assigned contractor.
    """
    # 1. Fetch parent observation
    observation = await db.get(Observation, req.observation_id)
    if not observation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent observation not found.",
        )

    if observation.status == ObservationStatus.closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create corrective action for a closed observation.",
        )

    # Scope validation
    if current_user.role == UserRole.mine_official:
        if not current_user.mine_site_id or current_user.mine_site_id != observation.mine_site_id:
            raise forbidden("Cannot create actions for observations outside your assigned mine site.")

    # 2. Validate contractor user
    contractor = await db.get(User, req.assigned_to_user_id)
    if not contractor or contractor.role != UserRole.contractor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned user must be an active contractor.",
        )

    # 3. Create action record
    code = await _generate_action_code(db)
    action = CorrectiveAction(
        code=code,
        observation_id=req.observation_id,
        mine_site_id=observation.mine_site_id,
        title=req.title,
        description=req.description,
        assigned_to_user_id=req.assigned_to_user_id,
        assigned_by_user_id=current_user.id,
        priority=req.priority,
        status=ActionStatus.assigned,
        due_at=req.due_at,
        safety_standards_referenced=req.safety_standards_referenced,
        submission_round=1,
    )
    db.add(action)
    await db.flush()

    # Ensure ContractorAssignment entry exists for observation access scope (D18)
    assignment_stmt = select(ContractorAssignment).where(
        ContractorAssignment.observation_id == req.observation_id,
        ContractorAssignment.contractor_id == req.assigned_to_user_id,
    )
    assignment_res = await db.execute(assignment_stmt)
    if not assignment_res.scalar_one_or_none():
        new_assignment = ContractorAssignment(
            observation_id=req.observation_id,
            contractor_id=req.assigned_to_user_id,
            notes=f"Assigned via corrective action {code}",
        )
        db.add(new_assignment)

    # 4. Dispatch Alert (D19)
    alert = Alert(
        recipient_role="contractor",
        recipient_user_id=req.assigned_to_user_id,
        mine_site_id=observation.mine_site_id,
        action_id=action.id,
        observation_id=observation.id,
        message=f"[ACTION_ASSIGNED] '{req.title}' assigned to you. Due at {req.due_at.isoformat()}.",
    )
    db.add(alert)

    # 5. Audit log
    await append_audit_entry(
        db=db,
        action="action.create",
        payload={
            "action_id": str(action.id),
            "code": code,
            "observation_id": str(req.observation_id),
            "assigned_to_user_id": str(req.assigned_to_user_id),
            "priority": req.priority.value,
        },
        actor_id=current_user.id,
    )

    await db.commit()
    await db.refresh(action)
    return action


@router.get("", response_model=List[ActionOut])
async def list_actions(
    status_filter: Optional[ActionStatus] = Query(None, alias="status"),
    mine_site_id: Optional[UUID] = None,
    assigned_to_user_id: Optional[UUID] = None,
    priority: Optional[ActionPriority] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ACTION_VIEW)),
):
    """
    Lists corrective actions with role-scoped filtering and parameters.
    """
    stmt = select(CorrectiveAction)

    if status_filter:
        stmt = stmt.where(CorrectiveAction.status == status_filter)
    if mine_site_id:
        stmt = stmt.where(CorrectiveAction.mine_site_id == mine_site_id)
    if assigned_to_user_id:
        stmt = stmt.where(CorrectiveAction.assigned_to_user_id == assigned_to_user_id)
    if priority:
        stmt = stmt.where(CorrectiveAction.priority == priority)

    stmt = await apply_action_scope(stmt, current_user, db)
    stmt = stmt.order_by(desc(CorrectiveAction.created_at)).offset(offset).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{action_id}", response_model=ActionDetailOut)
async def get_action(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ACTION_VIEW)),
):
    """
    Retrieves complete details of a single corrective action, including uploaded evidence.
    """
    action = await db.get(CorrectiveAction, action_id)
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Corrective action not found.",
        )

    await assert_can_access_action(db, action, current_user)

    # Fetch evidences
    ev_stmt = select(ActionEvidence).where(ActionEvidence.action_id == action.id).order_by(ActionEvidence.uploaded_at.asc())
    ev_res = await db.execute(ev_stmt)
    evidences = list(ev_res.scalars().all())

    # Fetch names
    assigned_to = await db.get(User, action.assigned_to_user_id)
    assigned_by = await db.get(User, action.assigned_by_user_id)
    verified_by = await db.get(User, action.verified_by_user_id) if action.verified_by_user_id else None

    detail = ActionDetailOut.model_validate(action)
    detail.evidences = [EvidenceOut.model_validate(ev) for ev in evidences]
    detail.assigned_to_name = assigned_to.full_name if assigned_to else None
    detail.assigned_by_name = assigned_by.full_name if assigned_by else None
    detail.verified_by_name = verified_by.full_name if verified_by else None

    return detail


@router.post("/{action_id}/accept", response_model=ActionOut)
async def accept_action(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ACTION_ACCEPT)),
):
    """
    Contractor accepts assigned corrective action work order.
    Transitions status: assigned -> accepted.
    """
    action = await db.get(CorrectiveAction, action_id)
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found.")

    await assert_can_access_action(db, action, current_user)

    await execute_transition(
        db,
        entity_type="action",
        entity_id=action.id,
        from_state=action.status.value,
        to_state=ActionStatus.accepted.value,
        actor=current_user,
        actor_type="user",
        audit_action="action.accept",
    )

    action.status = ActionStatus.accepted
    action.accepted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(action)
    return action


@router.post("/{action_id}/start", response_model=ActionOut)
async def start_action(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ACTION_START)),
):
    """
    Contractor commences (or resumes) remediation work.
    Transitions:
      - ACCEPTED -> IN_PROGRESS  (first time)
      - REJECTED -> IN_PROGRESS  (after manager rejection: the ONLY re-entry path after rejection)
    The contractor must call /start to see the rejection_reason before re-submitting.
    """
    action = await db.get(CorrectiveAction, action_id)
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found.")

    await assert_can_access_action(db, action, current_user)

    await execute_transition(
        db,
        entity_type="action",
        entity_id=action.id,
        from_state=action.status.value,
        to_state=ActionStatus.in_progress.value,
        actor=current_user,
        actor_type="user",
        audit_action="action.start",
    )

    action.status = ActionStatus.in_progress
    action.started_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(action)
    return action


@router.post("/{action_id}/evidence", response_model=EvidenceOut, status_code=status.HTTP_201_CREATED)
async def upload_evidence(
    action_id: UUID,
    req: EvidenceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.EVIDENCE_UPLOAD)),
):
    """
    Uploads proof of work photo or document evidence for a corrective action.
    """
    action = await db.get(CorrectiveAction, action_id)
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found.")

    await assert_can_access_action(db, action, current_user)

    evidence = ActionEvidence(
        action_id=action.id,
        kind=req.kind,
        file_url=req.file_url,
        hash_sha256=req.hash_sha256,
        file_size_bytes=req.file_size_bytes,
        uploaded_by_id=current_user.id,
        description=req.description,
    )
    db.add(evidence)
    await db.flush()

    await append_audit_entry(
        db=db,
        action="action.evidence_upload",
        payload={
            "action_id": str(action.id),
            "evidence_id": str(evidence.id),
            "kind": req.kind.value,
            "file_url": req.file_url,
        },
        actor_id=current_user.id,
    )

    await db.commit()
    await db.refresh(evidence)
    return evidence


@router.post("/{action_id}/submit", response_model=ActionOut)
async def submit_action(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ACTION_SUBMIT)),
):
    """
    Contractor submits completed work order for verification.
    Requires at least 1 evidence attachment.
    Transitions: IN_PROGRESS -> PENDING_VERIFICATION only.
    After rejection the contractor must call /start first (REJECTED->IN_PROGRESS),
    then upload new evidence, then call /submit (IN_PROGRESS->PENDING_VERIFICATION).
    """
    action = await db.get(CorrectiveAction, action_id)
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found.")

    await assert_can_access_action(db, action, current_user)

    # Require proof of work evidence
    ev_count_stmt = select(func.count(ActionEvidence.id)).where(ActionEvidence.action_id == action.id)
    ev_res = await db.execute(ev_count_stmt)
    ev_count = ev_res.scalar() or 0

    if ev_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one proof of work evidence item is required before submission.",
        )

    await execute_transition(
        db,
        entity_type="action",
        entity_id=action.id,
        from_state=action.status.value,
        to_state=ActionStatus.pending_verification.value,
        actor=current_user,
        actor_type="user",
        audit_action="action.submit",
    )

    action.status = ActionStatus.pending_verification
    action.submitted_at = datetime.now(timezone.utc)

    # Alert assigning mine official
    alert = Alert(
        recipient_role="mine_official",
        recipient_user_id=action.assigned_by_user_id,
        mine_site_id=action.mine_site_id,
        action_id=action.id,
        observation_id=action.observation_id,
        message=f"[ACTION_SUBMITTED] {action.code}: Contractor submitted work. Verification required.",
    )
    db.add(alert)

    await db.commit()
    await db.refresh(action)
    return action


@router.post("/{action_id}/verify", response_model=ActionOut)
async def verify_action(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ACTION_VERIFY)),
):
    """
    Mine Official verifies evidence and approves closure of corrective action.
    Transitions: pending_verification -> verified -> closed (Decision D12 human-in-the-loop enforced).
    Checks atomic observation closure (Decision D7): if all linked actions are closed, automatically closes parent observation.
    """
    action = await db.get(CorrectiveAction, action_id)
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found.")

    await assert_can_access_action(db, action, current_user)

    # Step 1: pending_verification -> verified (D12: actor_type='user' enforced by state machine)
    await execute_transition(
        db,
        entity_type="action",
        entity_id=action.id,
        from_state=action.status.value,
        to_state=ActionStatus.verified.value,
        actor=current_user,
        actor_type="user",
        audit_action="action.verify",
    )

    # Step 2: verified -> closed
    await execute_transition(
        db,
        entity_type="action",
        entity_id=action.id,
        from_state=ActionStatus.verified.value,
        to_state=ActionStatus.closed.value,
        actor=current_user,
        actor_type="user",
        audit_action="action.close",
    )

    now = datetime.now(timezone.utc)
    action.status = ActionStatus.closed
    action.verified_at = now
    action.verified_by_user_id = current_user.id
    action.closed_at = now
    await db.flush()

    # Decision D7: Atomic parent observation closure check
    obs_actions_stmt = select(CorrectiveAction).where(CorrectiveAction.observation_id == action.observation_id)
    obs_actions_res = await db.execute(obs_actions_stmt)
    all_obs_actions = list(obs_actions_res.scalars().all())

    all_closed = all(a.status == ActionStatus.closed for a in all_obs_actions)
    if all_closed:
        observation = await db.get(Observation, action.observation_id)
        if observation and observation.status != ObservationStatus.closed:
            # Transition observation to closed if permitted
            try:
                await execute_transition(
                    db,
                    entity_type="observation",
                    entity_id=observation.id,
                    from_state=observation.status.value,
                    to_state=ObservationStatus.closed.value,
                    actor=current_user,
                    actor_type="user",
                    reason=f"Atomic closure: all corrective actions verified and closed (via {action.code})",
                    audit_action="observation.close",
                )
            except Exception:
                # Fallback if intermediate observation state requires override
                await append_audit_entry(
                    db=db,
                    action="observation.close_atomic_fallback",
                    payload={
                        "observation_id": str(observation.id),
                        "closed_via_action": action.code,
                    },
                    actor_id=current_user.id,
                )

            observation.status = ObservationStatus.closed
            observation.closed_at = now
            observation.closure_verified_by_id = current_user.id
            observation.closure_notes = f"All linked corrective actions verified and closed (via {action.code})."

    await db.commit()
    await db.refresh(action)
    return action


@router.post("/{action_id}/reject", response_model=ActionOut)
async def reject_action(
    action_id: UUID,
    req: ActionRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ACTION_REJECT)),
):
    """
    Mine Official rejects work submission with mandatory reason (min 10 chars).
    Audit event: ACTION_REJECTED.
    Status transitions: PENDING_VERIFICATION -> REJECTED.
    The rejection_reason is stored on the action and is visible to the contractor
    via GET /actions/{id}. The contractor then calls /start to transition
    REJECTED -> IN_PROGRESS, uploads new evidence, and calls /submit again.
    """
    action = await db.get(CorrectiveAction, action_id)
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found.")

    await assert_can_access_action(db, action, current_user)

    await execute_transition(
        db,
        entity_type="action",
        entity_id=action.id,
        from_state=action.status.value,
        to_state=ActionStatus.rejected.value,
        actor=current_user,
        actor_type="user",
        reason=req.reason,
        audit_action="ACTION_REJECTED",
    )

    action.status = ActionStatus.rejected
    action.submission_round += 1
    action.rejection_reason = req.reason

    # Alert contractor with rejection reason so they see it immediately
    alert = Alert(
        recipient_role="contractor",
        recipient_user_id=action.assigned_to_user_id,
        mine_site_id=action.mine_site_id,
        action_id=action.id,
        observation_id=action.observation_id,
        message=f"[ACTION_REJECTED] {action.code}: Submission rejected. Reason: {req.reason}",
    )
    db.add(alert)

    await db.commit()
    await db.refresh(action)
    return action
