from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import chromadb

from app.utils.hashing import sha256_text


@dataclass(slots=True)
class StoredChunk:
    text: str
    metadata: dict[str, Any]
    score: float


class VectorStore:
    def __init__(self, base_path: Path) -> None:
        base_path.mkdir(parents=True, exist_ok=True)
        self.base_path = base_path
        self.registry_path = base_path / "document-registry.json"
        self.client = chromadb.PersistentClient(path=str(base_path))

    def get_collection(self, name: str):
        return self.client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})

    def collection_names(self) -> list[str]:
        return [collection.name for collection in self.client.list_collections()]

    def chunk_count(self, name: str) -> int:
        return self.get_collection(name).count()

    def upsert_chunks(
        self,
        collection_name: str,
        source_path: str,
        chunks: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]],
    ) -> int:
        collection = self.get_collection(collection_name)
        self.delete_by_source_path(collection_name, source_path)

        ids = [sha256_text(f"{source_path}:{index}:{chunk}") for index, chunk in enumerate(chunks)]
        collection.add(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metadatas)
        return len(ids)

    def delete_by_source_path(self, collection_name: str, source_path: str) -> None:
        collection = self.get_collection(collection_name)
        matches = collection.get(where={"source_path": source_path}, include=[])
        ids = matches.get("ids", [])
        if ids:
            collection.delete(ids=ids)

    def query(self, collection_name: str, embedding: list[float], top_k: int) -> list[StoredChunk]:
        collection = self.get_collection(collection_name)
        results = collection.query(query_embeddings=[embedding], n_results=top_k)

        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        matches: list[StoredChunk] = []
        for document, metadata, distance in zip(documents, metadatas, distances, strict=False):
            score = max(0.0, 1.0 - float(distance))
            matches.append(StoredChunk(text=document, metadata=dict(metadata), score=score))
        return matches

    def load_registry(self) -> dict[str, dict[str, str]]:
        if not self.registry_path.exists():
            return {}
        return json.loads(self.registry_path.read_text(encoding="utf-8"))

    def save_registry(self, registry: dict[str, dict[str, str]]) -> None:
        self.registry_path.write_text(json.dumps(registry, indent=2, sort_keys=True), encoding="utf-8")
