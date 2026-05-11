import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  model: string;
  collection: string;
  runtimeMode: string;
}

export function Header({ model, collection, runtimeMode }: HeaderProps) {
  return (
    <Box justifyContent="space-between">
      <Text color="cyan">Aegis</Text>
      <Text>
        Runtime: {runtimeMode}  Model: {model}  Collection: {collection}
      </Text>
    </Box>
  );
}
