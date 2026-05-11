from app.services.retriever import Retriever
from app.services.vector_store import StoredChunk


class FakeEmbedder:
    def embed(self, text: str) -> list[float]:
        return [0.1, 0.2]


class FakeVectorStore:
    def chunk_count(self, name: str) -> int:
        return 2

    def query(self, collection_name: str, embedding: list[float], top_k: int) -> list[StoredChunk]:
        return [
            StoredChunk(
                text="Operators should run aegis doctor before starting a new ingestion batch.",
                metadata={"file_name": "operator-handbook.txt", "chunk_index": 0, "source_path": "/tmp/1"},
                score=0.92,
            ),
            StoredChunk(
                text="Backups are verified weekly and encrypted before leaving the primary workstation.",
                metadata={"file_name": "security-policy.md", "chunk_index": 0, "source_path": "/tmp/2"},
                score=0.76,
            ),
        ]


def test_retriever_reranks_by_lexical_match() -> None:
    retriever = Retriever(embedder=FakeEmbedder(), vector_store=FakeVectorStore())  # type: ignore[arg-type]
    matches = retriever.query("default", "What is the backup policy?", 2)
    assert matches[0].metadata["file_name"] == "security-policy.md"
