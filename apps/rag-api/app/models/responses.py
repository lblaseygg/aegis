from __future__ import annotations

from pydantic import BaseModel, Field


class SourceCitation(BaseModel):
    file_name: str
    chunk_index: int
    score: float
    source_path: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]
    request_id: str
    uncertainty: str | None = None


class RawChunkResponse(BaseModel):
    text: str
    score: float
    metadata: dict[str, str | int | float | bool]


class CollectionSummary(BaseModel):
    name: str
    chunks: int


class IngestResponse(BaseModel):
    collection: str
    parsed: int
    skipped: int
    failed: int
    chunks: int
    errors: list[str] = Field(default_factory=list)
