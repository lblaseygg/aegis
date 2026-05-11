import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

import { execa } from "execa";

import { ROOT_DIR } from "../lib/constants.js";

export async function runBundleCreate(): Promise<void> {
  await execa(path.join(ROOT_DIR, "scripts/build-online-bundle.sh"), { cwd: ROOT_DIR, stdio: "inherit" });
}

export async function runBundleVerify(bundlePath: string): Promise<void> {
  const details = await stat(bundlePath);
  if (details.isDirectory()) {
    await execa(path.join(ROOT_DIR, "scripts/verify-bundle.sh"), [bundlePath], { cwd: ROOT_DIR, stdio: "inherit" });
    return;
  }

  const digest = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(bundlePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });

  console.log(`sha256 ${digest.digest("hex")}  ${bundlePath}`);
}
