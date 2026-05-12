import { BootstrapService } from "../services/bootstrapService.js";

export async function runInstall(): Promise<void> {
  const bootstrap = new BootstrapService();
  await bootstrap.install();
  console.log("Aegis runtime installed under ~/Library/Application Support/Aegis");
}
