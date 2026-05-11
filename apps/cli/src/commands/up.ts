import { DockerClient } from "../services/dockerClient.js";

export async function runUp(): Promise<void> {
  await new DockerClient().up();
}
