import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { endOfDay, isAfter, isBefore, parseISO, startOfDay } from "date-fns";

import type { AuditEvent } from "../types/audit.js";
import { DEFAULT_AUDIT_LOG_PATH } from "../lib/constants.js";

export class AuditClient {
  constructor(private readonly auditPath = DEFAULT_AUDIT_LOG_PATH) {}

  async readAll(): Promise<AuditEvent[]> {
    try {
      const raw = await readFile(this.auditPath, "utf8");
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as AuditEvent);
    } catch {
      return [];
    }
  }

  async tail(limit = 20): Promise<AuditEvent[]> {
    const events = await this.readAll();
    return events.slice(-limit);
  }

  async exportRange(from: string, to: string, outputDir: string): Promise<string> {
    const events = await this.readAll();
    const fromDate = normalizeRangeBoundary(from, "start");
    const toDate = normalizeRangeBoundary(to, "end");
    const filtered = events.filter((event) => {
      const timestamp = parseISO(event.timestamp);
      return !isBefore(timestamp, fromDate) && !isAfter(timestamp, toDate);
    });

    await mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `audit-export-${from}-to-${to}.json`);
    await writeFile(outputPath, JSON.stringify(filtered, null, 2), "utf8");
    return outputPath;
  }
}

function normalizeRangeBoundary(value: string, side: "start" | "end"): Date {
  const parsed = parseISO(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return side === "start" ? startOfDay(parsed) : endOfDay(parsed);
  }

  return parsed;
}
