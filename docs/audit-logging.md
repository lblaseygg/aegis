# Audit Logging

Audit events are stored as append-only JSONL records under `./data/audit`.

Event families:

- command lifecycle
- model selection
- document ingestion
- retrieval and query generation
- bundle verification and export
- error events
