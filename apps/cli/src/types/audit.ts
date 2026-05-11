export interface AuditEvent {
  event_id: string;
  timestamp: string;
  actor: string;
  action: string;
  status: string;
  request_id?: string | null;
  metadata: Record<string, unknown>;
}
