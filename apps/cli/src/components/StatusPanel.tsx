import React from "react";
import { Box, Text } from "ink";

interface StatusPanelProps {
  ollama: string;
  rag: string;
  chroma: string;
}

export function StatusPanel({ ollama, rag, chroma }: StatusPanelProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text>Ollama: {ollama}</Text>
      <Text>RAG API: {rag}</Text>
      <Text>ChromaDB: {chroma}</Text>
    </Box>
  );
}
