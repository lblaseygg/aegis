import path from "node:path";

import { ROOT_DIR } from "../lib/constants.js";
import { AuditClient } from "../services/auditClient.js";

export async function runAuditExport(from: string, to: string): Promise<void> {
  const outputDir = path.join(ROOT_DIR, "data/audit/exports");
  const outputPath = await new AuditClient().exportRange(from, to, outputDir);
  console.log(outputPath);
}
