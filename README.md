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

## Quickstart

1. `npm install`
2. `python3 -m venv .venv`
3. `.venv/bin/pip install -e './apps/rag-api[dev]'`
4. `npm run build`
5. `node apps/cli/dist/index.js init`
6. `node apps/cli/dist/index.js doctor`

## Install The `aegis` Command

To make `aegis` available directly in your terminal:

```bash
npm run install:cli
aegis --help
```

## Air-gap bundle flow

- `node apps/cli/dist/index.js bundle create`
- `./scripts/verify-bundle.sh ./bundle`
- `./scripts/load-docker-images.sh ./bundle`
- `./scripts/install-offline.sh ./runtime`

## Local targets

- Ollama: `http://127.0.0.1:11434`
- RAG API: `http://127.0.0.1:8088`
