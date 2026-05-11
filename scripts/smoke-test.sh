#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node "$ROOT_DIR/apps/cli/dist/index.js" doctor
node "$ROOT_DIR/apps/cli/dist/index.js" rag query "What is the backup policy?"
