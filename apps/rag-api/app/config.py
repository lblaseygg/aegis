from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class Settings:
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    chroma_path: Path = Path(os.getenv("CHROMA_PATH", "./data/chroma"))
    document_path: Path = Path(os.getenv("DOCUMENT_PATH", "./data/documents"))
    audit_log_path: Path = Path(os.getenv("AUDIT_LOG_PATH", "./data/audit/audit.jsonl"))
    offline_mode: bool = os.getenv("OFFLINE_MODE", "true").lower() == "true"
    embedding_provider: str = os.getenv("EMBEDDING_PROVIDER", "hash")


settings = Settings()
