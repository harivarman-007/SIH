from app.api.auth import router as auth_router
from app.api.observations import router as observations_router
from app.api.sync import router as sync_router
from app.api.kpi import router as kpi_router
from app.api.audit import router as audit_router
from app.api.ocr import router as ocr_router

__all__ = [
    "auth_router",
    "observations_router",
    "sync_router",
    "kpi_router",
    "audit_router",
    "ocr_router",
]

