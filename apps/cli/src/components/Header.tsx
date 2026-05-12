import React from "react";
import { Box, Text } from "ink";

const AEGIS_ACCENT = "#FFFFF1";

interface HeaderProps {
  model: string;
  collection: string;
  runtimeMode: string;
}

export function Header({ model, collection, runtimeMode }: HeaderProps) {
  return (
    <Box justifyContent="space-between">
      <Text color={AEGIS_ACCENT}>Aegis</Text>
      <Text>
        Runtime: {runtimeMode}  Model: {model}  Collection: {collection}
      </Text>
    </Box>
  );
}
