# Aegis CLI

Aegis is an offline-first local LLM operations toolkit built around an Ink terminal UI, a FastAPI RAG service, Ollama, and audit-first packaging for air-gapped environments.

## Status

The repository is structured as a greenfield MVP that tracks the build plan in [plan.md](/Users/blasey/Developer/aegis/plan.md).

## Layout

- `apps/cli`: Ink + TypeScript operator CLI
- `apps/rag-api`: FastAPI RAG service
- `config/`: default runtime and security settings
- `scripts/`: bundle, verify, install, and smoke-test utilities
- `docs/`: operator, security, architecture, and air-gap documentation

## Local targets

- Ollama: `http://127.0.0.1:11434`
- RAG API: `http://127.0.0.1:8088`
