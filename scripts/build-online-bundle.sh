#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_DIR="${ROOT_DIR}/bundle"
ARCHIVE_PATH="${ROOT_DIR}/aegis-airgap-bundle.tar.gz"
ALLOW_PARTIAL="${AEGIS_ALLOW_PARTIAL_BUNDLE:-0}"

log() {
  printf '[bundle] %s\n' "$1"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

copy_tree() {
  local src="$1"
  local dest="$2"
  if [[ -d "$src" ]]; then
    mkdir -p "$dest"
    cp -R "$src"/. "$dest"
  else
    mkdir -p "$(dirname "$dest")"
    cp -R "$src" "$dest"
  fi
}

prepare_layout() {
  rm -rf "$BUNDLE_DIR"
  mkdir -p \
    "$BUNDLE_DIR/docker/images" \
    "$BUNDLE_DIR/models" \
    "$BUNDLE_DIR/wheels" \
    "$BUNDLE_DIR/npm" \
    "$BUNDLE_DIR/checksums" \
    "$BUNDLE_DIR/scripts" \
    "$BUNDLE_DIR/docs"
}

export_image() {
  local image_ref="$1"
  local output_name="$2"

  if docker image inspect "$image_ref" >/dev/null 2>&1; then
    docker save -o "$BUNDLE_DIR/docker/images/${output_name}.tar" "$image_ref"
    log "exported image ${image_ref}"
  elif [[ "$ALLOW_PARTIAL" == "1" ]]; then
    log "skipping missing image ${image_ref}"
  else
    echo "Required Docker image is missing: ${image_ref}" >&2
    exit 1
  fi
}

write_manifest() {
  cat >"$BUNDLE_DIR/checksums/manifest.json" <<JSON
{
  "name": "aegis-airgap-bundle",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "partial_bundle": $([[ "$ALLOW_PARTIAL" == "1" ]] && echo "true" || echo "false"),
  "contents": {
    "docker_compose": "docker/docker-compose.yml",
    "images_dir": "docker/images",
    "models_dir": "models",
    "wheels_dir": "wheels",
    "npm_dir": "npm"
  }
}
JSON
}

generate_checksums() {
  (
    cd "$BUNDLE_DIR"
    find . -type f ! -path './checksums/SHA256SUMS' -print0 | sort -z | xargs -0 shasum -a 256 > checksums/SHA256SUMS
  )
}

build_archive() {
  rm -f "$ARCHIVE_PATH"
  tar -C "$ROOT_DIR" -czf "$ARCHIVE_PATH" bundle
}

main() {
  require_cmd docker
  require_cmd shasum
  prepare_layout

  copy_tree "$ROOT_DIR/docker-compose.yml" "$BUNDLE_DIR/docker/docker-compose.yml"
  copy_tree "$ROOT_DIR/config" "$BUNDLE_DIR/config"
  copy_tree "$ROOT_DIR/docs" "$BUNDLE_DIR/docs"
  copy_tree "$ROOT_DIR/scripts/verify-bundle.sh" "$BUNDLE_DIR/scripts/verify-bundle.sh"
  copy_tree "$ROOT_DIR/scripts/load-docker-images.sh" "$BUNDLE_DIR/scripts/load-docker-images.sh"
  copy_tree "$ROOT_DIR/scripts/install-offline.sh" "$BUNDLE_DIR/scripts/install-offline.sh"

  if [[ -d "$ROOT_DIR/models" ]]; then
    copy_tree "$ROOT_DIR/models/embeddings" "$BUNDLE_DIR/models/embeddings"
  fi

  if [[ -d "$ROOT_DIR/data/ollama" ]]; then
    tar -C "$ROOT_DIR/data" -czf "$BUNDLE_DIR/models/ollama-model-store.tar.gz" ollama
  elif [[ "$ALLOW_PARTIAL" != "1" ]]; then
    echo "Missing Ollama model store under $ROOT_DIR/data/ollama" >&2
    exit 1
  fi

  export_image "ollama/ollama:0.6.8" "ollama"
  export_image "aegis-rag-api:latest" "aegis-rag-api"
  export_image "aegis-cli:latest" "aegis-cli"

  write_manifest
  generate_checksums
  build_archive
  log "created $ARCHIVE_PATH"
}

main "$@"
