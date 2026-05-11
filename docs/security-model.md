# Security Model

- Runtime defaults to `offline_mode: true`.
- Services bind to `127.0.0.1` on the host.
- Aegis blocks non-local URLs in CLI configuration validation.
- Prompt and response logging are disabled by default.
- Documents are tracked by hash so repeat ingestion can safely skip unchanged content.
