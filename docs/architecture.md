# Aegis Architecture

Aegis is an offline-first operator tool for local LLM deployment and retrieval-augmented generation.

## Runtime shape

- `apps/cli`: Ink + TypeScript CLI/TUI for operators.
- `apps/rag-api`: FastAPI service for ingestion, retrieval, and grounded generation.
- `docker-compose.yml`: local orchestration for Ollama, the RAG API, and the CLI container profile.
- `scripts/`: bundle build, verification, offline install, and smoke-test helpers.

## Design constraints

- No internet requirement at runtime.
- Local-only service bindings by default.
- Append-only JSONL audit logging.
- Persistent RAG state under `./data`.
