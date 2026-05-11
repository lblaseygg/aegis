#!/usr/bin/env bash
set -euo pipefail

aegis_support_dir() {
  printf '%s/Library/Application Support/Aegis\n' "$HOME"
}

aegis_path_snippet() {
  cat <<'EOF'
# Added by Aegis
export PATH="$HOME/Library/Application Support/Aegis/bin:$PATH"
EOF
}

ensure_file_contains() {
  local file="$1"
  local snippet="$2"

  mkdir -p "$(dirname "$file")"
  touch "$file"
  if ! grep -Fq "$snippet" "$file"; then
    printf '\n%s\n' "$snippet" >>"$file"
  fi
}

install_path_snippet() {
  local snippet
  snippet="$(aegis_path_snippet)"
  ensure_file_contains "${HOME}/.zprofile" "$snippet"
  ensure_file_contains "${HOME}/.zshrc" "$snippet"
}

render_template() {
  local template="$1"
  local output="$2"
  shift 2

  local rendered
  rendered="$(cat "$template")"
  while (($#)); do
    local key="$1"
    local value="$2"
    shift 2
    rendered="${rendered//${key}/${value}}"
  done

  printf '%s' "$rendered" >"$output"
}

bootstrap_launch_agent() {
  local plist="$1"
  local label="$2"

  launchctl bootout "gui/${UID}" "${plist}" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/${UID}" "${plist}"
  launchctl kickstart -k "gui/${UID}/${label}" >/dev/null 2>&1 || true
}

wait_for_url() {
  local url="$1"
  local attempts="${2:-40}"
  local sleep_seconds="${3:-1}"

  for ((i = 1; i <= attempts; i += 1)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi

    sleep "$sleep_seconds"
  done

  return 1
}
