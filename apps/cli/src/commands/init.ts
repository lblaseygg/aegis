import { ConfigService } from "../services/configService.js";

export async function runInit(): Promise<void> {
  const service = new ConfigService();
  const result = await service.init();
  console.log(result.created ? `Initialized config at ${result.path}` : `Config already exists at ${result.path}`);
}
