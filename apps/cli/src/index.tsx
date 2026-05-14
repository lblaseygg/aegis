#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { Command } from "commander";

import { App } from "./components/App.js";
import { runAuditExport } from "./commands/audit.js";
import { runBundleCreate, runBundleVerify } from "./commands/bundle.js";
import { runChat } from "./commands/chat.js";
import { runCleanup } from "./commands/cleanup.js";
import { runDoctor } from "./commands/doctor.js";
import { runDown } from "./commands/down.js";
import { runInit } from "./commands/init.js";
import { runLogsTail } from "./commands/logs.js";
import { runModelPackInstall, runModelPacksList, runModelsList, runModelsSelect } from "./commands/models.js";
import { runIngest, runQuery } from "./commands/rag.js";
import { runRuntimeStatus, runRuntimeUse } from "./commands/runtime.js";
import { runUp } from "./commands/up.js";
import { APP_NAME } from "./lib/constants.js";
import { ConfigService } from "./services/configService.js";
import { OllamaClient } from "./services/ollamaClient.js";
import { RagClient } from "./services/ragClient.js";

const program = new Command();

async function runDashboard(): Promise<void> {
  const config = await new ConfigService().load();
  const [ollamaStatus, ragStatus] = await Promise.all([
    new OllamaClient(config.network.ollama_base_url).health(),
    new RagClient(config.network.rag_api_base_url).health().catch(() => null),
  ]);

  render(
    <App
      runtimeMode={config.runtime.mode}
      model={config.runtime.model}
      collection={config.runtime.collection}
      ollama={ollamaStatus}
      rag={ragStatus?.status ?? "offline"}
      chroma={ragStatus?.chroma ?? "unknown"}
    />,
  );
}

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
  .command("cleanup")
  .option("--builds", "Remove generated build artifacts")
  .option("--sessions", "Remove persisted chat session files and temp session files")
  .description("Remove safe local artifacts to recover disk space")
  .action(async (options: { builds?: boolean; sessions?: boolean }) => {
    await runCleanup(options);
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
    await runDashboard();
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

models
  .command("packs")
  .description("List bundled optional model packs")
  .action(async () => {
    await runModelPacksList();
  });

models
  .command("install-pack")
  .argument("<name>", "Bundled model pack name")
  .option("-s, --select <model>", "Select a model after importing the pack")
  .description("Import a bundled optional model pack into the local Ollama store")
  .action(async (name: string, options: { select?: string }) => {
    await runModelPackInstall(name, options);
  });

const rag = program.command("rag").description("Operate the local retrieval pipeline");

const runtime = program.command("runtime").description("Inspect or switch the local runtime mode");

runtime
  .command("status")
  .description("Print the current runtime mode and platform details")
  .action(async () => {
    await runRuntimeStatus();
  });

runtime
  .command("use")
  .argument("<mode>", "Runtime mode: local, remote, or docker")
  .description("Select the local runtime mode")
  .action(async (mode: string) => {
    await runRuntimeUse(mode as "local" | "remote" | "docker");
  });

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
  .command("create")
  .description("Build an air-gap bundle from the local workspace")
  .action(async () => {
    await runBundleCreate();
  });

bundle
  .command("verify")
  .argument("<path>", "Bundle archive to checksum")
  .description("Compute the bundle SHA256")
  .action(async (bundlePath: string) => {
    await runBundleVerify(bundlePath);
  });

async function main(): Promise<void> {
  if (process.argv.slice(2).length === 0) {
    await runChat();
    return;
  }

  await program.parseAsync(process.argv);
}

void main();
