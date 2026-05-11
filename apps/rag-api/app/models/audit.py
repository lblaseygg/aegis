from __future__ import annotations

from pydantic import BaseModel, Field


class AuditEvent(BaseModel):
    event_id: str
    timestamp: str
    actor: str = "local-user"
    action: str
    status: str
    request_id: str | None = None
    metadata: dict[str, object] = Field(default_factory=dict)
