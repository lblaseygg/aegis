#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-$(pwd)/runtime}"

mkdir -p \
  "$TARGET_DIR/data/audit" \
  "$TARGET_DIR/data/backups" \
  "$TARGET_DIR/data/chroma" \
  "$TARGET_DIR/data/config" \
  "$TARGET_DIR/data/documents" \
  "$TARGET_DIR/data/ollama"

printf 'Prepared offline runtime directories under %s\n' "$TARGET_DIR"
printf 'Next steps:\n'
printf '  1. ./scripts/verify-bundle.sh\n'
printf '  2. ./scripts/load-docker-images.sh\n'
printf '  3. docker compose up -d\n'
