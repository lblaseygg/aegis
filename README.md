# Aegis CLI

Aegis is a private self-hosted local LLM operations toolkit built around an Ink terminal UI, a FastAPI RAG service, Ollama, and packaging flows for offline or isolated deployments.

## Layout

- `apps/cli`: Ink + TypeScript operator CLI
- `apps/rag-api`: FastAPI RAG service
- `config/`: default runtime and security settings
- `scripts/`: bundle, verify, install, and smoke-test utilities
- `docs/`: operator, security, architecture, and offline deployment documentation

## Recommended Client Install

For the current private self-hosted remote flow, the client install path is:

```bash
npm install
npm run build
npm run install:cli
aegis
```

That gives you the repo-linked CLI command. The recommended first-run flow after install is:

```bash
aegis remote connect
aegis
```

## Remote Server Setup

The primary self-hosted deployment model is:

- a thin Aegis client on the user machine
- Ollama and the RAG API on a private Linux server
- SSH tunnel transport between the client and the server

Typical server flow:

```bash
docker compose up -d ollama rag-api
docker exec -it aegis-ollama ollama pull qwen3:8b
docker exec -it aegis-ollama ollama pull phi4-mini
docker exec -it aegis-ollama ollama pull qwen2.5-coder:7b
docker exec -it aegis-ollama ollama pull qwen2.5-coder:3b
```

The bundled [docker-compose.yml](/Users/blasey/Developer/aegis/docker-compose.yml) config requests NVIDIA GPU access for the `ollama` service with `gpus: all` plus the standard `NVIDIA_VISIBLE_DEVICES` and `NVIDIA_DRIVER_CAPABILITIES` environment variables. This is intended for Linux hosts with the NVIDIA Container Toolkit installed. If GPU support is unavailable, the Ollama container will not get acceleration and should be treated as a CPU-only path.

### Client Remote Setup

Run the remote setup wizard on the client:

```bash
aegis remote connect
```

The wizard:

- validates the SSH host or alias
- checks that the chosen local forwarded ports are free
- writes a verified `remote` runtime config
- starts the tunnel once to verify Ollama and the RAG API are reachable

By default it builds the `ssh -L` forwards itself, so users do not have to hand-edit `LocalForward` entries. If you already maintain those in `~/.ssh/config`, you can opt into them during the wizard or pass `--use-ssh-config-forwards`.

After setup, the normal flow is just:

```bash
aegis doctor
aegis
```

## Runtime Modes

Aegis supports three runtime modes:

- `local`: use a host-installed Ollama on the same machine, plus the local RAG API
- `remote`: connect to an already-running Ollama and RAG API elsewhere on a private network or through an SSH tunnel
- `docker`: run the full local stack inside Docker, primarily for Linux/NVIDIA or CPU-only local deployments

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

### macOS Local Models

If a user keeps models on a Mac mini or another Mac, the recommended setup is to run Ollama natively on that Mac and let Ollama use Metal directly. Aegis then connects to that Ollama host:

- `local` mode when the CLI and Ollama are on the same Mac
- `remote` mode when the CLI is on a different machine and the Mac hosts Ollama

On macOS, Docker is not the intended acceleration path for Ollama itself. If you containerize `rag-api`, it should connect to the host Ollama instance rather than expecting the Ollama container to get Metal access.

## Chat Modes

Bare `aegis` now opens the interactive chat UI. It supports two modes:

- `docs`: grounded document QA over ingested content
- `code`: local codebase assistant mode for the current working directory

Useful slash commands inside chat:

```text
/mode docs
/mode code
/auto
/manual
/model
/collection
/review
/cwd
/files
/resume
/clear
```

Model routing supports two behaviors:

- `manual`: always use the selected manual model
- `auto`: choose a model per prompt from the configured profiles

`/model <name>` updates the manual fallback model. It does not disable auto routing. Use `/manual` when you explicitly want to pin future prompts to one model.

Inside chat, file mentions from the current workspace are also supported. Type `@` followed by a filename prefix, then select the file suggestion:

```text
Explain @README.md
Review @src/index.ts
Improve docs in @worker/worker/cli.py
```

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

## Docker CLI Usage

Run the CLI container directly if you want everything inside Compose:

```bash
docker compose run --rm cli doctor
docker compose run --rm cli rag ingest /data/documents
docker compose run --rm cli rag query "What is the backup policy?"
docker compose run --rm cli chat
```

The container entrypoint also accepts `docker compose run --rm cli aegis ...` if that is more natural for the operator.

## Optional macOS Package

The repo also includes a macOS packaging pipeline that builds:

- `Aegis.app`
- `Aegis.pkg`

This is an optional distribution path for single-machine or macOS-managed installs. For the packaging inputs and signing environment variables, see [macOS installer guide](/Users/blasey/Developer/aegis/docs/macos-installer.md).

## Offline Bundle Flow

- `node apps/cli/dist/index.js bundle create`
- `./scripts/verify-bundle.sh ./bundle`
- `./scripts/load-docker-images.sh ./bundle`
- `./scripts/install-offline.sh ./runtime`

## Local targets

- Ollama: `http://127.0.0.1:11434`
- RAG API: `http://127.0.0.1:8088`

For remote/tunneled setups, these can instead point at local forwarded ports such as `11435` and `18088`.
