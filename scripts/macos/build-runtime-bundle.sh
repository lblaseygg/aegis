#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build/macos"
APP_BUNDLE="${BUILD_DIR}/Aegis.app"
STAGING_DIR="${BUILD_DIR}/runtime-bundle"
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")"
ARCHIVE_NAME="Aegis-runtime-darwin-$(uname -m)-${VERSION}.tar.gz"
ARCHIVE_PATH="${BUILD_DIR}/${ARCHIVE_NAME}"

bash "${ROOT_DIR}/scripts/macos/build-installer.sh" --app

rm -rf "${STAGING_DIR}"
mkdir -p "${STAGING_DIR}"

rsync -a "${APP_BUNDLE}/Contents/Resources/payload/" "${STAGING_DIR}/"
cp "${APP_BUNDLE}/Contents/Resources/VERSION" "${STAGING_DIR}/VERSION"
cp "${APP_BUNDLE}/Contents/Resources/bootstrap.sh" "${STAGING_DIR}/bootstrap.sh"
mkdir -p "${STAGING_DIR}/lib"
cp "${APP_BUNDLE}/Contents/Resources/lib/common.sh" "${STAGING_DIR}/lib/common.sh"
mkdir -p "${STAGING_DIR}/launch-agents"
cp "${APP_BUNDLE}/Contents/Resources/launch-agents/"*.plist.template "${STAGING_DIR}/launch-agents/"

tar -C "${STAGING_DIR}" -czf "${ARCHIVE_PATH}" .
printf 'Built runtime bundle at %s\n' "${ARCHIVE_PATH}"
