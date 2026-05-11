from __future__ import annotations

import re

from dataclasses import replace

from app.services.embedder import Embedder
from app.services.vector_store import StoredChunk, VectorStore

STOPWORDS = {"a", "an", "and", "the", "is", "what", "does", "do", "of", "to", "about"}


class Retriever:
    def __init__(self, embedder: Embedder, vector_store: VectorStore) -> None:
        self.embedder = embedder
        self.vector_store = vector_store

    def query(self, collection: str, question: str, top_k: int) -> list[StoredChunk]:
        if self.vector_store.chunk_count(collection) == 0:
            return []
        embedding = self.embedder.embed(question)
        initial = self.vector_store.query(collection_name=collection, embedding=embedding, top_k=max(top_k * 2, 10))
        return self._rerank(question, initial)[:top_k]

    def _rerank(self, question: str, matches: list[StoredChunk]) -> list[StoredChunk]:
        question_terms = self._terms(question)

        def score(match: StoredChunk) -> float:
            chunk_terms = self._terms(match.text)
            file_terms = self._terms(str(match.metadata.get("file_name", "")))
            overlap = len(question_terms & chunk_terms)
            file_overlap = len(question_terms & file_terms)
            lexical = (overlap + (file_overlap * 0.5)) / max(len(question_terms), 1)
            return (match.score * 0.35) + (lexical * 0.65)

        rescored = [replace(match, score=round(score(match), 4)) for match in matches]
        return sorted(rescored, key=lambda match: match.score, reverse=True)

    def _terms(self, value: str) -> set[str]:
        terms = set()
        for token in re.findall(r"[a-z0-9]+", value.lower()):
            if token in STOPWORDS:
                continue
            terms.add(token[:-1] if token.endswith("s") and len(token) > 3 else token)
        return terms
