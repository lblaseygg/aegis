from __future__ import annotations

from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "chroma": "ready",
        "ollama": settings.ollama_base_url,
        "offline_mode": settings.offline_mode,
    }
