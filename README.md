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
aegis
```

## macOS Package

The repo now includes a macOS packaging pipeline that builds:

- `Aegis.app`
- `Aegis.pkg`

The package is designed for the user flow:

1. install Aegis
2. open Terminal
3. run `aegis`

On first launch, Aegis bootstraps its embedded runtimes and support files under:

`~/Library/Application Support/Aegis`

That first-run setup:

- installs the embedded CLI, RAG API, Python runtime, and bundled native Ollama runtime
- starts Ollama and the RAG API as user launch agents
- writes an Aegis shell PATH entry for future sessions
- imports an optional bundled model store

Build commands:

```bash
npm run build:macos-app
npm run build:macos-pkg
```

For the full packaging inputs and signing environment variables, see [macOS installer guide](/Users/blasey/Developer/aegis/docs/macos-installer.md).

## Runtime Modes

Aegis supports two local runtime modes:

- `native`: for macOS users running Ollama on the host with Metal acceleration
- `docker`: for users running the full local stack inside Docker

Check or switch the mode:

```bash
aegis runtime status
aegis runtime use native
aegis runtime use docker
```

For macOS users, `aegis init` now prefers `native` automatically when a native Ollama install is detected.

### macOS Native Ollama

On macOS, the recommended setup is:

1. Install Ollama natively on the host
2. Pull a local model into the host Ollama runtime
3. Use `aegis up` to start only the RAG API container

Example:

```bash
ollama pull llama3.2:3b
aegis runtime use native
aegis up
aegis doctor
```

In native mode, `aegis doctor` reports `Acceleration: Metal (native Ollama)`.

## Chat Modes

Bare `aegis` now opens the interactive chat UI. It supports two modes:

- `docs`: grounded document QA over ingested content
- `code`: local codebase assistant mode for the current working directory

Useful slash commands inside chat:

```text
/mode docs
/mode code
/model gemma:7b
/collection default
/review
/review off
/cwd /path/to/project
/files
/resume
/clear
```

To install and select Gemma locally:

```bash
ollama pull llama3.2:3b
aegis models select llama3.2:3b
```

Longer local generations can be tuned with `AEGIS_QUERY_TIMEOUT_MS`, `AEGIS_OLLAMA_GENERATE_TIMEOUT_MS`, `AEGIS_OLLAMA_NUM_PREDICT`, `AEGIS_OLLAMA_NUM_CTX`, `OLLAMA_GENERATE_TIMEOUT_SECONDS`, `OLLAMA_NUM_PREDICT`, or `OLLAMA_NUM_CTX`.

## Air-gap bundle flow

- `node apps/cli/dist/index.js bundle create`
- `./scripts/verify-bundle.sh ./bundle`
- `./scripts/load-docker-images.sh ./bundle`
- `./scripts/install-offline.sh ./runtime`

## Docker CLI Usage

Start the backing services:

```bash
aegis runtime use docker
aegis up
```

Run the CLI container:

```bash
docker compose run --rm cli doctor
docker compose run --rm cli rag ingest /data/documents
docker compose run --rm cli rag query "What is the backup policy?"
docker compose run --rm cli chat
```

The container entrypoint also accepts `docker compose run --rm cli aegis ...` if that is more natural for the operator.

## Local targets

- Ollama: `http://127.0.0.1:11434`
- RAG API: `http://127.0.0.1:8088`
