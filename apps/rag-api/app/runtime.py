from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from app.config import settings
from app.services.audit_logger import AuditLogger
from app.services.chunker import TextChunker
from app.services.document_loader import DocumentLoader
from app.services.embedder import HashEmbedder, SentenceTransformerEmbedder
from app.services.generator import Generator
from app.services.retriever import Retriever
from app.services.vector_store import VectorStore


@dataclass(slots=True)
class Runtime:
    chunker: TextChunker
    loader: DocumentLoader
    vector_store: VectorStore
    retriever: Retriever
    generator: Generator
    audit: AuditLogger

    def new_request_id(self) -> str:
        return f"req_{uuid4().hex[:16]}"


def _make_embedder():
    if settings.embedding_provider == "sentence-transformers":
        return SentenceTransformerEmbedder()
    return HashEmbedder()


def create_runtime() -> Runtime:
    vector_store = VectorStore(Path(settings.chroma_path))
    embedder = _make_embedder()
    return Runtime(
        chunker=TextChunker(),
        loader=DocumentLoader(),
        vector_store=vector_store,
        retriever=Retriever(embedder=embedder, vector_store=vector_store),
        generator=Generator(settings.ollama_base_url),
        audit=AuditLogger(Path(settings.audit_log_path)),
    )
