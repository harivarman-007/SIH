"""
scope.py
Centralized, fail-closed scoping logic for multi-mine and multi-tenant access control.
Binding Decisions: D18, D22, Section 5, MUST #5.
Fail closed: missing mine_site_id, missing assignment, or unknown role means empty set / 403.
"""
from typing import List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.authz.errors import forbidden
from app.models import (
    Alert,
    ContractorAssignment,
    CorporateMineAccess,
    CorrectiveAction,
    Inspection,
    MineSite,
    Observation,
    User,
    UserRole,
)


async def visible_mine_ids(db: AsyncSession, user: User) -> List[UUID]:
    """
    Returns list of mine IDs accessible by the user.
    Fails closed: if no access or missing field, returns empty list.
    """
    if user.role == UserRole.super_admin:
        stmt = select(MineSite.id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    if user.role in (UserRole.corporate_management, UserRole.regulator):
        # MUST #5: Both corporate management and regulator scope use corporate_mine_access
        stmt = select(CorporateMineAccess.mine_site_id).where(CorporateMineAccess.user_id == user.id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    if user.role in (UserRole.mine_official, UserRole.inspector):
        if user.mine_site_id is not None:
            return [user.mine_site_id]
        # Fail closed: missing mine_site_id -> no mines
        return []

    if user.role == UserRole.contractor:
        stmt = (
            select(Observation.mine_site_id)
            .join(ContractorAssignment, ContractorAssignment.observation_id == Observation.id)
            .where(ContractorAssignment.contractor_id == user.id)
            .distinct()
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    return []


async def apply_observation_scope(stmt, user: User, db: AsyncSession):
    """
    Applies role-scoped filtering to an Observation SQLAlchemy statement.
    Fail-closed: returns an impossible condition if scope cannot be resolved.
    """
    if user.role == UserRole.super_admin:
        return stmt

    if user.role in (UserRole.corporate_management, UserRole.regulator):
        mines = await visible_mine_ids(db, user)
        if not mines:
            return stmt.where(Observation.id == None)  # fail closed
        return stmt.where(Observation.mine_site_id.in_(mines))

    if user.role == UserRole.mine_official:
        if not user.mine_site_id:
            return stmt.where(Observation.id == None)  # fail closed
        return stmt.where(Observation.mine_site_id == user.mine_site_id)

    if user.role == UserRole.inspector:
        if not user.mine_site_id:
            # Inspector without assigned mine can only see observations they personally authored
            return stmt.where(Observation.inspector_id == user.id)
        return stmt.where(
            (Observation.inspector_id == user.id) | (Observation.mine_site_id == user.mine_site_id)
        )

    if user.role == UserRole.contractor:
        # Decision D18: contractor sees ONLY observations linked to their assigned actions/work
        return stmt.join(
            ContractorAssignment, ContractorAssignment.observation_id == Observation.id
        ).where(ContractorAssignment.contractor_id == user.id)

    return stmt.where(Observation.id == None)


async def assert_can_access_observation(db: AsyncSession, observation: Observation, user: User) -> None:
    """
    Asserts that the user is authorized to view/access the given observation instance.
    Raises AuthZException(403) on violation.
    """
    if user.role == UserRole.super_admin:
        return

    if user.role in (UserRole.corporate_management, UserRole.regulator):
        mines = await visible_mine_ids(db, user)
        if observation.mine_site_id not in mines:
            raise forbidden("You do not have access to observations from this mine site.")
        return

    if user.role == UserRole.mine_official:
        if not user.mine_site_id or observation.mine_site_id != user.mine_site_id:
            raise forbidden("You do not have access to observations from this mine site.")
        return

    if user.role == UserRole.inspector:
        if observation.inspector_id == user.id:
            return
        if user.mine_site_id and observation.mine_site_id == user.mine_site_id:
            return
        raise forbidden("You do not have access to this observation.")

    if user.role == UserRole.contractor:
        stmt = select(ContractorAssignment.id).where(
            ContractorAssignment.observation_id == observation.id,
            ContractorAssignment.contractor_id == user.id,
        )
        res = await db.execute(stmt)
        if not res.scalar_one_or_none():
            raise forbidden("You are not assigned to this observation.")
        return

    raise forbidden("Access denied to observation.")


async def apply_alert_scope(stmt, user: User, db: AsyncSession):
    """
    Applies role-scoped and user-scoped filtering to an Alert SQLAlchemy statement.
    """
    if user.role == UserRole.super_admin:
        return stmt

    mines = await visible_mine_ids(db, user)

    # User can see alerts specifically targeted to them OR alerts for their role within visible mines
    role_condition = Alert.recipient_role == user.role.value
    if mines:
        role_condition = role_condition & (Alert.mine_site_id.in_(mines) | Alert.mine_site_id.is_(None))
    else:
        role_condition = role_condition & Alert.mine_site_id.is_(None)

    return stmt.where(
        (Alert.recipient_user_id == user.id) | role_condition
    )


# ---------------------------------------------------------------------------
# Inspection Scoping (Phase 25)
# ---------------------------------------------------------------------------

async def apply_inspection_scope(stmt, user: User, db: AsyncSession):
    """
    Applies role-scoped filtering to an Inspection SQLAlchemy query statement.
    Fail-closed: missing scope/assignments returns empty query (id == None).
    """
    if user.role == UserRole.super_admin:
        return stmt

    if user.role in (UserRole.corporate_management, UserRole.regulator):
        mines = await visible_mine_ids(db, user)
        if not mines:
            return stmt.where(Inspection.id == None)
        return stmt.where(Inspection.mine_site_id.in_(mines))

    if user.role == UserRole.mine_official:
        if not user.mine_site_id:
            return stmt.where(Inspection.id == None)
        return stmt.where(Inspection.mine_site_id == user.mine_site_id)

    if user.role == UserRole.inspector:
        # Inspector sees inspections assigned directly to them, or scheduled at their assigned mine
        cond = Inspection.assigned_inspector_id == user.id
        if user.mine_site_id:
            cond = cond | (Inspection.mine_site_id == user.mine_site_id)
        return stmt.where(cond)

    # Contractors or unmapped roles fail closed
    return stmt.where(Inspection.id == None)


async def assert_can_access_inspection(inspection: Inspection, user: User, db: AsyncSession):
    """
    Raises HTTP 403 (AuthZException) if the user is not permitted to access this inspection.
    """
    if user.role == UserRole.super_admin:
        return

    if user.role in (UserRole.corporate_management, UserRole.regulator):
        mines = await visible_mine_ids(db, user)
        if inspection.mine_site_id not in mines:
            raise forbidden("You do not have access to inspections for this mine site.")
        return

    if user.role == UserRole.mine_official:
        if not user.mine_site_id or inspection.mine_site_id != user.mine_site_id:
            raise forbidden("You do not have access to inspections outside your assigned mine site.")
        return

    if user.role == UserRole.inspector:
        if inspection.assigned_inspector_id == user.id:
            return
        if user.mine_site_id and inspection.mine_site_id == user.mine_site_id:
            return
        raise forbidden("You are not assigned or authorized for this inspection.")

    raise forbidden("Access denied to inspection.")


# ---------------------------------------------------------------------------
# Corrective Action Scoping (Phase 26)
# ---------------------------------------------------------------------------

async def apply_action_scope(stmt, user: User, db: AsyncSession):
    """
    Applies role-scoped filtering to a CorrectiveAction SQLAlchemy statement.
    Fail-closed: returns an impossible condition if scope cannot be resolved.
    """
    if user.role == UserRole.super_admin:
        return stmt

    if user.role in (UserRole.corporate_management, UserRole.regulator):
        mines = await visible_mine_ids(db, user)
        if not mines:
            return stmt.where(CorrectiveAction.id == None)
        return stmt.where(CorrectiveAction.mine_site_id.in_(mines))

    if user.role == UserRole.mine_official:
        if not user.mine_site_id:
            return stmt.where(CorrectiveAction.id == None)
        return stmt.where(CorrectiveAction.mine_site_id == user.mine_site_id)

    if user.role == UserRole.inspector:
        cond = CorrectiveAction.assigned_by_user_id == user.id
        if user.mine_site_id:
            cond = cond | (CorrectiveAction.mine_site_id == user.mine_site_id)
        return stmt.where(cond)

    if user.role == UserRole.contractor:
        return stmt.where(CorrectiveAction.assigned_to_user_id == user.id)

    return stmt.where(CorrectiveAction.id == None)


async def assert_can_access_action(db: AsyncSession, action: CorrectiveAction, user: User) -> None:
    """
    Asserts that the user is authorized to view/access the given corrective action instance.
    Raises AuthZException(403) on violation.
    """
    if user.role == UserRole.super_admin:
        return

    if user.role in (UserRole.corporate_management, UserRole.regulator):
        mines = await visible_mine_ids(db, user)
        if action.mine_site_id not in mines:
            raise forbidden("You do not have access to actions from this mine site.")
        return

    if user.role == UserRole.mine_official:
        if not user.mine_site_id or action.mine_site_id != user.mine_site_id:
            raise forbidden("You do not have access to actions outside your assigned mine site.")
        return

    if user.role == UserRole.inspector:
        if action.assigned_by_user_id == user.id:
            return
        if user.mine_site_id and action.mine_site_id == user.mine_site_id:
            return
        raise forbidden("You are not authorized for this corrective action.")

    if user.role == UserRole.contractor:
        if action.assigned_to_user_id == user.id:
            return
        raise forbidden("You are not assigned to this corrective action.")

    raise forbidden("Access denied to corrective action.")


