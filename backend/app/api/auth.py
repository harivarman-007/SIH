from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import append_audit_entry
from app.config import settings
from app.database import get_db
from app.models import CorporateMineAccess, User, UserRole
from app.schemas.auth import (
    AdminUserCreateRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_roles,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == req.email.lower().strip())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value}
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email is already taken
    email_clean = req.email.lower().strip()
    stmt = select(User).where(User.email == email_clean)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    if req.role not in (UserRole.inspector, UserRole.contractor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public self-registration is restricted to inspector or contractor roles only. Elevated roles require admin provisioning.",
        )

    pw_hash = hash_password(req.password)
    new_user = User(
        email=email_clean,
        password_hash=pw_hash,
        full_name=req.full_name.strip(),
        role=req.role,
        mine_site_id=req.mine_site_id,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    # Append audit entry for user creation
    await append_audit_entry(
        db=db,
        action="user.registered",
        payload={
            "user_id": str(new_user.id),
            "email": new_user.email,
            "role": new_user.role.value,
            "mine_site_id": str(new_user.mine_site_id) if new_user.mine_site_id else None,
        },
        actor_id=new_user.id,
    )

    access_token = create_access_token(
        data={"sub": str(new_user.id), "email": new_user.email, "role": new_user.role.value}
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(new_user),
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.post("/admin/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    req: AdminUserCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.super_admin)),
):
    """
    Administrative user provisioning endpoint.
    Restricted strictly to super_admin.
    Enables creating users with any role (including corporate_management with mine access).
    """
    email_clean = req.email.lower().strip()
    stmt = select(User).where(User.email == email_clean)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    pw_hash = hash_password(req.password)
    new_user = User(
        email=email_clean,
        password_hash=pw_hash,
        full_name=req.full_name.strip(),
        role=req.role,
        mine_site_id=req.mine_site_id,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    if req.role == UserRole.corporate_management and req.corporate_mine_ids:
        for mid in req.corporate_mine_ids:
            access = CorporateMineAccess(user_id=new_user.id, mine_site_id=mid)
            db.add(access)
        await db.flush()

    await append_audit_entry(
        db=db,
        action="user.admin_created",
        payload={
            "user_id": str(new_user.id),
            "email": new_user.email,
            "role": new_user.role.value,
            "mine_site_id": str(new_user.mine_site_id) if new_user.mine_site_id else None,
            "created_by": str(current_user.id),
        },
        actor_id=current_user.id,
    )

    return UserOut.model_validate(new_user)
