import React from "react";
import { render } from "ink";

import { ChatView } from "../components/ChatView.js";
import { ConfigService } from "../services/configService.js";
import { CodeContextService } from "../services/codeContextService.js";
import { ChatService } from "../services/chatService.js";
import { ChatSessionService } from "../services/chatSessionService.js";
import { OllamaClient } from "../services/ollamaClient.js";
import { RagClient } from "../services/ragClient.js";
import { SshTunnelService } from "../services/sshTunnelService.js";

export async function runChat(): Promise<void> {
  const configService = new ConfigService();
  const config = await configService.load();
  await new SshTunnelService().ensureForConfig(config);
  const codeContextService = new CodeContextService();
  const rag = new RagClient(config.network.rag_api_base_url);
  const ollama = new OllamaClient(config.network.ollama_base_url);
  const availableModels = await ollama.listModels().then((models) => models.map((model) => model.name)).catch(() => []);
  const chatService = new ChatService(
    configService,
    new ChatSessionService(),
    rag,
    ollama,
    codeContextService,
  );
  const initialSession = await chatService.createInitialSession(config);

  const useAlternateScreen = process.stdout.isTTY === true;

  if (useAlternateScreen) {
    process.stdout.write("\u001B[?1049h");
  }

  try {
    const app = render(
      <ChatView
        initialSession={initialSession}
        availableModels={availableModels}
        onResolveFiles={(cwd) => codeContextService.listFiles(cwd, 200)}
        onSubmit={(question, session, onProgress) => chatService.handleInput(question, session, onProgress)}
      />,
    );

    await app.waitUntilExit();
  } finally {
    if (useAlternateScreen) {
      process.stdout.write("\u001B[?1049l");
    }
  }
}
