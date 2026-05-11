#!/usr/bin/env node
import React from "react";
import { render, Box, Text } from "ink";
import { Command } from "commander";

import { APP_NAME } from "./lib/constants.js";

const Dashboard = () => (
  <Box flexDirection="column" padding={1}>
    <Text color="cyan">{APP_NAME}</Text>
    <Text>Offline-first local LLM operator toolkit</Text>
    <Text dimColor>Use --help to inspect the command surface while the MVP is being built.</Text>
  </Box>
);

const program = new Command();

program
  .name("aegis")
  .description("Air-gapped LLM deployment CLI")
  .version("0.1.0");

program
  .command("dashboard")
  .description("Render the prototype Ink dashboard")
  .action(() => {
    render(<Dashboard />);
  });

program.parse();
