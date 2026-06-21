//! List command - thin CLI wrapper over listVideos

import { listVideos } from "../../list-videos.js";
import { formatError } from "@superimg/core/errors";

export async function listCommand(options: { json?: boolean } = {}) {
  let videos: Awaited<ReturnType<typeof listVideos>>;
  try {
    videos = await listVideos();
  } catch (err) {
    const formatted = formatError(err);
    if (options.json) {
      console.log(JSON.stringify({ error: formatted.json }));
      process.exit(1);
    }
    console.error(`\n  Error: ${formatted.plain}\n`);
    process.exit(1);
  }

  if (options.json) {
    const { buildManifest } = await import("../../integration/manifest.js");
    const manifest = await buildManifest(process.cwd());
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  if (videos.length === 0) {
    console.log("\n  No templates found.");
    console.log("  Create a *.video.ts, *.image.ts, or *.gif.ts file, or run 'superimg init' to scaffold.\n");
    return;
  }

  console.log("\n  Templates found:\n");

  const rows = videos.map((v) => ({
    shortName: v.shortName,
    kind: v.kind,
    config: v.config ?? "—",
    path: v.relativePath,
  }));

  const maxName = Math.max(4, ...rows.map((r) => r.shortName.length));
  const maxKind = Math.max(4, ...rows.map((r) => r.kind.length));
  const maxConfig = Math.max(6, ...rows.map((r) => r.config.length));
  const pad = (s: string, n: number) => s.padEnd(n);

  console.log(`  ${pad("Name", maxName)}  ${pad("Type", maxKind)}  ${pad("Config", maxConfig)}  Path`);
  console.log(`  ${"-".repeat(maxName)}  ${"-".repeat(maxKind)}  ${"-".repeat(maxConfig)}  ${"-".repeat(40)}`);

  for (const row of rows) {
    console.log(`  ${pad(row.shortName, maxName)}  ${pad(row.kind, maxKind)}  ${pad(row.config, maxConfig)}  ${row.path}`);
  }

  console.log("\n");
}
