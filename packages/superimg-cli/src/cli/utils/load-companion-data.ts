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
 * Assert that companion data is a plain object or array — not a primitive.
 * Primitive exports (string, number, boolean, null) cannot be merged into
 * ctx.data and would silently corrupt the render context.
 */
function assertCompanionDataShape(value: unknown, dataFile: string): void {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    throw new Error(
      `Companion data file "${dataFile}" exported a ${value === null ? "null" : typeof value} — ` +
      `expected a plain object (e.g. { title: "..." }) or an array of objects. ` +
      `Primitive exports cannot be merged into the render context.`
    );
  }
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
 * Throws if the resolved value is a primitive (not an object or array).
 */
export async function loadCompanionData(
  templatePath: string
): Promise<unknown | undefined> {
  const dataFile = findCompanionDataFile(resolve(templatePath));
  if (!dataFile) return undefined;

  if (dataFile.endsWith(".json")) {
    const raw = readFileSync(dataFile, "utf-8");
    const parsed = JSON.parse(raw);
    assertCompanionDataShape(parsed, dataFile);
    return parsed;
  }

  const exported = await loadDataScript(dataFile);

  let result: unknown;
  if (typeof exported === "function") {
    result = await exported();
  } else {
    result = exported;
  }

  assertCompanionDataShape(result, dataFile);
  return result;
}

export { findCompanionDataFile };
