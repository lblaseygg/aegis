#!/usr/bin/env bash
set -euo pipefail

BUNDLE_DIR="${1:-$(pwd)}"
CHECKSUM_FILE="${BUNDLE_DIR}/checksums/SHA256SUMS"

if [[ ! -f "$CHECKSUM_FILE" ]]; then
  echo "Missing checksum file: $CHECKSUM_FILE" >&2
  exit 1
fi

(
  cd "$BUNDLE_DIR"
  shasum -a 256 -c checksums/SHA256SUMS
)
