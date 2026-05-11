#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { Command } from "commander";

import { App } from "./components/App.js";
import { runAuditExport } from "./commands/audit.js";
import { runBundleVerify } from "./commands/bundle.js";
import { runChat } from "./commands/chat.js";
import { runDoctor } from "./commands/doctor.js";
import { runDown } from "./commands/down.js";
import { runInit } from "./commands/init.js";
import { runLogsTail } from "./commands/logs.js";
import { runModelsList, runModelsSelect } from "./commands/models.js";
import { runIngest, runQuery } from "./commands/rag.js";
import { runUp } from "./commands/up.js";
import { APP_NAME } from "./lib/constants.js";
import { ConfigService } from "./services/configService.js";
import { OllamaClient } from "./services/ollamaClient.js";
import { RagClient } from "./services/ragClient.js";

const program = new Command();

program
  .name("aegis")
  .description(APP_NAME)
  .version("0.1.0");

program
  .command("init")
  .description("Create the local operator config if it does not exist")
  .action(async () => {
    await runInit();
  });

program
  .command("doctor")
  .description("Check local services and configuration")
  .action(async () => {
    await runDoctor();
  });

program
  .command("up")
  .description("Start the local Docker Compose stack")
  .action(async () => {
    await runUp();
  });

program
  .command("down")
  .description("Stop the local Docker Compose stack")
  .action(async () => {
    await runDown();
  });

program
  .command("dashboard")
  .description("Render the Ink operator dashboard")
  .action(async () => {
    const config = await new ConfigService().load();
    const [ollamaStatus, ragStatus] = await Promise.all([
      new OllamaClient(config.network.ollama_base_url).health(),
      new RagClient(config.network.rag_api_base_url).health().catch(() => null),
    ]);

    render(
      <App
        model={config.runtime.model}
        collection={config.runtime.collection}
        ollama={ollamaStatus}
        rag={ragStatus?.status ?? "offline"}
        chroma={ragStatus?.chroma ?? "unknown"}
      />,
    );
  });

program
  .command("chat")
  .description("Launch the interactive Ink chat")
  .action(async () => {
    await runChat();
  });

const models = program.command("models").description("Manage local Ollama model selections");

models
  .command("list")
  .description("List available Ollama models")
  .action(async () => {
    await runModelsList();
  });

models
  .command("select")
  .argument("<model>", "Ollama model name")
  .description("Select the active model in local config")
  .action(async (model: string) => {
    await runModelsSelect(model);
  });

const rag = program.command("rag").description("Operate the local retrieval pipeline");

rag
  .command("ingest")
  .argument("<path>", "Path to documents")
  .option("-c, --collection <collection>", "Collection name override")
  .description("Ingest documents into the local vector store")
  .action(async (targetPath: string, options: { collection?: string }) => {
    await runIngest(targetPath, options.collection);
  });

rag
  .command("query")
  .argument("<question>", "Grounded question to ask")
  .option("-c, --collection <collection>", "Collection name override")
  .description("Run a grounded query against the local vector store")
  .action(async (question: string, options: { collection?: string }) => {
    await runQuery(question, options.collection);
  });

const logs = program.command("logs").description("Inspect local audit logs");

logs
  .command("tail")
  .option("-n, --limit <limit>", "How many events to print", "20")
  .description("Print recent audit events")
  .action(async (options: { limit: string }) => {
    await runLogsTail(Number(options.limit));
  });

const audit = program.command("audit").description("Export audit records");

audit
  .command("export")
  .requiredOption("--from <from>", "Inclusive ISO start date")
  .requiredOption("--to <to>", "Inclusive ISO end date")
  .description("Export audit records to JSON")
  .action(async (options: { from: string; to: string }) => {
    await runAuditExport(options.from, options.to);
  });

const bundle = program.command("bundle").description("Offline bundle helpers");

bundle
  .command("verify")
  .argument("<path>", "Bundle archive to checksum")
  .description("Compute the bundle SHA256")
  .action(async (bundlePath: string) => {
    await runBundleVerify(bundlePath);
  });

program.parse();
