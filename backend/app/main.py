"""
Intellifusion Backend — FastAPI entry point.
Phase 0: minimal skeleton, routes added phase by phase.
Phase 22: Added APScheduler background escalation + alerts router.
"""
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    actions_router,
    admin_router,
    alerts_router,
    auth_router,
    audit_router,
    inspections_router,
    kpi_router,
    observations_router,
    ocr_router,
    reports_router,
    sync_router,
)
from app.config import settings
from app.scheduler import run_escalation_and_alert

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Background scheduler (auto-escalation every 5 minutes)
# ---------------------------------------------------------------------------
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: launch the escalation scheduler. Shutdown: stop it cleanly."""
    scheduler.add_job(
        run_escalation_and_alert,
        trigger="interval",
        minutes=5,
        id="auto_escalation",
        replace_existing=True,
        misfire_grace_time=120,
    )
    scheduler.start()
    logger.info("APScheduler started — auto-escalation running every 5 minutes.")
    yield
    scheduler.shutdown(wait=False)
    logger.info("APScheduler stopped.")


app = FastAPI(
    title="Intellifusion API",
    description="AI-Based Smart Governance & Compliance Monitoring for Coal Mines",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

allowed_origins = [
    origin.strip()
    for origin in settings.cors_allowed_origins.split(",")
    if origin.strip() and origin.strip() != "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(observations_router)
app.include_router(sync_router)
app.include_router(kpi_router)
app.include_router(audit_router)
app.include_router(ocr_router)
app.include_router(alerts_router)
app.include_router(inspections_router)
app.include_router(actions_router)
app.include_router(admin_router)
app.include_router(reports_router)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "environment": settings.environment}


@app.get("/", tags=["system"])
async def root():
    return {
        "message": "Intellifusion API — Online",
        "docs": "/docs",
        "endpoints": [
            "/auth/login",
            "/auth/register",
            "/observations",
            "/sync/batch",
            "/sync/status",
            "/kpi",
            "/alerts",
            "/audit/verify",
            "/audit/log",
        ],
    }
