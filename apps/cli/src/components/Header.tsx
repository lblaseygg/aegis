import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  model: string;
  collection: string;
}

export function Header({ model, collection }: HeaderProps) {
  return (
    <Box justifyContent="space-between">
      <Text color="cyan">Aegis</Text>
      <Text>
        Model: {model}  Collection: {collection}
      </Text>
    </Box>
  );
}
