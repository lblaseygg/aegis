import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export async function runBundleVerify(bundlePath: string): Promise<void> {
  const digest = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(bundlePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });

  console.log(`sha256 ${digest.digest("hex")}  ${bundlePath}`);
}
