#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_PATH="${1:-${ROOT_DIR}/bundle/models/ollama-model-store.tar.gz}"

mkdir -p "$(dirname "$OUTPUT_PATH")"
tar -C "${ROOT_DIR}/data" -czf "$OUTPUT_PATH" ollama
printf 'Exported Ollama model store to %s\n' "$OUTPUT_PATH"
