"""
alerts.py
API router for in-app alert notifications.

Endpoints:
  GET   /alerts          — List unread (or recent) alerts for the current user
  PATCH /alerts/{id}/read — Mark an alert as read
  DELETE /alerts/{id}    — Dismiss/delete an alert (own alerts only)
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Alert, CorporateMineAccess, User, UserRole
from app.schemas.alerts import AlertOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _alert_filter_for_user(stmt, user: User):
    """
    Scope alerts to those relevant to the current user:
      - super_admin / regulator: all alerts
      - mine_official: alerts for mine_official role at their mine_site_id
      - corporate_management: alerts for corporate_management at any of their mines
      - inspector / contractor: alerts for their role at their mine_site_id
    """
    if user.role in (UserRole.super_admin, UserRole.regulator):
        return stmt

    role_val = user.role.value

    if user.role == UserRole.corporate_management:
        # Alerts for corporate_management role, any mine in their access list
        subq = (
            select(CorporateMineAccess.mine_site_id)
            .where(CorporateMineAccess.user_id == user.id)
            .scalar_subquery()
        )
        return stmt.where(
            Alert.recipient_role == role_val,
            or_(Alert.mine_site_id.in_(subq), Alert.mine_site_id.is_(None)),
        )

    if user.mine_site_id:
        return stmt.where(
            Alert.recipient_role == role_val,
            or_(Alert.mine_site_id == user.mine_site_id, Alert.mine_site_id.is_(None)),
        )

    # Fail closed: no mine_site_id means no alerts
    return stmt.where(Alert.id.is_(None))


@router.get("/", response_model=List[AlertOut])
async def list_alerts(
    unread_only: bool = Query(False, description="If true, only return unread alerts"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns alerts relevant to the calling user's role and mine scope.
    Ordered newest first.
    """
    stmt = select(Alert)
    if unread_only:
        stmt = stmt.where(Alert.is_read == False)  # noqa: E712
    stmt = _alert_filter_for_user(stmt, current_user)
    stmt = stmt.order_by(desc(Alert.created_at)).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/{alert_id}/read", response_model=AlertOut)
async def mark_alert_read(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Marks a single alert as read. The alert must be visible to the current user.
    """
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found"
        )

    # Verify the alert is scoped to this user's role / mine
    role_val = current_user.role.value
    if current_user.role not in (UserRole.super_admin, UserRole.regulator):
        if alert.recipient_role != role_val:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Alert is not in your scope",
            )
        if (
            alert.mine_site_id is not None
            and current_user.mine_site_id != alert.mine_site_id
            and current_user.role != UserRole.corporate_management
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Alert is not in your scope",
            )

    alert.is_read = True
    await db.commit()
    await db.refresh(alert)
    return alert
