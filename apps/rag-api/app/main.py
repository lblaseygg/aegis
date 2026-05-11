from __future__ import annotations

from fastapi import FastAPI

from app.api.audit import router as audit_router
from app.api.collections import router as collections_router
from app.api.health import router as health_router
from app.api.ingest import router as ingest_router
from app.api.query import router as query_router
from app.config import settings
from app.runtime import create_runtime

app = FastAPI(title="Aegis RAG API", version="0.1.0")
app.state.runtime = create_runtime()
app.state.settings = settings

app.include_router(audit_router)
app.include_router(collections_router)
app.include_router(health_router)
app.include_router(ingest_router)
app.include_router(query_router)
