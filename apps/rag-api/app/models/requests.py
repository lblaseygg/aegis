from __future__ import annotations

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    path: str = Field(..., description="Path to the documents directory or file.")
    collection: str = Field(default="default")
    recursive: bool = Field(default=True)


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    collection: str = Field(default="default")
    model: str = Field(default="gemma3:4b")
    top_k: int = Field(default=6, ge=1, le=20)
    score_threshold: float = Field(default=0.45, ge=0.0, le=1.0)


class RawQueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    collection: str = Field(default="default")
    top_k: int = Field(default=6, ge=1, le=20)
