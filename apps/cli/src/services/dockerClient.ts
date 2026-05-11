import { execa } from "execa";

import { ROOT_DIR } from "../lib/constants.js";

export class DockerClient {
  async up(): Promise<void> {
    await execa("docker", ["compose", "up", "-d", "--build"], { cwd: ROOT_DIR, stdio: "inherit" });
  }

  async down(): Promise<void> {
    await execa("docker", ["compose", "down"], { cwd: ROOT_DIR, stdio: "inherit" });
  }
}
