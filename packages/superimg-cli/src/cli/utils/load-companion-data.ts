//! Companion data file loader
//! Discovers and loads .data.{ts,js,json} files colocated with .video.{ts,js} templates

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadDataScript } from "./data-loader.js";

const DATA_EXTENSIONS = [".data.ts", ".data.js", ".data.json"] as const;
const VIDEO_PATTERN = /\.video\.(ts|js|tsx|jsx)$/;

/**
 * Find a companion data file for a video template.
 * e.g., `changelog.video.ts` → looks for `changelog.data.{ts,js,json}`
 */
function findCompanionDataFile(templatePath: string): string | undefined {
  const base = templatePath.replace(VIDEO_PATTERN, "");
  for (const ext of DATA_EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Load companion data for a video template.
 *
 * Looks for `<name>.data.{ts,js,json}` next to `<name>.video.{ts,js}`.
 * - `.json` files are read and parsed directly
 * - `.ts`/`.js` files are bundled with esbuild and executed
 * - If the export is a function, it is called (supports async)
 *
 * Returns `undefined` if no companion file is found.
 */
export async function loadCompanionData(
  templatePath: string
): Promise<Record<string, unknown> | undefined> {
  const dataFile = findCompanionDataFile(resolve(templatePath));
  if (!dataFile) return undefined;

  if (dataFile.endsWith(".json")) {
    const raw = readFileSync(dataFile, "utf-8");
    return JSON.parse(raw);
  }

  const exported = await loadDataScript(dataFile);

  if (typeof exported === "function") {
    const result = await exported();
    return result as Record<string, unknown>;
  }

  if (typeof exported === "object" && exported !== null) {
    return exported as Record<string, unknown>;
  }

  return undefined;
}

export { findCompanionDataFile };
