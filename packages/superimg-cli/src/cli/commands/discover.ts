//! Discover command — fast template discovery for build tools, no template parsing.
//! Unlike `list`, this does not parse template configs; it just walks the filesystem.

import { findProjectRoot } from "../utils/find-project-root.js";
import { discoverVideos, checkDuplicateVideoNames } from "../utils/discover-videos.js";
import { formatError } from "@superimg/core/errors";

export async function discoverCommand(options: { json?: boolean } = {}) {
  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ error: formatted.json }));
      process.exit(1);
    }
    console.error(`Error: ${formatted.plain}`);
    process.exit(1);
  }

  const videos = discoverVideos(projectRoot);
  const dupWarning = checkDuplicateVideoNames(videos);

  if (options.json) {
    console.log(JSON.stringify(videos, null, 2));
    if (dupWarning) process.stderr.write(`Warning: ${dupWarning}\n`);
    return;
  }

  if (videos.length === 0) {
    console.log("\n  No templates found.");
    console.log("  Create a *.media.ts file, or run 'superimg init' to scaffold.\n");
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
