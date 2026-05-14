import { ConfigService } from "../services/configService.js";
import { DockerClient } from "../services/dockerClient.js";
import { RuntimeService } from "../services/runtimeService.js";

export async function runUp(): Promise<void> {
  const config = await new ConfigService().load();
  const runtimeService = new RuntimeService();
  const runtime = await runtimeService.inspect(config);
  if (runtime.mode === "local" && !runtime.hostOllamaInstalled) {
    throw new Error("Local runtime mode requires a host Ollama install. Install Ollama or switch to `aegis runtime use docker`.");
  }

  if (runtime.mode === "remote") {
    console.log("Remote runtime mode does not start local services. Ensure the remote Ollama and RAG API endpoints are already reachable.");
    return;
  }

  await new DockerClient().up({
    services: runtimeService.getComposeServices(config),
    env: runtimeService.getComposeEnvironment(config),
  });
}
