import { formatTimestamp } from "../lib/formatters.js";
import { AuditClient } from "../services/auditClient.js";

export async function runLogsTail(limit: number): Promise<void> {
  const events = await new AuditClient().tail(limit);
  for (const event of events) {
    console.log(`${formatTimestamp(event.timestamp)} ${event.action} ${event.status}`);
  }
}
