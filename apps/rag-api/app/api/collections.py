from __future__ import annotations

from fastapi import APIRouter, Request

from app.models.responses import CollectionSummary

router = APIRouter()


@router.get("/collections", response_model=list[CollectionSummary])
async def list_collections(request: Request) -> list[CollectionSummary]:
    runtime = request.app.state.runtime
    return [
        CollectionSummary(name=name, chunks=runtime.vector_store.chunk_count(name))
        for name in runtime.vector_store.collection_names()
    ]
