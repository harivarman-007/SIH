"""
users.py — User Profile & Preferences API Router (Multilingual Support Phase A)

Endpoints:
  - GET /users/me: Returns current user profile including preferred_language and resolved_language
  - PATCH /users/me/language: Update current user's preferred language
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import _build_user_out
from app.audit.chain import append_audit_entry
from app.authz.deps import authenticate
from app.database import get_db
from app.models import User
from app.schemas.auth import LanguageUpdateRequest, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_current_user_profile(
    current_user: User = Depends(authenticate),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /users/me
    Returns the authenticated user's profile with preferred_language and resolved_language.
    """
    return await _build_user_out(current_user, db)


@router.patch("/me/language", response_model=UserOut)
async def update_user_language(
    req: LanguageUpdateRequest,
    current_user: User = Depends(authenticate),
    db: AsyncSession = Depends(get_db),
):
    """
    PATCH /users/me/language
    Update current user's preferred language (en, sa, hi, bn, or, te, mr, sat),
    or pass null to reset to the mine site's state-derived language.
    """
    current_user.preferred_language = req.language
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    await append_audit_entry(
        db=db,
        action="USER_LANGUAGE_UPDATED",
        payload={
            "preferred_language": current_user.preferred_language,
        },
        actor_id=current_user.id,
    )

    return await _build_user_out(current_user, db)
