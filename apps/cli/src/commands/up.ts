import { ConfigService } from "../services/configService.js";
import { DockerClient } from "../services/dockerClient.js";
import { RuntimeService } from "../services/runtimeService.js";

export async function runUp(): Promise<void> {
  const config = await new ConfigService().load();
  const runtimeService = new RuntimeService();
  const runtime = await runtimeService.inspect(config);
  if (runtime.mode === "native" && !runtime.nativeOllamaInstalled) {
    throw new Error("Native runtime mode requires a host Ollama install on macOS. Install Ollama or switch to `aegis runtime use docker`.");
  }

  await new DockerClient().up({
    services: runtimeService.getComposeServices(config),
    env: runtimeService.getComposeEnvironment(config),
  });
}
