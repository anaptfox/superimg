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
    console.log("  Create a *.media.ts file, or run 'superimg init' to scaffold.\n");
    return;
  }

  console.log("\n  Templates found:\n");

  // Short human label from the two axes (medium × animated).
  const typeLabel = (medium: string, animated: boolean): string =>
    medium === "svg" ? (animated ? "svg·anim" : "svg") : animated ? "video" : "image";

  const rows = videos.map((v) => ({
    shortName: v.shortName,
    type: typeLabel(v.medium, v.animated),
    config: v.config ?? "—",
    path: v.relativePath,
  }));

  const maxName = Math.max(4, ...rows.map((r) => r.shortName.length));
  const maxType = Math.max(4, ...rows.map((r) => r.type.length));
  const maxConfig = Math.max(6, ...rows.map((r) => r.config.length));
  const pad = (s: string, n: number) => s.padEnd(n);

  console.log(`  ${pad("Name", maxName)}  ${pad("Type", maxType)}  ${pad("Config", maxConfig)}  Path`);
  console.log(`  ${"-".repeat(maxName)}  ${"-".repeat(maxType)}  ${"-".repeat(maxConfig)}  ${"-".repeat(40)}`);

  for (const row of rows) {
    console.log(`  ${pad(row.shortName, maxName)}  ${pad(row.type, maxType)}  ${pad(row.config, maxConfig)}  ${row.path}`);
  }

  console.log("\n");
}
