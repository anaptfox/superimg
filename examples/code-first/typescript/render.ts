#!/usr/bin/env tsx
//! Server-side rendering example using SuperImg as a library
//! This demonstrates the simple high-level API with a TypeScript template file
//! Both template (template.ts) and renderer code are TypeScript

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderVideo } from "superimg/server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  console.log("🚀 Starting server-side rendering example (TypeScript template)...\n");

  // Read template file (TypeScript)
  const templatePath = resolve(__dirname, "template.ts");
  const templateCode = readFileSync(templatePath, "utf-8");
  console.log("📄 Template loaded:", templatePath);

  const outputPath = resolve(__dirname, "output.mp4");

  await renderVideo(templateCode, {
    output: outputPath,
    onProgress: (frame, total) => {
      const pct = Math.round((frame / total) * 100);
      process.stdout.write(`\r   Frame ${frame}/${total} (${pct}%)`);
    },
  });

  console.log(`\n✅ Video rendered successfully!`);
  console.log(`📁 Output: ${outputPath}\n`);
  console.log("✨ Done!");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
