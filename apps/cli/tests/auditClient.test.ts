import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { AuditClient } from "../src/services/auditClient.js";

describe("AuditClient", () => {
  test("exports same-day records for date-only ranges", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aegis-audit-"));
    const auditPath = path.join(tempDir, "audit.jsonl");
    await writeFile(
      auditPath,
      [
        JSON.stringify({
          event_id: "evt_1",
          timestamp: "2026-05-11T16:58:59Z",
          actor: "local-user",
          action: "answer.generated",
          status: "success",
          metadata: {},
        }),
      ].join("\n"),
      "utf8",
    );

    const client = new AuditClient(auditPath);
    const output = await client.exportRange("2026-05-11", "2026-05-11", tempDir);
    const exported = JSON.parse(await readFile(output, "utf8")) as Array<{ event_id: string }>;
    expect(exported).toHaveLength(1);
    expect(exported[0]?.event_id).toBe("evt_1");
  });
});
