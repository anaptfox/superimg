//! Dev command - thin CLI wrapper over startDevServer

import { execa } from "execa";
import { readFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { formatError } from "@superimg/core/errors";
import { analyzeMediaSource } from "@superimg/core/source-analysis";
import { bundleMediaProgram } from "@superimg/core/bundler";
import { compileTemplate } from "@superimg/core";
import { startDevServer } from "../../dev-server.js";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { createCliMediaInteractionSession } from "../utils/media-interactions.js";
import { MEDIA_INTERACTION_IDS } from "@foxworth/superimg-interactions";
import type { MediaCollectionSnapshot } from "@foxworth/superimg-interactions";
import { findProjectRoot } from "../utils/find-project-root.js";
import { assertCollectionMediaKind } from "../utils/collection-selection.js";

interface DevOptions {
  port: string;
  open: boolean;
  edition?: string;
  variant?: string;
  entry?: string;
}

export async function devCommand(template: string | undefined, options: DevOptions) {
  let server: Awaited<ReturnType<typeof startDevServer>>;
  try {
    if (!template && options.entry !== undefined) {
      throw new Error("--entry requires a deterministic collection template");
    }
    if (!template && (options.variant !== undefined || options.edition !== undefined)) {
      throw new Error("--variant and --edition require a media template because IDs are source-specific");
    }
    let collectionSnapshot: MediaCollectionSnapshot | undefined;
    let collectionSource = false;
    let selected: MediaCollectionSnapshot["entries"][number] | undefined;
    if (template) {
      const resolvedPath = resolveTemplatePath(template);
      const descriptor = analyzeMediaSource(readFileSync(resolvedPath, "utf8"), resolvedPath);
      if (options.entry !== undefined && descriptor.kind !== "collection") throw new Error("--entry is only valid for deterministic collections");
      if (descriptor.kind === "collection") {
        collectionSource = true;
        const bundle = await bundleMediaProgram(resolvedPath);
        const compiled = compileTemplate(bundle);
        if (compiled.error) throw compiled.error;
        assertCollectionMediaKind(compiled);
        const projectRoot = findProjectRoot(dirname(resolvedPath));
        const session = createCliMediaInteractionSession(projectRoot);
        try {
          try {
            collectionSnapshot = await session.mount.dispatch({
              interactionId: MEDIA_INTERACTION_IDS.snapshot,
              input: { source: relative(projectRoot, resolvedPath) },
            }, {});
          } catch (error) {
            if (typeof error !== "object" || error === null || Reflect.get(error, "code") !== "COLLECTION_EMPTY") throw error;
          }
        } finally {
          await session.dispose();
        }
        selected = options.entry === undefined
          ? collectionSnapshot?.entries[0]
          : collectionSnapshot?.entries.find((entry) => entry.id === options.entry);
        if (options.entry !== undefined && !selected) {
          throw new Error(`Unknown collection entry ${JSON.stringify(options.entry)}`);
        }
      }
    }
    server = await startDevServer(template, {
      port: parseInt(options.port, 10),
      ...(options.edition !== undefined ? { edition: options.edition } : {}),
      ...(options.variant !== undefined ? { variantId: options.variant } : {}),
      ...(selected !== undefined ? { entryId: selected.id, entryData: selected.data } : {}),
      ...(collectionSnapshot === undefined ? {} : { collectionSnapshot }),
      ...(collectionSource ? { collectionSource: true } : {}),
    });
  } catch (err) {
    process.stderr.write(formatError(err).ansi + "\n");
    process.exit(1);
  }

  console.log(`\n  SuperImg dev server running at ${server.url}\n`);

  if (options.open) {
    const openCmd =
      process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
    execa(openCmd, [server.url]).catch(() => {});
  }

  const cleanup = async () => {
    console.log("\n  Shutting down dev server...\n");
    await server.close();
    process.exit(0);
  };

  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
}
