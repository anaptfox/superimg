//! superimg compile — direct CLI adapter over media.artifact.compile.

import { readFile, rm } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { formatError } from "@superimg/core/errors";
import { MEDIA_INTERACTION_IDS, type MediaArtifactTarget } from "@foxworth/superimg-interactions";
import { SuperImgError, type JsonObject } from "@superimg/types";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { loadDataInput } from "../utils/data-loader.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import {
  createCliMediaInteractionSession,
  type CliMediaInteractionContext,
} from "../utils/media-interactions.js";

export type CompileTarget = "web" | "native";

export interface CompileCommandOptions {
  data?: string;
  verify?: boolean;
  strict?: boolean;
  target?: CompileTarget;
  artifactVersion?: string;
  output?: string;
  json?: boolean;
  pretty?: boolean;
}

export interface NativePortabilityReason {
  nodeId?: string;
  reason: string;
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

export interface CompileReport {
  schemaVersion: typeof REPORT_SCHEMA;
  ok: true;
  path: string;
  targetId: string;
  artifactId: string;
  identity: unknown;
  hashes: {
    programHash: string;
    intentHash: string;
    markupHash: string;
  };
  artifactHash: string;
  manifest: unknown;
  target?: "native";
  nativePortable?: true;
}

function normalizeCompileTarget(target: string | undefined): CompileTarget {
  if (target === undefined || target === "web") return "web";
  if (target === "native") return "native";
  throw Object.assign(new TypeError(`--target must be web or native (received ${JSON.stringify(target)})`), {
    code: "INVALID_TARGET",
  });
}

function formatBlockingReasons(reasons: readonly NativePortabilityReason[]): string {
  if (reasons.length === 0) return "unknown native portability error";
  return reasons
    .map((entry) => (entry.nodeId ? `#${entry.nodeId} (${entry.reason})` : entry.reason))
    .join(", ");
}

/** Compile only the browser-safe media projection. Collection providers are never executed here. */
export async function runCompile(
  templateArg: string,
  options: CompileCommandOptions = {},
): Promise<CompileReport> {
  const target = normalizeCompileTarget(options.target);
  const templatePath = resolveTemplatePath(templateArg);
  const projectRoot = findProjectRoot(dirname(templatePath));
  const source = relative(projectRoot, templatePath).split(sep).join("/");
  const session = createCliMediaInteractionSession(projectRoot);
  try {
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

    if (target === "native") {
      const mediaRaw = await readFile(join(destination.path, "media.json"), "utf8");
      const mediaIr = JSON.parse(mediaRaw) as {
        extensions?: Record<string, { schemaVersion?: number; payload?: unknown }>;
      };
      const payload = mediaIr.extensions?.["superimg.native"]?.payload as
        | { portable?: boolean; reasons?: NativePortabilityReason[] }
        | undefined;
      if (!payload || payload.portable !== true) {
        const reasons = Array.isArray(payload?.reasons) ? payload.reasons : [];
        await rm(destination.path, { recursive: true, force: true });
        throw new SuperImgError(
          `Artifact is not portable to native targets: ${formatBlockingReasons(reasons)}`,
          "NATIVE_UNPORTABLE",
          {
            target: "native",
            portable: false,
            reasons,
          },
          "Run `superimg check <template> --target native` to inspect and replace browser-only nodes or config.",
        );
      }
    }

    return {
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
      ...(target === "native" ? { target: "native" as const, nativePortable: true as const } : {}),
    };
  } finally {
    await session.dispose();
  }
}

/** Compile only the browser-safe media projection. Collection providers are never executed here. */
export async function compileCommand(
  templateArg: string,
  options: CompileCommandOptions = {},
): Promise<void> {
  try {
    const report = await runCompile(templateArg, options);

    if (options.json || !process.stdout.isTTY) {
      process.stdout.write(
        `${options.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report)}\n`,
      );
    } else {
      console.log(`Compiled ${report.path}`);
      console.log(`  intent: ${report.hashes.intentHash.slice(0, 12)}…`);
      console.log(`  artifact: ${report.hashes.artifactHash.slice(0, 12)}…`);
      if (report.target === "native") {
        console.log("  target: native (portable)");
      }
    }
  } catch (error) {
    emitError(error, options);
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
