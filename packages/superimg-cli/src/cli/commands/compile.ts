//! superimg compile — direct CLI adapter over media.artifact.compile.

import { basename, dirname, relative, resolve, sep } from "node:path";
import { formatError } from "@superimg/core/errors";
import { MEDIA_INTERACTION_IDS, type MediaArtifactTarget } from "@foxworth/superimg-interactions";
import type { JsonObject } from "@superimg/types";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { loadDataInput } from "../utils/data-loader.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import {
  createCliMediaInteractionSession,
  type CliMediaInteractionContext,
} from "../utils/media-interactions.js";

export interface CompileCommandOptions {
  data?: string;
  verify?: boolean;
  strict?: boolean;
  artifactVersion?: string;
  output?: string;
  json?: boolean;
  pretty?: boolean;
}

const REPORT_SCHEMA = 0 as const;

function emitError(err: unknown, options: CompileCommandOptions): never {
  const formatted = formatError(err);
  const report = {
    schemaVersion: REPORT_SCHEMA,
    ok: false as const,
    error: formatted.json,
  };
  if (options.json || !process.stdout.isTTY) {
    process.stdout.write(
      `${options.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report)}\n`,
    );
  } else {
    console.error(formatted.plain);
  }
  process.exit(1);
}

/** Compile only the browser-safe media projection. Collection providers are never executed here. */
export async function compileCommand(
  templateArg: string,
  options: CompileCommandOptions = {},
): Promise<void> {
  let session: ReturnType<typeof createCliMediaInteractionSession> | undefined;
  try {
    const templatePath = resolveTemplatePath(templateArg);
    const projectRoot = findProjectRoot(dirname(templatePath));
    const source = relative(projectRoot, templatePath).split(sep).join("/");
    session = createCliMediaInteractionSession(projectRoot);

    let data: JsonObject | undefined;
    if (options.artifactVersion !== undefined && options.artifactVersion !== "0" && options.artifactVersion !== "1") throw new TypeError("--artifact-version must be 0 or 1");
    if (options.data !== undefined) {
      const loaded = await loadDataInput(options.data, dirname(templatePath));
      if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) {
        throw new Error("--data must resolve to one object");
      }
      data = loaded as JsonObject;
    }

    const description = await session.mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.describe,
      input: { source },
    }, {});
    const destination = artifactDestination(
      projectRoot,
      description.sourceId,
      options.output,
    );
    const context: CliMediaInteractionContext = destination.rootPath === undefined
      ? {}
      : { artifactRoot: destination.rootPath };
    const receipt = await session.mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.compile,
      input: {
        source,
        target: destination.target,
        ...(data !== undefined ? { data } : {}),
        verify: options.verify === true || options.strict === true,
        strict: options.strict === true,
        ...(options.artifactVersion === undefined ? {} : { artifactSchemaVersion: options.artifactVersion === "1" ? 1 as const : 0 as const }),
      },
    }, context);

    const report = {
      schemaVersion: REPORT_SCHEMA,
      ok: true as const,
      path: destination.path,
      targetId: receipt.targetId,
      artifactId: receipt.artifactId,
      identity: receipt.coordinates,
      hashes: {
        programHash: receipt.programHash,
        intentHash: receipt.intentHash,
        markupHash: receipt.markupHash,
      },
      artifactHash: receipt.artifactHash,
      manifest: receipt.manifest,
    };

    if (options.json || !process.stdout.isTTY) {
      process.stdout.write(
        `${options.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report)}\n`,
      );
    } else {
      console.log(`Compiled ${destination.path}`);
      console.log(`  intent: ${receipt.intentHash.slice(0, 12)}…`);
      console.log(`  artifact: ${receipt.artifactHash.slice(0, 12)}…`);
    }
  } catch (error) {
    emitError(error, options);
  } finally {
    await session?.dispose();
  }
}

function artifactDestination(
  projectRoot: string,
  sourceId: string,
  output: string | undefined,
): Readonly<{
  target: MediaArtifactTarget;
  path: string;
  rootPath?: string;
}> {
  if (output === undefined) {
    const artifactId = `${sourceId}.superimg`;
    return Object.freeze({
      target: Object.freeze({ targetId: "project-artifacts", artifactId }),
      path: resolve(projectRoot, "output", artifactId),
    });
  }
  const path = resolve(output);
  return Object.freeze({
    target: Object.freeze({
      targetId: "cli-artifact",
      artifactId: basename(path),
    }),
    path,
    rootPath: dirname(path),
  });
}
