#!/usr/bin/env tsx
//! Harness Integrity - Compute and verify source hash for harness bundle
//!
//! Usage:
//!   tsx scripts/harness-integrity.ts compute  - Output current source hash
//!   tsx scripts/harness-integrity.ts verify   - Verify embedded hash matches
//!   tsx scripts/harness-integrity.ts embed    - Write hash to dist/harness/.source-hash

import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const PLAYWRIGHT_PKG = join(ROOT, "packages", "superimg-playwright");
const HASH_FILE = join(PLAYWRIGHT_PKG, "dist", "harness", ".source-hash");

// Source directories that contribute to the harness bundle
const SOURCE_DIRS = [
  join(PLAYWRIGHT_PKG, "src", "harness"),
  join(ROOT, "packages", "superimg-runtime", "src"),
  join(ROOT, "packages", "superimg-core", "src"),
  join(ROOT, "packages", "superimg-types", "src"),
  join(ROOT, "packages", "superimg-stdlib", "src"),
];

// File extensions to include
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/**
 * Recursively gather all source files from a directory
 */
async function gatherFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await gatherFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist, skip
  }

  return files;
}

/**
 * Compute SHA-256 hash of all source files
 */
async function computeHash(): Promise<string> {
  // Gather all source files
  const allFiles: string[] = [];
  for (const dir of SOURCE_DIRS) {
    const files = await gatherFiles(dir);
    allFiles.push(...files);
  }

  // Sort for deterministic ordering
  allFiles.sort();

  // Create hash of all file contents
  const hash = createHash("sha256");

  for (const file of allFiles) {
    const content = await readFile(file, "utf-8");
    // Include relative path in hash so file renames are detected
    const relPath = relative(ROOT, file);
    hash.update(`${relPath}\n${content}\n`);
  }

  return hash.digest("hex").slice(0, 16); // Use first 16 chars for brevity
}

/**
 * Read the embedded hash from dist/harness/.source-hash
 */
async function readEmbeddedHash(): Promise<string | null> {
  try {
    const content = await readFile(HASH_FILE, "utf-8");
    return content.trim();
  } catch {
    return null;
  }
}

/**
 * Write hash to dist/harness/.source-hash
 */
async function embedHash(hash: string): Promise<void> {
  await writeFile(HASH_FILE, hash + "\n", "utf-8");
}

// =============================================================================
// CLI
// =============================================================================

const command = process.argv[2];

switch (command) {
  case "compute": {
    const hash = await computeHash();
    console.log(hash);
    break;
  }

  case "verify": {
    const currentHash = await computeHash();
    const embeddedHash = await readEmbeddedHash();

    if (!embeddedHash) {
      console.error("Error: No embedded hash found at dist/harness/.source-hash");
      console.error("Run 'pnpm build:harness' to generate it.");
      process.exit(1);
    }

    if (currentHash !== embeddedHash) {
      console.error("Error: Harness is stale!");
      console.error(`  Embedded hash: ${embeddedHash}`);
      console.error(`  Current hash:  ${currentHash}`);
      console.error("");
      console.error("Run 'pnpm build:harness' to rebuild the harness.");
      process.exit(1);
    }

    console.log(`Harness is up to date (hash: ${currentHash})`);
    break;
  }

  case "embed": {
    const hash = await computeHash();
    await embedHash(hash);
    console.log(`Embedded hash: ${hash}`);
    break;
  }

  default:
    console.error("Usage: tsx scripts/harness-integrity.ts <compute|verify|embed>");
    process.exit(1);
}
