#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build/macos"
APP_TEMPLATE_DIR="${ROOT_DIR}/packaging/macos/Aegis.app"
APP_BUNDLE="${BUILD_DIR}/Aegis.app"
PACKAGE_ROOT="${BUILD_DIR}/package-root"
PAYLOAD_DIR="${APP_BUNDLE}/Contents/Resources/payload"
COMPONENT_PKG="${BUILD_DIR}/Aegis-component.pkg"
FINAL_PKG="${BUILD_DIR}/Aegis.pkg"

BUILD_APP=true
BUILD_PKG=true

while (($#)); do
  case "$1" in
    --app)
      BUILD_APP=true
      BUILD_PKG=false
      shift
      ;;
    --pkg)
      BUILD_APP=true
      BUILD_PKG=true
      shift
      ;;
    *)
      printf 'Unknown build option: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command npm
require_command node
require_command python3
require_command rsync
require_command pkgbuild

if [[ "${BUILD_PKG}" == "true" ]]; then
  require_command productbuild
fi

VERSION="$(node -p "require('./package.json').version" 2>/dev/null || node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")"
NODE_BIN="$(node -p 'process.execPath')"
NODE_PREFIX="$(cd "$(dirname "${NODE_BIN}")/.." && pwd)"
PYTHON_PREFIX="$(python3 -c 'import sys; print(sys.base_prefix)')"
PYTHON_VERSION="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
SITE_PACKAGES_DIR="${ROOT_DIR}/.venv/lib/python${PYTHON_VERSION}/site-packages"
OLLAMA_APP_SOURCE="${AEGIS_OLLAMA_APP_SOURCE:-/Applications/Ollama.app}"
MODEL_STORE_ARCHIVE="${AEGIS_BUNDLED_MODEL_STORE:-}"
DEFAULT_MODEL="${AEGIS_DEFAULT_MODEL:-llama3.2:3b}"
APP_SIGN_IDENTITY="${AEGIS_CODESIGN_IDENTITY:-}"
PKG_SIGN_IDENTITY="${AEGIS_INSTALLER_SIGN_IDENTITY:-}"

if [[ ! -d "${OLLAMA_APP_SOURCE}" ]]; then
  printf 'Ollama.app source not found at %s\n' "${OLLAMA_APP_SOURCE}" >&2
  printf 'Set AEGIS_OLLAMA_APP_SOURCE to a native Ollama.app path before building the macOS installer.\n' >&2
  exit 1
fi

if [[ ! -d "${SITE_PACKAGES_DIR}" ]]; then
  printf 'Python site-packages not found at %s\n' "${SITE_PACKAGES_DIR}" >&2
  printf 'Install the rag-api dependencies into .venv before building.\n' >&2
  exit 1
fi

printf 'Building CLI distribution...\n'
(cd "${ROOT_DIR}" && npm run build)

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
rsync -a "${APP_TEMPLATE_DIR}/" "${APP_BUNDLE}/"
chmod +x "${APP_BUNDLE}/Contents/MacOS/aegis"

printf 'Staging embedded runtime payload...\n'
mkdir -p \
  "${PAYLOAD_DIR}/runtime/apps/cli" \
  "${PAYLOAD_DIR}/runtime/rag-api" \
  "${PAYLOAD_DIR}/runtime/ollama" \
  "${PAYLOAD_DIR}/runtime/python" \
  "${PAYLOAD_DIR}/templates" \
  "${APP_BUNDLE}/Contents/Resources/lib" \
  "${APP_BUNDLE}/Contents/Resources/launch-agents"

rsync -a "${ROOT_DIR}/apps/cli/dist/" "${PAYLOAD_DIR}/runtime/apps/cli/dist/"
cp "${ROOT_DIR}/apps/cli/package.json" "${PAYLOAD_DIR}/runtime/apps/cli/package.json"
rsync -a "${ROOT_DIR}/node_modules/" "${PAYLOAD_DIR}/runtime/node_modules/"
rsync -a "${NODE_PREFIX}/" "${PAYLOAD_DIR}/runtime/node/"
rsync -a "${ROOT_DIR}/apps/rag-api/app/" "${PAYLOAD_DIR}/runtime/rag-api/app/"
rsync -a "${PYTHON_PREFIX}/" "${PAYLOAD_DIR}/runtime/python/"
mkdir -p "${PAYLOAD_DIR}/runtime/python/site-packages"
rsync -a "${SITE_PACKAGES_DIR}/" "${PAYLOAD_DIR}/runtime/python/site-packages/"
rsync -a "${OLLAMA_APP_SOURCE}/" "${PAYLOAD_DIR}/runtime/ollama/Ollama.app/"
cp "${ROOT_DIR}/packaging/macos/default-config.yaml" "${PAYLOAD_DIR}/templates/default-config.yaml"
python3 - "${PAYLOAD_DIR}/templates/default-config.yaml" "${DEFAULT_MODEL}" <<'PY'
from pathlib import Path
import sys

config_path = Path(sys.argv[1])
model = sys.argv[2]
text = config_path.read_text()
config_path.write_text(text.replace("model: llama3.2:3b", f"model: {model}"))
PY
cp "${ROOT_DIR}/scripts/macos/bootstrap.sh" "${APP_BUNDLE}/Contents/Resources/bootstrap.sh"
cp "${ROOT_DIR}/scripts/macos/lib/common.sh" "${APP_BUNDLE}/Contents/Resources/lib/common.sh"
cp "${ROOT_DIR}/scripts/macos/launch-agents/com.aegis.ollama.plist.template" "${APP_BUNDLE}/Contents/Resources/launch-agents/com.aegis.ollama.plist.template"
cp "${ROOT_DIR}/scripts/macos/launch-agents/com.aegis.rag-api.plist.template" "${APP_BUNDLE}/Contents/Resources/launch-agents/com.aegis.rag-api.plist.template"
printf '%s\n' "${VERSION}" >"${APP_BUNDLE}/Contents/Resources/VERSION"
chmod +x "${APP_BUNDLE}/Contents/Resources/bootstrap.sh"

if [[ -n "${MODEL_STORE_ARCHIVE}" ]]; then
  mkdir -p "${PAYLOAD_DIR}/models"
  cp "${MODEL_STORE_ARCHIVE}" "${PAYLOAD_DIR}/models/default-model-store.tar.gz"
fi

/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${VERSION}" "${APP_BUNDLE}/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${VERSION}" "${APP_BUNDLE}/Contents/Info.plist"

if [[ -n "${APP_SIGN_IDENTITY}" ]]; then
  printf 'Codesigning Aegis.app with %s\n' "${APP_SIGN_IDENTITY}"
  codesign --deep --force --options runtime --sign "${APP_SIGN_IDENTITY}" "${APP_BUNDLE}"
fi

printf 'Built app bundle at %s\n' "${APP_BUNDLE}"

if [[ "${BUILD_PKG}" != "true" ]]; then
  exit 0
fi

printf 'Staging package payload...\n'
mkdir -p "${PACKAGE_ROOT}/Applications" "${PACKAGE_ROOT}/usr/local/bin"
rsync -a "${APP_BUNDLE}/" "${PACKAGE_ROOT}/Applications/Aegis.app/"
cat >"${PACKAGE_ROOT}/usr/local/bin/aegis" <<'EOF'
#!/usr/bin/env bash
exec "/Applications/Aegis.app/Contents/MacOS/aegis" "$@"
EOF
chmod +x "${PACKAGE_ROOT}/usr/local/bin/aegis"

pkgbuild \
  --root "${PACKAGE_ROOT}" \
  --identifier "com.aegis.installer" \
  --version "${VERSION}" \
  "${COMPONENT_PKG}"

if [[ -n "${PKG_SIGN_IDENTITY}" ]]; then
  productbuild \
    --sign "${PKG_SIGN_IDENTITY}" \
    --package "${COMPONENT_PKG}" \
    "${FINAL_PKG}"
else
  productbuild \
    --package "${COMPONENT_PKG}" \
    "${FINAL_PKG}"
fi

printf 'Built installer package at %s\n' "${FINAL_PKG}"
