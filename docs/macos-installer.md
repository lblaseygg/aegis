# macOS Installer

This repository can now build a macOS-first Aegis distribution that installs:

- `/Applications/Aegis.app`
- `/usr/local/bin/aegis`

The app bundle includes:

- the Aegis CLI/TUI distribution
- an embedded Node runtime
- the FastAPI RAG API source
- an embedded Python runtime plus bundled site-packages
- a bundled native `Ollama.app`
- a package-specific default config template
- an optional bundled Ollama model store archive

## First Run

The first `aegis` invocation bootstraps user-local support files under:

`~/Library/Application Support/Aegis`

That bootstrap step:

- copies the embedded runtimes into the support directory
- installs the default config if one does not exist
- installs a user PATH snippet for `~/Library/Application Support/Aegis/bin`
- creates and loads launch agents for Ollama and the RAG API
- imports a bundled model store if one is present
- waits for both services to become ready

After that, the user flow is:

1. Install the package
2. Open Terminal
3. Run `aegis`

## Build Inputs

The build expects:

- a compiled CLI distribution
- a populated `.venv` with the RAG API dependencies installed
- a native `Ollama.app` available at `/Applications/Ollama.app` or via `AEGIS_OLLAMA_APP_SOURCE`

Optional:

- `AEGIS_BUNDLED_MODEL_STORE`
  Path to a tarball produced by [export-ollama-models.sh](/Users/blasey/Developer/aegis/scripts/export-ollama-models.sh)
- `AEGIS_CODESIGN_IDENTITY`
  Developer ID identity for signing `Aegis.app`
- `AEGIS_INSTALLER_SIGN_IDENTITY`
  Developer ID Installer identity for signing `Aegis.pkg`

## Build Commands

Build the unsigned app bundle:

```bash
npm run build:macos-app
```

Build the unsigned installer package:

```bash
npm run build:macos-pkg
```

Build the runtime bundle used by the npm bootstrap flow:

```bash
npm run build:runtime-bundle
```

That produces a tarball under `build/macos/` containing:

- `runtime/`
- `templates/default-config.yaml`
- `launch-agents/*.plist.template`
- `VERSION`
- optional `models/default-model-store.tar.gz`

The published `aegis` npm package can use that artifact on first run when either:

- `AEGIS_BOOTSTRAP_BUNDLE_PATH` points to a local copy, or
- `AEGIS_BOOTSTRAP_BUNDLE_URL` points to a hosted release asset

Example signed build:

```bash
AEGIS_OLLAMA_APP_SOURCE="/Applications/Ollama.app" \
AEGIS_BUNDLED_MODEL_STORE="/absolute/path/ollama-model-store.tar.gz" \
AEGIS_CODESIGN_IDENTITY="Developer ID Application: Example Corp (TEAMID)" \
AEGIS_INSTALLER_SIGN_IDENTITY="Developer ID Installer: Example Corp (TEAMID)" \
npm run build:macos-pkg
```

Artifacts are written under `build/macos/`.
