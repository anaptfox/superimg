//! Load MediaIR from media.json path or .superimg artifact directory.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateMediaIR } from "@superimg/core";
import type { MediaIR } from "@superimg/types";
import { readMediaArtifact } from "@superimg/core/ir-node";

export async function loadIrFromPath(path: string): Promise<MediaIR> {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  if (statSync(path).isDirectory()) {
    if (existsSync(join(path, "artifact.json"))) {
      return (await readMediaArtifact(path)).media;
    }
    const mediaPath = join(path, "media.json");
    if (!existsSync(mediaPath)) {
      throw new Error(`Not a Media IR path (missing media.json): ${path}`);
    }
    return validateMediaIR(JSON.parse(readFileSync(mediaPath, "utf8")));
  }
  try {
    return validateMediaIR(JSON.parse(readFileSync(path, "utf8")));
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Malformed Media IR JSON at ${path}: ${err.message}`);
    }
    throw err;
  }
}
