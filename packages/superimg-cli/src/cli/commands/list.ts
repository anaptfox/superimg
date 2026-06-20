//! List command - thin CLI wrapper over listVideos

import { listVideos } from "../../list-videos.js";
import { formatError } from "@superimg/core/errors";

export async function listCommand() {
  let videos: Awaited<ReturnType<typeof listVideos>>;
  try {
    videos = await listVideos();
  } catch (err) {
    console.error(`\n  Error: ${formatError(err).plain}\n`);
    process.exit(1);
  }

  if (videos.length === 0) {
    console.log("\n  No videos found.");
    console.log("  Create a *.video.ts or *.video.js file, or run 'superimg init' to scaffold.\n");
    return;
  }

  console.log("\n  Videos found:\n");

  const rows = videos.map((v) => ({
    shortName: v.shortName,
    config: v.config ?? "—",
    path: v.relativePath,
  }));

  const maxName = Math.max(4, ...rows.map((r) => r.shortName.length));
  const maxConfig = Math.max(6, ...rows.map((r) => r.config.length));
  const pad = (s: string, n: number) => s.padEnd(n);

  console.log(`  ${pad("Name", maxName)}  ${pad("Config", maxConfig)}  Path`);
  console.log(`  ${"-".repeat(maxName)}  ${"-".repeat(maxConfig)}  ${"-".repeat(40)}`);

  for (const row of rows) {
    console.log(`  ${pad(row.shortName, maxName)}  ${pad(row.config, maxConfig)}  ${row.path}`);
  }

  console.log("\n");
}
