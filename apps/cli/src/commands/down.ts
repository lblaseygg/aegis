import { BootstrapService } from "../services/bootstrapService.js";
import { DockerClient } from "../services/dockerClient.js";

export async function runDown(): Promise<void> {
  const bootstrap = new BootstrapService();
  if (bootstrap.isManagedInstall()) {
    await bootstrap.stopServices();
    console.log("Aegis launch agents stopped.");
    return;
  }

  await new DockerClient().down();
}
