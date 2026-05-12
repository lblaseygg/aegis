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
- imports the bundled default model store if one is present
- copies any optional bundled model packs into the local support directory
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
  Path to the default bundled model-store tarball produced by [export-ollama-models.sh](/Users/blasey/Developer/aegis/scripts/export-ollama-models.sh). For the recommended default, this should contain `gemma3:4b`.
- `AEGIS_OPTIONAL_MODEL_PACKS`
  Comma-separated named optional pack archives in the format `name=/absolute/path/archive.tar.gz`. For example: `gemma3-12b=/absolute/path/gemma3-12b-model-store.tar.gz`
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

Example signed build:

```bash
AEGIS_OLLAMA_APP_SOURCE="/Applications/Ollama.app" \
AEGIS_BUNDLED_MODEL_STORE="/absolute/path/gemma3-4b-model-store.tar.gz" \
AEGIS_OPTIONAL_MODEL_PACKS="gemma3-12b=/absolute/path/gemma3-12b-model-store.tar.gz" \
AEGIS_CODESIGN_IDENTITY="Developer ID Application: Example Corp (TEAMID)" \
AEGIS_INSTALLER_SIGN_IDENTITY="Developer ID Installer: Example Corp (TEAMID)" \
npm run build:macos-pkg
```

## Model Strategy

The macOS package now assumes:

- `gemma3:4b` is the preinstalled default model
- `gemma3:12b` is shipped only as an optional model-pack archive

After install, operators can import optional packs with:

```bash
aegis models packs
aegis models install-pack gemma3-12b --select gemma3:12b
```

Artifacts are written under `build/macos/`.
