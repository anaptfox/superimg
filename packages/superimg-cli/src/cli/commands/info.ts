//! Info command — human and JSON projections of `media.source.describe`.

import { dirname, relative, sep } from "node:path";
import { formatError } from "@superimg/core/errors";
import {
  MEDIA_INTERACTION_IDS,
  type MediaSourceDescription,
} from "@foxworth/superimg-interactions";
import { findProjectRoot } from "../utils/find-project-root.js";
import { createCliMediaInteractionSession } from "../utils/media-interactions.js";
import { resolveTemplatePath } from "../utils/resolve-template.js";

export async function infoCommand(
  template: string,
  options: { json?: boolean } = {},
): Promise<void> {
  let resolvedPath: string;
  let description: MediaSourceDescription;
  try {
    resolvedPath = resolveTemplatePath(template);
    const projectRoot = findProjectRoot(dirname(resolvedPath));
    const source = relative(projectRoot, resolvedPath).split(sep).join("/");
    const session = createCliMediaInteractionSession(projectRoot);
    try {
      description = await session.mount.dispatch({
        interactionId: MEDIA_INTERACTION_IDS.describe,
        input: { source },
      }, {});
    } finally {
      await session.dispose();
    }
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ error: formatted.json }));
      process.exit(1);
    }
    console.error(`Error: ${formatted.plain}`);
    process.exit(1);
  }

  const phases = description.phases.length === 0
    ? null
    : description.phases.map((phase) => ({
        name: phase.name,
        start: phase.start,
        end: phase.end,
        startSec: phase.startSeconds,
        endSec: phase.endSeconds,
      }));

  if (options.json) {
    console.log(JSON.stringify({
      path: resolvedPath,
      source: "runtime",
      config: {
        width: description.canvas.width,
        height: description.canvas.height,
        fps: description.fps,
        duration: description.duration,
      },
      totalFrames: description.totalFrames,
      duration: description.duration,
      phases,
    }, null, 2));
    return;
  }

  console.log("\n  Template Information");
  console.log("  ===================\n");
  console.log(`  File: ${resolvedPath}`);
  console.log("  Status: ✓ Loaded (runtime)\n");
  console.log("  Configuration:");
  console.log(`    Width: ${description.canvas.width}px`);
  console.log(`    Height: ${description.canvas.height}px`);
  console.log(`    FPS: ${description.fps}`);
  console.log(`    Duration: ${description.duration}s (runtime)`);
  console.log();
  console.log("  Video:");
  console.log(`    Total frames: ${description.totalFrames}`);
  console.log(
    `    Duration: ${description.duration.toFixed(2)}s (at ${description.fps} fps)`,
  );
  if (phases !== null) {
    console.log("\n  Director phases:");
    for (const phase of phases) {
      console.log(
        `    ${phase.name}: ${phase.startSec.toFixed(2)}s–${phase.endSec.toFixed(2)}s (${(phase.start * 100).toFixed(0)}–${(phase.end * 100).toFixed(0)}%)`,
      );
    }
  }
  console.log("\n");
}
