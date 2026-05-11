#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

APP_ROOT=""
SUPPORT_DIR="$(aegis_support_dir)"

while (($#)); do
  case "$1" in
    --app-root)
      APP_ROOT="$2"
      shift 2
      ;;
    --support-dir)
      SUPPORT_DIR="$2"
      shift 2
      ;;
    *)
      printf 'Unknown bootstrap argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${APP_ROOT}" ]]; then
  printf 'Bootstrap requires --app-root\n' >&2
  exit 1
fi

RESOURCES_DIR="${APP_ROOT}/Resources"
PAYLOAD_DIR="${RESOURCES_DIR}/payload"
VERSION="$(cat "${RESOURCES_DIR}/VERSION")"
LAUNCHD_DIR="${SUPPORT_DIR}/launchd"
LOG_DIR="${SUPPORT_DIR}/logs"
DATA_DIR="${SUPPORT_DIR}/data"
RUNTIME_DIR="${SUPPORT_DIR}/runtime"
CONFIG_PATH="${DATA_DIR}/config/config.yaml"
PATH_WRAPPER="${SUPPORT_DIR}/bin/aegis"
APP_EXECUTABLE="${APP_ROOT}/MacOS/aegis"

printf 'Aegis first-run setup\n'
printf 'Version: %s\n' "${VERSION}"
printf 'Install root: %s\n' "${SUPPORT_DIR}"

mkdir -p \
  "${SUPPORT_DIR}/bin" \
  "${LAUNCHD_DIR}" \
  "${LOG_DIR}" \
  "${DATA_DIR}/audit" \
  "${DATA_DIR}/chroma" \
  "${DATA_DIR}/config" \
  "${DATA_DIR}/documents" \
  "${DATA_DIR}/ollama" \
  "${DATA_DIR}/ollama/home" \
  "${RUNTIME_DIR}"

printf 'Installing embedded runtimes and services...\n'
rsync -a --delete "${PAYLOAD_DIR}/runtime/" "${RUNTIME_DIR}/"

if [[ -d "${PAYLOAD_DIR}/models" ]]; then
  mkdir -p "${SUPPORT_DIR}/models"
  rsync -a --delete "${PAYLOAD_DIR}/models/" "${SUPPORT_DIR}/models/"
fi

if [[ ! -f "${CONFIG_PATH}" ]]; then
  cp "${PAYLOAD_DIR}/templates/default-config.yaml" "${CONFIG_PATH}"
fi

cat >"${PATH_WRAPPER}" <<EOF
#!/usr/bin/env bash
exec "${APP_EXECUTABLE}" "\$@"
EOF
chmod +x "${PATH_WRAPPER}"
install_path_snippet

if [[ -f "${SUPPORT_DIR}/models/default-model-store.tar.gz" ]] && [[ ! -d "${DATA_DIR}/ollama/models" ]]; then
  printf 'Importing bundled model store...\n'
  tar -C "${DATA_DIR}" -xzf "${SUPPORT_DIR}/models/default-model-store.tar.gz"
fi

printf 'Configuring local background services...\n'
render_template \
  "${RESOURCES_DIR}/launch-agents/com.aegis.ollama.plist.template" \
  "${LAUNCHD_DIR}/com.aegis.ollama.plist" \
  "__SUPPORT_DIR__" "${SUPPORT_DIR}" \
  "__OLLAMA_BIN__" "${RUNTIME_DIR}/ollama/Ollama.app/Contents/MacOS/Ollama" \
  "__OLLAMA_HOME__" "${DATA_DIR}/ollama/home" \
  "__OLLAMA_MODELS__" "${DATA_DIR}/ollama/models" \
  "__LOG_DIR__" "${LOG_DIR}"

render_template \
  "${RESOURCES_DIR}/launch-agents/com.aegis.rag-api.plist.template" \
  "${LAUNCHD_DIR}/com.aegis.rag-api.plist" \
  "__SUPPORT_DIR__" "${SUPPORT_DIR}" \
  "__PYTHON_BIN__" "${RUNTIME_DIR}/python/bin/python3" \
  "__PYTHONPATH__" "${RUNTIME_DIR}/python/site-packages:${RUNTIME_DIR}/rag-api" \
  "__LOG_DIR__" "${LOG_DIR}"

bootstrap_launch_agent "${LAUNCHD_DIR}/com.aegis.ollama.plist" "com.aegis.ollama"
bootstrap_launch_agent "${LAUNCHD_DIR}/com.aegis.rag-api.plist" "com.aegis.rag-api"

printf 'Waiting for Ollama...\n'
wait_for_url "http://127.0.0.1:11434/api/tags" 60 1 || {
  printf 'Embedded Ollama did not become ready.\n' >&2
  exit 1
}

printf 'Waiting for the RAG API...\n'
wait_for_url "http://127.0.0.1:8088/health" 60 1 || {
  printf 'Embedded RAG API did not become ready.\n' >&2
  exit 1
}

printf '%s\n' "${VERSION}" >"${SUPPORT_DIR}/.installed-version"
printf 'Setup complete. You can now run `aegis` from Terminal.\n'
