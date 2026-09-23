import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.audit.chain import append_audit_entry
from app.authz.scope import visible_mine_ids
from app.database import get_db
from app.models import MineSite, User, UserRole, Worker
from app.schemas.labour import WorkerCreate, WorkerOut, WorkerUpdate
from app.services.auth import get_current_user

router = APIRouter(prefix="/workers", tags=["workers"])

ALLOWED_LABOUR_ROLES = {
    UserRole.super_admin,
    UserRole.mine_official,
    UserRole.corporate_management,
    UserRole.regulator,
}


def _verify_labour_role(user: User):
    """Enforce fail-closed role-gating for statutory labour and worker master data."""
    if user.role not in ALLOWED_LABOUR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to worker master directory is restricted to mine officials, corporate management, regulators, and administrators.",
        )


@router.post("", response_model=WorkerOut, status_code=status.HTTP_201_CREATED)
async def create_worker(
    req: WorkerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new worker in the master directory with unique badge number."""
    _verify_labour_role(current_user)

    # Scope check for caller's authorized mines
    allowed_sites = await visible_mine_ids(db, current_user)
    if allowed_sites is not None and req.mine_site_id not in allowed_sites:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot register worker for a mine site outside your operational scope.",
        )

    # Check badge number uniqueness
    existing_stmt = select(Worker).where(Worker.badge_number == req.badge_number.strip())
    existing = (await db.execute(existing_stmt)).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Worker with badge number '{req.badge_number.strip()}' already exists.",
        )

    # Verify mine site exists
    site = await db.get(MineSite, req.mine_site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified mine site does not exist.",
        )

    # Verify contractor if specified
    contractor_name = None
    if req.contractor_id:
        contractor = await db.get(User, req.contractor_id)
        if not contractor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified contractor user does not exist.",
            )
        contractor_name = contractor.full_name

    worker = Worker(
        badge_number=req.badge_number.strip(),
        name=req.name.strip(),
        role=req.role.strip() if req.role else "General Miner",
        contractor_id=req.contractor_id,
        mine_site_id=req.mine_site_id,
        is_active=req.is_active,
    )
    db.add(worker)
    await db.flush()

    await append_audit_entry(
        db,
        action="worker.registered",
        actor_id=current_user.id,
        payload={
            "worker_id": str(worker.id),
            "badge_number": worker.badge_number,
            "name": worker.name,
            "role": worker.role,
            "mine_site_id": str(worker.mine_site_id),
            "contractor_id": str(worker.contractor_id) if worker.contractor_id else None,
        },
    )

    await db.commit()
    await db.refresh(worker)

    return WorkerOut(
        id=worker.id,
        badge_number=worker.badge_number,
        name=worker.name,
        role=worker.role,
        contractor_id=worker.contractor_id,
        contractor_name=contractor_name,
        mine_site_id=worker.mine_site_id,
        mine_site_name=site.name,
        is_active=worker.is_active,
        created_at=worker.created_at,
    )


@router.get("", response_model=List[WorkerOut])
async def list_workers(
    mine_site_id: Optional[uuid.UUID] = Query(None),
    query: Optional[str] = Query(None, description="Search term for name or badge number"),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List workers from master directory scoped to caller's permitted mines."""
    _verify_labour_role(current_user)

    allowed_sites = await visible_mine_ids(db, current_user)
    stmt = (
        select(Worker)
        .options(selectinload(Worker.contractor), selectinload(Worker.mine_site))
        .order_by(Worker.name.asc())
    )

    if allowed_sites is not None:
        stmt = stmt.where(Worker.mine_site_id.in_(allowed_sites))

    if mine_site_id:
        if allowed_sites is not None and mine_site_id not in allowed_sites:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mine site is outside your authorized operational scope.",
            )
        stmt = stmt.where(Worker.mine_site_id == mine_site_id)

    if is_active is not None:
        stmt = stmt.where(Worker.is_active == is_active)

    if query:
        q_clean = query.strip()
        stmt = stmt.where(
            or_(
                Worker.name.ilike(f"%{q_clean}%"),
                Worker.badge_number.ilike(f"%{q_clean}%"),
                Worker.role.ilike(f"%{q_clean}%"),
            )
        )

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    workers = res.scalars().all()

    return [
        WorkerOut(
            id=w.id,
            badge_number=w.badge_number,
            name=w.name,
            role=w.role,
            contractor_id=w.contractor_id,
            contractor_name=w.contractor.full_name if w.contractor else None,
            mine_site_id=w.mine_site_id,
            mine_site_name=w.mine_site.name if w.mine_site else None,
            is_active=w.is_active,
            created_at=w.created_at,
        )
        for w in workers
    ]


@router.get("/{worker_id}", response_model=WorkerOut)
async def get_worker(
    worker_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single worker details by UUID."""
    _verify_labour_role(current_user)

    stmt = (
        select(Worker)
        .options(selectinload(Worker.contractor), selectinload(Worker.mine_site))
        .where(Worker.id == worker_id)
    )
    worker = (await db.execute(stmt)).scalars().first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker not found.",
        )

    allowed_sites = await visible_mine_ids(db, current_user)
    if allowed_sites is not None and worker.mine_site_id not in allowed_sites:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Worker belongs to a mine site outside your operational scope.",
        )

    return WorkerOut(
        id=worker.id,
        badge_number=worker.badge_number,
        name=worker.name,
        role=worker.role,
        contractor_id=worker.contractor_id,
        contractor_name=worker.contractor.full_name if worker.contractor else None,
        mine_site_id=worker.mine_site_id,
        mine_site_name=worker.mine_site.name if worker.mine_site else None,
        is_active=worker.is_active,
        created_at=worker.created_at,
    )


@router.patch("/{worker_id}", response_model=WorkerOut)
async def update_worker(
    worker_id: uuid.UUID,
    req: WorkerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update worker information or toggle active status."""
    _verify_labour_role(current_user)

    stmt = (
        select(Worker)
        .options(selectinload(Worker.contractor), selectinload(Worker.mine_site))
        .where(Worker.id == worker_id)
    )
    worker = (await db.execute(stmt)).scalars().first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker not found.",
        )

    allowed_sites = await visible_mine_ids(db, current_user)
    if allowed_sites is not None and worker.mine_site_id not in allowed_sites:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update worker for an unauthorized mine site.",
        )

    if req.name is not None:
        worker.name = req.name.strip()
    if req.role is not None:
        worker.role = req.role.strip()
    if req.contractor_id is not None:
        worker.contractor_id = req.contractor_id
    if req.is_active is not None:
        worker.is_active = req.is_active

    await append_audit_entry(
        db,
        action="worker.updated",
        actor_id=current_user.id,
        payload={
            "worker_id": str(worker.id),
            "name": worker.name,
            "role": worker.role,
            "is_active": worker.is_active,
        },
    )

    await db.commit()
    await db.refresh(worker)

    return WorkerOut(
        id=worker.id,
        badge_number=worker.badge_number,
        name=worker.name,
        role=worker.role,
        contractor_id=worker.contractor_id,
        contractor_name=worker.contractor.full_name if worker.contractor else None,
        mine_site_id=worker.mine_site_id,
        mine_site_name=worker.mine_site.name if worker.mine_site else None,
        is_active=worker.is_active,
        created_at=worker.created_at,
    )
