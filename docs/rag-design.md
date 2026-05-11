# RAG Design

The RAG service ingests local documents, chunks them, embeds them, stores them in ChromaDB-compatible persistence, and answers queries with citations. The initial implementation supports a deterministic hash embedding fallback so the stack can run without downloading an embedding model.
