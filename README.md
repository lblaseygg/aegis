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
- imports the bundled default model store if one was included at build time
- exposes any optional bundled model packs for later install

Build commands:

```bash
npm run build:macos-app
npm run build:macos-pkg
```

For the full packaging inputs and signing environment variables, see [macOS installer guide](/Users/blasey/Developer/aegis/docs/macos-installer.md).

## Runtime Modes

Aegis supports three runtime modes:

- `local`: use a host-installed Ollama on the same machine, plus the local RAG API
- `remote`: connect to an already-running Ollama and RAG API elsewhere on a private network or through an SSH tunnel
- `docker`: run the full local stack inside Docker

Check or switch the mode:

```bash
aegis runtime status
aegis runtime use local
aegis runtime use remote
aegis runtime use docker
```

When a host Ollama install is detected, `aegis init` now prefers `local` automatically.

### Host Ollama

For same-machine installs, the recommended setup is:

1. Install Ollama natively on the host
2. Pull a local model into the host Ollama runtime
3. Use `aegis up` to start only the RAG API container

Example:

```bash
ollama pull gemma3:4b
aegis runtime use local
aegis up
aegis doctor
```

In local mode on macOS, `aegis doctor` reports `Acceleration: Metal (host Ollama)`.

### Remote Ollama And RAG

For a private-network or SSH-tunneled setup, point Aegis at the remote endpoints and switch to `remote` mode:

```bash
aegis runtime use remote
OLLAMA_BASE_URL=http://127.0.0.1:11435 \
RAG_API_BASE_URL=http://127.0.0.1:18088 \
aegis doctor
```

In remote mode, `aegis up` does not start local services. It expects the model server and RAG API to already be reachable.

## Chat Modes

Bare `aegis` now opens the interactive chat UI. It supports two modes:

- `docs`: grounded document QA over ingested content
- `code`: local codebase assistant mode for the current working directory

Useful slash commands inside chat:

```text
/mode docs
/mode code
/auto
/manual qwen3:8b
/model qwen3:8b
/collection default
/review
/review off
/cwd /path/to/project
/files
/resume
/clear
```

Model routing supports two behaviors:

- `manual`: always use the selected manual model
- `auto`: choose a model per prompt from the configured profiles

`/model <name>` updates the manual fallback model. It does not disable auto routing. Use `/manual` when you explicitly want to pin future prompts to one model.

The default profiles are:

- `fast_general`: `phi4-mini`
- `long_running`: `qwen3:8b`
- `coding_optimized`: `qwen2.5-coder:7b`
- `coding_fast`: `qwen2.5-coder:3b`
- `coding_strong`: `qwen2.5-coder:7b`

If a preferred profile model is not installed, Aegis falls back to the manual model or the first available Ollama model.

To install and select a same-machine Ollama model:

```bash
ollama pull gemma3:4b
aegis models select gemma3:4b
```

If the macOS package ships the optional 12B pack, you can install it later with:

```bash
aegis models packs
aegis models install-pack gemma3-12b --select gemma3:12b
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

For remote/tunneled setups, these can instead point at local forwarded ports such as `11435` and `18088`.
