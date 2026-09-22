"""
errors.py
Standardized authorization error schemas and HTTP exceptions.
MUST #3: return {code, message, detail} where detail == message.
Decision D13: standard error codes UNAUTHENTICATED, SESSION_EXPIRED, ACCOUNT_DISABLED, FORBIDDEN.
Decision §25: 403 message must not leak internal implementation detail.
"""
from typing import Any, Dict
from fastapi import HTTPException, status


class AuthZException(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, headers: Dict[str, Any] | None = None):
        detail_payload = {
            "code": code,
            "message": message,
            "detail": message,  # MUST #3: detail == message for existing frontend clients
        }
        super().__init__(status_code=status_code, detail=detail_payload, headers=headers)


def unauthenticated(message: str = "Authentication credentials were not provided or are invalid.") -> AuthZException:
    return AuthZException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        code="UNAUTHENTICATED",
        message=message,
        headers={"WWW-Authenticate": "Bearer"},
    )


def session_expired(message: str = "Your session has expired or been revoked. Please sign in again.") -> AuthZException:
    return AuthZException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        code="SESSION_EXPIRED",
        message=message,
        headers={"WWW-Authenticate": "Bearer"},
    )


def account_disabled(message: str = "This user account has been disabled. Contact system administrator.") -> AuthZException:
    return AuthZException(
        status_code=status.HTTP_403_FORBIDDEN,
        code="ACCOUNT_DISABLED",
        message=message,
    )


def forbidden(message: str = "You do not have permission to perform this action.") -> AuthZException:
    return AuthZException(
        status_code=status.HTTP_403_FORBIDDEN,
        code="FORBIDDEN",
        message=message,
    )
