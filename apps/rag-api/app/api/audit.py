from __future__ import annotations

from fastapi import APIRouter, Query, Request

router = APIRouter()


@router.get("/audit/recent")
async def recent_audit_events(request: Request, limit: int = Query(default=50, ge=1, le=200)) -> list[dict[str, object]]:
    runtime = request.app.state.runtime
    return runtime.audit.recent(limit=limit)
