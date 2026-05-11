#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE_PATH="${1:-${ROOT_DIR}/bundle/models/ollama-model-store.tar.gz}"

mkdir -p "${ROOT_DIR}/data"
tar -C "${ROOT_DIR}/data" -xzf "$ARCHIVE_PATH"
printf 'Imported Ollama model store from %s\n' "$ARCHIVE_PATH"
