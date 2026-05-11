import React from "react";
import { render } from "ink";

import { ChatView } from "../components/ChatView.js";
import { ConfigService } from "../services/configService.js";
import { RagClient } from "../services/ragClient.js";

export async function runChat(): Promise<void> {
  const config = await new ConfigService().load();
  const rag = new RagClient(config.network.rag_api_base_url);

  render(
    <ChatView
      model={config.runtime.model}
      collection={config.runtime.collection}
      onSubmit={(question) =>
        rag.query(question, config.runtime.collection, config.runtime.model, config.rag.retrieval.top_k)
      }
    />,
  );
}
