#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "aegis" ]; then
  shift
fi

exec node /app/apps/cli/dist/index.js "$@"
