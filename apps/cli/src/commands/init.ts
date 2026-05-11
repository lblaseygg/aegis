import { ConfigService } from "../services/configService.js";

export async function runInit(): Promise<void> {
  const service = new ConfigService();
  const result = await service.init();
  const config = await service.load();
  console.log(
    result.created
      ? `Initialized config at ${result.path} with runtime mode ${config.runtime.mode}`
      : `Config already exists at ${result.path} (runtime mode ${config.runtime.mode})`,
  );
}
