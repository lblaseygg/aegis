from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request) -> dict[str, str | bool | int]:
    runtime = request.app.state.runtime
    return {
        "status": "ok",
        "chroma": "ready",
        "ollama": runtime.generator.health(),
        "offline_mode": request.app.state.settings.offline_mode,
        "collections": len(runtime.vector_store.collection_names()),
    }
