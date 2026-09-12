"""
Intellifusion Backend — FastAPI entry point.
Phase 0: minimal skeleton, routes added phase by phase.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth_router,
    observations_router,
    sync_router,
    kpi_router,
    audit_router,
    ocr_router,
)
from app.config import settings

app = FastAPI(
    title="Intellifusion API",
    description="AI-Based Smart Governance & Compliance Monitoring for Coal Mines",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
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
            "/audit/verify",
            "/audit/log",
        ],
    }
