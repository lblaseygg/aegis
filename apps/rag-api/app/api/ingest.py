from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from app.models.requests import IngestRequest
from app.models.responses import IngestResponse
from app.utils.hashing import sha256_file, sha256_text
from app.utils.redaction import scrub_error

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_documents(payload: IngestRequest, request: Request) -> IngestResponse:
    runtime = request.app.state.runtime
    source_root = Path(payload.path).expanduser().resolve()
    if not source_root.exists():
        raise HTTPException(status_code=404, detail=f"Path does not exist: {source_root}")

    request_id = runtime.new_request_id()
    runtime.audit.write("rag.ingest.started", "success", request_id, {"path": str(source_root), "collection": payload.collection})

    registry = runtime.vector_store.load_registry()
    parsed = skipped = failed = chunks_written = 0
    errors: list[str] = []

    for path in runtime.loader.iter_paths(source_root, recursive=payload.recursive):
        source_path = str(path.resolve())
        try:
            document_hash = sha256_file(path)
            existing = registry.get(source_path)
            if existing and existing.get("document_id") == document_hash:
                skipped += 1
                runtime.audit.write(
                    "document.skipped",
                    "success",
                    request_id,
                    {"source_path": source_path, "document_id": document_hash},
                )
                continue

            loaded = runtime.loader.load(path)
            chunks = runtime.chunker.split(loaded.text)
            if not chunks:
                skipped += 1
                continue

            now = datetime.now(UTC).isoformat()
            chunk_texts = [chunk.text for chunk in chunks]
            embeddings = [runtime.retriever.embedder.embed(chunk.text) for chunk in chunks]
            metadatas = [
                {
                    "document_id": document_hash,
                    "source_path": source_path,
                    "file_name": loaded.file_name,
                    "file_type": loaded.file_type,
                    "chunk_index": chunk.chunk_index,
                    "created_at": now,
                    "content_hash": sha256_text(chunk.text),
                }
                for chunk in chunks
            ]

            written = runtime.vector_store.upsert_chunks(
                collection_name=payload.collection,
                source_path=source_path,
                chunks=chunk_texts,
                embeddings=embeddings,
                metadatas=metadatas,
            )
            registry[source_path] = {"document_id": document_hash, "updated_at": now}
            runtime.vector_store.save_registry(registry)

            parsed += 1
            chunks_written += written
            runtime.audit.write(
                "document.ingested",
                "success",
                request_id,
                {"source_path": source_path, "document_id": document_hash, "chunks": written},
            )
        except Exception as error:  # noqa: BLE001
            failed += 1
            message = f"{source_path}: {scrub_error(str(error))}"
            errors.append(message)
            runtime.audit.write("document.ingested", "error", request_id, {"source_path": source_path, "error": message})

    runtime.audit.write(
        "rag.ingest.completed",
        "success" if failed == 0 else "partial",
        request_id,
        {"parsed": parsed, "skipped": skipped, "failed": failed, "chunks": chunks_written},
    )
    return IngestResponse(
        collection=payload.collection,
        parsed=parsed,
        skipped=skipped,
        failed=failed,
        chunks=chunks_written,
        errors=errors,
    )
