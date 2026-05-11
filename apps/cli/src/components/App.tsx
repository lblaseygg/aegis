import React from "react";
import { Box } from "ink";

import { Header } from "./Header.js";
import { StatusPanel } from "./StatusPanel.js";

interface AppProps {
  model: string;
  collection: string;
  ollama: string;
  rag: string;
  chroma: string;
}

export function App({ model, collection, ollama, rag, chroma }: AppProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Header model={model} collection={collection} />
      <Box marginTop={1}>
        <StatusPanel ollama={ollama} rag={rag} chroma={chroma} />
      </Box>
    </Box>
  );
}
