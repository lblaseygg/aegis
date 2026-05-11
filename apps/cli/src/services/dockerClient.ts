import { execa } from "execa";

import { ROOT_DIR } from "../lib/constants.js";

export class DockerClient {
  async up(options?: { services?: string[]; env?: NodeJS.ProcessEnv }): Promise<void> {
    const services = options?.services ?? [];
    await execa("docker", ["compose", "up", "-d", "--build", ...services], {
      cwd: ROOT_DIR,
      stdio: "inherit",
      env: options?.env,
    });
  }

  async down(): Promise<void> {
    await execa("docker", ["compose", "down"], { cwd: ROOT_DIR, stdio: "inherit" });
  }
}
