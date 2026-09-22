"""
services/auth.py
Backward-compatibility shim for Phase 24 migration.

All auth-critical logic (JWT creation/decode, session validation, permission enforcement)
has been moved to app/authz/deps.py.  This module re-exports the functions that existing
routers import from here so they continue to work without modification.

New code should import directly from app.authz.deps.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.config import settings
from app.models import UserRole

# Re-export Phase 24 auth functions from their canonical location
from app.authz.deps import (  # noqa: F401
    authenticate as get_current_user,
    require_roles,
)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.jwt_expire_minutes)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError as exc:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHENTICATED",
                "message": "Invalid or expired authentication credentials.",
                "detail": "Invalid or expired authentication credentials.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
