//! Discover command — CLI projection of `media.project.discover`.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { MEDIA_INTERACTION_IDS } from "@foxworth/superimg-interactions";
import { findProjectRoot } from "../utils/find-project-root.js";
import { createCliMediaInteractionSession } from "../utils/media-interactions.js";
import {
  checkDuplicateVideoNames,
  extractShortName,
  type DiscoveredVideo,
} from "../utils/discover-videos.js";
import { formatError } from "@superimg/core/errors";

export async function discoverCommand(
  options: { json?: boolean } = {},
): Promise<void> {
  let videos: DiscoveredVideo[];
  try {
    const projectRoot = findProjectRoot();
    const session = createCliMediaInteractionSession(projectRoot);
    try {
      const discovery = await session.mount.dispatch({
        interactionId: MEDIA_INTERACTION_IDS.discover,
        input: {},
      }, {});
      videos = discovery.sources.map((source) => {
        const entrypoint = join(projectRoot, source.relativePath);
        const directory = dirname(entrypoint);
        return {
          name: source.sourceId,
          shortName: extractShortName(source.relativePath),
          entrypoint,
          directory,
          relativePath: source.relativePath,
          hasLocalConfig: existsSync(join(directory, "_config.ts")),
        };
      });
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

  const dupWarning = checkDuplicateVideoNames(videos);

  if (options.json) {
    console.log(JSON.stringify(videos, null, 2));
    if (dupWarning) process.stderr.write(`Warning: ${dupWarning}\n`);
    return;
  }

  if (videos.length === 0) {
    console.log("\n  No templates found.");
    console.log(
      "  Create a *.media.ts file, or copy from monorepo examples/ (superimg init --example hello-world).\n",
    );
    return;
  }

  if (dupWarning) console.warn(`\nWarning: ${dupWarning}\n`);

  console.log(`\n  ${videos.length} template(s) found:\n`);

  const maxName = Math.max(4, ...videos.map((v) => v.shortName.length));
  const pad = (s: string, n: number) => s.padEnd(n);

  console.log(`  ${pad("Name", maxName)}  Path`);
  console.log(`  ${"-".repeat(maxName)}  ${"-".repeat(40)}`);

  for (const v of videos) {
    console.log(`  ${pad(v.shortName, maxName)}  ${v.relativePath}`);
  }

  console.log("\n");
}
