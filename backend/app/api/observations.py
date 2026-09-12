from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import append_audit_entry
from app.database import get_db
from app.models import (
    ContractorAssignment,
    CorporateMineAccess,
    Observation,
    ObservationCategory,
    ObservationStatus,
    RiskFlag,
    User,
    UserRole,
)
from app.schemas.observation import (
    ContractorAssignRequest,
    ContractorAssignmentOut,
    ObservationCloseRequest,
    ObservationCreate,
    ObservationOut,
    RiskCardOut,
)
from app.services.auth import get_current_user, require_roles

router = APIRouter(prefix="/observations", tags=["observations"])


def apply_role_filter(stmt, user: User):
    """
    Filters observation queries based on user role and assigned scope. Fails closed.
    Branches explicitly on all 6 roles per Problem Statement:
      1. super_admin: platform-wide access
      2. corporate_management: scoped explicitly to corporate_mine_access records
      3. mine_official: scoped strictly to single mine_site_id (fails closed if None)
      4. inspector: scoped strictly to own submissions (inspector_id == user.id)
      5. contractor: scoped strictly to work explicitly assigned via contractor_assignments
      6. regulator: platform-wide statutory audit and compliance read access
    """
    if user.role == UserRole.super_admin:
        return stmt
    elif user.role == UserRole.corporate_management:
        # Multi-mine visibility scoped strictly to explicit corporate_mine_access records
        subq = select(CorporateMineAccess.mine_site_id).where(CorporateMineAccess.user_id == user.id)
        return stmt.where(Observation.mine_site_id.in_(subq))
    elif user.role == UserRole.mine_official:
        if user.mine_site_id:
            return stmt.where(Observation.mine_site_id == user.mine_site_id)
        # Fail closed: mine official without an assigned site scope sees no data
        return stmt.where(Observation.id == None)
    elif user.role == UserRole.inspector:
        return stmt.where(Observation.inspector_id == user.id)
    elif user.role == UserRole.contractor:
        # Only work explicitly assigned to this contractor via contractor_assignments
        subq = select(ContractorAssignment.observation_id).where(ContractorAssignment.contractor_id == user.id)
        return stmt.where(Observation.id.in_(subq))
    elif user.role == UserRole.regulator:
        return stmt
    # Default fail closed for any unmapped role
    return stmt.where(Observation.id == None)


@router.post("/", response_model=ObservationOut, status_code=status.HTTP_201_CREATED)
async def create_observation(
    req: ObservationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now_utc = datetime.now(timezone.utc)
    obs_created_at = req.created_at or now_utc

    new_obs = Observation(
        created_at=obs_created_at,
        synced_at=now_utc,
        inspector_id=current_user.id,
        mine_site_id=req.mine_site_id,
        zone_id=req.zone_id,
        category=req.category,
        description=req.description,
        photo_url=req.photo_url,
        has_photo=bool(req.has_photo or req.photo_url),
        lat=req.lat,
        lng=req.lng,
        beacon_id=req.beacon_id,
        edge_score=req.edge_score,
        edge_flag=req.edge_flag,
        edge_reasons=req.edge_reasons,
        status=ObservationStatus.open,
    )
    db.add(new_obs)
    await db.flush()

    # Append audit log
    await append_audit_entry(
        db=db,
        action="observation.created",
        payload={
            "observation_id": str(new_obs.id),
            "category": new_obs.category.value,
            "mine_site_id": str(new_obs.mine_site_id),
            "zone_id": str(new_obs.zone_id),
            "edge_flag": new_obs.edge_flag.value if new_obs.edge_flag else None,
            "edge_score": new_obs.edge_score,
        },
        actor_id=current_user.id,
    )

    return ObservationOut.model_validate(new_obs)


@router.get("/", response_model=List[ObservationOut])
async def list_observations(
    category: Optional[ObservationCategory] = None,
    status_filter: Optional[ObservationStatus] = Query(None, alias="status"),
    edge_flag: Optional[RiskFlag] = None,
    cloud_flag: Optional[RiskFlag] = None,
    mine_site_id: Optional[UUID] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Observation).order_by(desc(Observation.created_at))
    stmt = apply_role_filter(stmt, current_user)

    if category:
        stmt = stmt.where(Observation.category == category)
    if status_filter:
        stmt = stmt.where(Observation.status == status_filter)
    if edge_flag:
        stmt = stmt.where(Observation.edge_flag == edge_flag)
    if cloud_flag:
        stmt = stmt.where(Observation.cloud_flag == cloud_flag)
    if mine_site_id:
        if current_user.role in (UserRole.super_admin, UserRole.regulator, UserRole.corporate_management, UserRole.mine_official):
            stmt = stmt.where(Observation.mine_site_id == mine_site_id)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    observations = result.scalars().all()
    return [ObservationOut.model_validate(o) for o in observations]


@router.get("/{observation_id}", response_model=ObservationOut)
async def get_observation(
    observation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Observation).where(Observation.id == observation_id)
    stmt = apply_role_filter(stmt, current_user)
    result = await db.execute(stmt)
    obs = result.scalar_one_or_none()

    if not obs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Observation not found or access denied",
        )
    return ObservationOut.model_validate(obs)


@router.patch("/{observation_id}/close", response_model=ObservationOut)
async def close_observation(
    observation_id: UUID,
    req: ObservationCloseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.mine_official, UserRole.super_admin)),
):
    stmt = select(Observation).where(Observation.id == observation_id)
    if current_user.role == UserRole.mine_official:
        if not current_user.mine_site_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mine official without an assigned mine site cannot approve closures",
            )
        stmt = stmt.where(Observation.mine_site_id == current_user.mine_site_id)

    result = await db.execute(stmt)
    obs = result.scalar_one_or_none()
    if not obs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Observation not found or access denied for your mine site",
        )

    if obs.status == ObservationStatus.closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Observation is already closed",
        )

    now_utc = datetime.now(timezone.utc)
    obs.status = ObservationStatus.closed
    obs.closed_at = now_utc
    obs.closed_by_id = current_user.id
    obs.closure_note = req.closure_note
    obs.closure_photo_url = req.closure_photo_url
    obs.version += 1

    await db.flush()

    # Append audit log
    await append_audit_entry(
        db=db,
        action="observation.closed",
        payload={
            "observation_id": str(obs.id),
            "closed_by_id": str(current_user.id),
            "closure_note": req.closure_note,
            "has_closure_photo": bool(req.closure_photo_url),
            "closed_at": now_utc.isoformat(),
        },
        actor_id=current_user.id,
    )

    return ObservationOut.model_validate(obs)


@router.get("/{observation_id}/risk-card", response_model=RiskCardOut)
async def get_risk_card(
    observation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Observation).where(Observation.id == observation_id)
    stmt = apply_role_filter(stmt, current_user)
    result = await db.execute(stmt)
    obs = result.scalar_one_or_none()

    if not obs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Observation not found or access denied",
        )

    return RiskCardOut(
        observation_id=obs.id,
        category=obs.category,
        description=obs.description,
        status=obs.status,
        edge_score=obs.edge_score,
        edge_flag=obs.edge_flag,
        edge_reasons=obs.edge_reasons,
        cloud_score=obs.cloud_score,
        cloud_flag=obs.cloud_flag,
        cloud_reasons=obs.cloud_reasons,
        suggested_action=obs.suggested_action,
        created_at=obs.created_at,
        synced_at=obs.synced_at,
        mine_site_id=obs.mine_site_id,
        zone_id=obs.zone_id,
        beacon_id=obs.beacon_id,
        lat=obs.lat,
        lng=obs.lng,
    )


@router.post(
    "/{observation_id}/assign-contractor",
    response_model=ContractorAssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def assign_contractor(
    observation_id: UUID,
    req: ContractorAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.mine_official, UserRole.super_admin)),
):
    stmt = select(Observation).where(Observation.id == observation_id)
    if current_user.role == UserRole.mine_official:
        if not current_user.mine_site_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mine official without an assigned mine site cannot assign tasks",
            )
        stmt = stmt.where(Observation.mine_site_id == current_user.mine_site_id)

    result = await db.execute(stmt)
    obs = result.scalar_one_or_none()
    if not obs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Observation not found or access denied",
        )

    # Verify contractor user exists and has contractor role
    c_stmt = select(User).where(User.id == req.contractor_id, User.role == UserRole.contractor)
    c_res = await db.execute(c_stmt)
    contractor = c_res.scalar_one_or_none()
    if not contractor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target user is not an active contractor",
        )

    assignment = ContractorAssignment(
        contractor_id=req.contractor_id,
        observation_id=observation_id,
        notes=req.notes,
    )
    db.add(assignment)
    await db.flush()

    await append_audit_entry(
        db=db,
        action="contractor.assigned",
        payload={
            "observation_id": str(observation_id),
            "contractor_id": str(req.contractor_id),
            "assigned_by": str(current_user.id),
        },
        actor_id=current_user.id,
    )
    return ContractorAssignmentOut.model_validate(assignment)
