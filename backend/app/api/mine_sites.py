"""
mine_sites.py — Mine Sites API Router (Multilingual Support Phase A)

Endpoints:
  - GET /mine-sites/{id}: Returns mine site details including state
  - GET /mine-sites: Returns list of mine sites including state
"""
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.authz.deps import authenticate
from app.database import get_db
from app.models import MineSite, User, Zone
from app.schemas.admin import MineSiteOut

router = APIRouter(prefix="/mine-sites", tags=["mine-sites"])


@router.get("/{site_id}", response_model=MineSiteOut)
async def get_mine_site_by_id(
    site_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(authenticate),
):
    """
    GET /mine-sites/{id}
    Returns details of the specified mine site, including its geographical state.
    """
    site = await db.get(MineSite, site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mine site not found.",
        )

    z_stmt = select(func.count(Zone.id)).where(Zone.mine_site_id == site.id)
    z_res = await db.execute(z_stmt)
    zone_cnt = z_res.scalar() or 0

    return MineSiteOut(
        id=site.id,
        name=site.name,
        location_name=site.location_name,
        lat=site.lat,
        lng=site.lng,
        state=site.state,
        is_active=site.is_active if hasattr(site, "is_active") and site.is_active is not None else True,
        created_at=site.created_at,
        zones_count=zone_cnt,
    )


@router.get("", response_model=List[MineSiteOut])
async def list_mine_sites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(authenticate),
):
    """
    GET /mine-sites
    Returns registered mine sites with state and metadata.
    """
    stmt = select(MineSite).order_by(MineSite.name.asc())
    res = await db.execute(stmt)
    sites = res.scalars().all()
    out: List[MineSiteOut] = []
    for s in sites:
        z_stmt = select(func.count(Zone.id)).where(Zone.mine_site_id == s.id)
        z_res = await db.execute(z_stmt)
        zone_cnt = z_res.scalar() or 0
        out.append(
            MineSiteOut(
                id=s.id,
                name=s.name,
                location_name=s.location_name,
                lat=s.lat,
                lng=s.lng,
                state=s.state,
                is_active=s.is_active if hasattr(s, "is_active") and s.is_active is not None else True,
                created_at=s.created_at,
                zones_count=zone_cnt,
            )
        )
    return out
