//! List command - show all discovered videos

import { findProjectRoot } from "../utils/find-project-root.js";
import { discoverVideos } from "../utils/discover-videos.js";
import { loadCascadingConfig } from "../utils/config-loader.js";
import { resolveRenderConfig } from "../utils/template-config.js";
import { extractTemplateMetadata } from "@superimg/core/template-metadata";
import { readFileSync } from "node:fs";

export async function listCommand() {
  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch (err) {
    console.error(`\n  Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  const videos = discoverVideos(projectRoot);

  if (videos.length === 0) {
    console.log("\n  No videos found.");
    console.log("  Create a *.video.ts or *.video.js file, or run 'superimg init' to scaffold.\n");
    return;
  }

  console.log("\n  Videos found:\n");

  // Build table rows with config info
  const rows: { shortName: string; config: string; path: string }[] = [];

  for (const video of videos) {
    let configStr = "—";
    try {
      const cascadingConfig = await loadCascadingConfig(video.entrypoint, projectRoot);
      const templateCode = readFileSync(video.entrypoint, "utf-8");
      const metadata = await extractTemplateMetadata(templateCode);
      const resolved = resolveRenderConfig({
        templateConfig: metadata.config,
        cascadingConfig,
      });
      configStr = `${resolved.width}x${resolved.height} ${resolved.fps}fps`;
    } catch {
      // Ignore - show dash
    }
    rows.push({
      shortName: video.shortName,
      config: configStr,
      path: video.relativePath,
    });
  }

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
