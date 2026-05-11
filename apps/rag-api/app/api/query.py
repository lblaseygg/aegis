from __future__ import annotations

from fastapi import APIRouter, Request

from app.models.requests import QueryRequest, RawQueryRequest
from app.models.responses import QueryResponse, RawChunkResponse, SourceCitation

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query_documents(payload: QueryRequest, request: Request) -> QueryResponse:
    runtime = request.app.state.runtime
    request_id = runtime.new_request_id()
    runtime.audit.write(
        "rag.query.submitted",
        "success",
        request_id,
        {"collection": payload.collection, "model": payload.model, "top_k": payload.top_k},
    )

    matches = runtime.retriever.query(payload.collection, payload.question, payload.top_k)
    filtered = [match for match in matches if match.score >= payload.score_threshold]

    runtime.audit.write(
        "rag.retrieval.performed",
        "success",
        request_id,
        {"collection": payload.collection, "retrieved_chunks": len(filtered), "top_k": payload.top_k},
    )

    generated = runtime.generator.answer(question=payload.question, model=payload.model, chunks=filtered)
    sources = [
        SourceCitation(
            file_name=str(match.metadata["file_name"]),
            chunk_index=int(match.metadata["chunk_index"]),
            score=round(match.score, 4),
            source_path=str(match.metadata["source_path"]),
        )
        for match in filtered
    ]

    runtime.audit.write(
        "answer.generated",
        "success",
        request_id,
        {"model": payload.model, "sources": len(sources)},
    )
    return QueryResponse(answer=generated.answer, sources=sources, request_id=request_id, uncertainty=generated.uncertainty)


@router.post("/query/raw", response_model=list[RawChunkResponse])
async def raw_query(payload: RawQueryRequest, request: Request) -> list[RawChunkResponse]:
    runtime = request.app.state.runtime
    matches = runtime.retriever.query(payload.collection, payload.question, payload.top_k)
    return [
        RawChunkResponse(
            text=match.text,
            score=round(match.score, 4),
            metadata={key: value for key, value in match.metadata.items()},
        )
        for match in matches
    ]
