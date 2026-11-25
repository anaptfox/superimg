//! Private CLI ownership of the value runtime used by native media interactions.
//!
//! The interaction mount borrows this runtime. It never creates authority and it
//! never owns runtime disposal; every CLI command closes the session it opens.

import { createRuntime, startExport } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter, type InspectionPaintCapture } from "@superimg/node/runtime";
import { createHash } from "node:crypto";
import {
  createProjectMediaTargetRegistry,
  createNodeMediaInteractionMount,
  type MediaLogicalTargetKind,
  type MediaInteractionMount,
  type MediaTargetRegistry,
  type MediaTargetResolution,
  type NodeMediaExecutionOptions,
  type NodeNarrationOptions,
} from "@foxworth/superimg-interactions";
import type { ExportBundle, ExportOptions, ExportableMedia, PausableJob, Runtime } from "@superimg/types";
import { attachMediaJobControls } from "./media-job-controls.js";
import { commandTraceDirectory, commandProfilingEnabled, commandRendererTiming, commandInspectionDiagnostics } from "./command-profile.js";

declare const __SUPERIMG_VERSION__: string;

export type CliMediaInteractionContext = NodeMediaExecutionOptions & Readonly<{
  /** Trusted direct-command path roots; never enter portable interaction input. */
  publicationRoot?: string;
  artifactRoot?: string;
}>;

export interface CliMediaInteractionSession {
  readonly mount: MediaInteractionMount<CliMediaInteractionContext>;
  readonly runtime: Runtime;
  dispose(): Promise<void>;
}

/** One explicit value runtime for commands that do not use project interactions. */
export function createCliValueRuntime(inspectionPaintCapture?: InspectionPaintCapture): Runtime {
  const traceDirectory = commandTraceDirectory();
  return createRuntime(createNodeRuntimeAdapter({
    ...(inspectionPaintCapture ? { inspectionPaintCapture } : {}),
    ...(commandProfilingEnabled() ? { onTiming: commandRendererTiming } : {}),
    ...(traceDirectory ? { inspectionTraceDirectory: traceDirectory, onInspectionDiagnostics: commandInspectionDiagnostics } : {}),
  }));
}

export async function exportWithCliControls(
  runtime: Runtime,
  media: ExportableMedia,
  options: ExportOptions,
  starter: (runtime: Runtime, media: ExportableMedia, options: ExportOptions) => PausableJob<ExportBundle> = startExport,
): Promise<ExportBundle> {
  const job = starter(runtime, media, options);
  const detach = attachMediaJobControls(job);
  try {
    return await job.result;
  } catch (error) {
    await job.dispose();
    throw error;
  } finally {
    detach();
  }
}

export function createCliMediaInteractionSession(
  projectRoot: string,
  narration?: NodeNarrationOptions,
): CliMediaInteractionSession {
  const runtime = createCliValueRuntime();
  const projectTargets = createProjectMediaTargetRegistry<CliMediaInteractionContext>(projectRoot);
  const targets: MediaTargetRegistry<CliMediaInteractionContext> = Object.freeze({
    resolve(args: Readonly<{
      kind: MediaLogicalTargetKind;
      targetId: string;
      context: CliMediaInteractionContext;
    }>): Promise<MediaTargetResolution> | MediaTargetResolution {
      const rootPath = args.kind === "publication"
        ? args.context.publicationRoot
        : args.context.artifactRoot;
      const cliTargetId = args.kind === "publication"
        ? "cli-publication"
        : "cli-artifact";
      if (rootPath === undefined || args.targetId !== cliTargetId) {
        return projectTargets.resolve(args);
      }
      return Object.freeze({
        targetId: cliTargetId,
        rootPath,
        registryDigest: createHash("sha256")
          .update(JSON.stringify({ kind: args.kind, targetId: cliTargetId, rootPath }))
          .digest("hex"),
      });
    },
  });
  const mount = createNodeMediaInteractionMount<CliMediaInteractionContext>({
    projectRoot,
    runtime,
    targets,
    ...(narration === undefined ? {} : { narration }),
    executionOptions: (context) => context,
    producerVersion: __SUPERIMG_VERSION__,
    exportMedia: async (runtime, media, options) => await exportWithCliControls(runtime, media as ExportableMedia, options),
  });
  let disposed = false;
  const reach = startReach(mount);

  return Object.freeze({
    mount,
    runtime,
    async dispose() {
      if (disposed) return;
      disposed = true;
      const handle = await reach;
      await handle?.stop();
      await runtime.dispose();
    },
  });
}

async function startReach(
  mount: MediaInteractionMount<CliMediaInteractionContext>,
) {
  try {
    const { startMediaReach } = await import("./media-reach.js");
    return await startMediaReach(mount, {});
  } catch {
    return undefined;
  }
}
