#!/usr/bin/env bash
set -euo pipefail

BUNDLE_DIR="${1:-$(pwd)}"
IMAGE_DIR="${BUNDLE_DIR}/docker/images"

if [[ ! -d "$IMAGE_DIR" ]]; then
  echo "Missing image directory: $IMAGE_DIR" >&2
  exit 1
fi

shopt -s nullglob
for archive in "$IMAGE_DIR"/*.tar; do
  printf '[docker-load] %s\n' "$(basename "$archive")"
  docker load -i "$archive"
done
