import { DockerClient } from "../services/dockerClient.js";

export async function runDown(): Promise<void> {
  await new DockerClient().down();
}
