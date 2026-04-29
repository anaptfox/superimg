//! Validate that asset file paths exist before render

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { BackgroundValue, AudioValue } from "@superimg/types";

function isColorOrUrl(src: string): boolean {
  const s = src.trim();
  if (!s) return true;
  if (s.startsWith("#")) return true;
  if (s.startsWith("rgb(") || s.startsWith("rgba(")) return true;
  if (s.startsWith("hsl(") || s.startsWith("hsla(")) return true;
  if (s.startsWith("http://") || s.startsWith("https://")) return true;
  if (s.startsWith("data:")) return true;
  return false;
}

function getAssetSrc(value: BackgroundValue | AudioValue | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.src;
}

/**
 * Validate that file-path assets exist. Colors and URLs are skipped.
 * Throws with a clear error if a referenced file is missing.
 */
export function validateAssets(
  background: BackgroundValue | undefined,
  audio: AudioValue | undefined,
  baseDir: string
): void {
  const bgSrc = getAssetSrc(background);
  if (bgSrc && !isColorOrUrl(bgSrc)) {
    const abs = resolve(baseDir, bgSrc);
    if (!existsSync(abs)) {
      throw new Error(
        `Background asset not found: ${bgSrc}\n  Resolved to: ${abs}\n  Base directory: ${baseDir}`
      );
    }
  }

  const audioSrc = getAssetSrc(audio);
  if (audioSrc && !isColorOrUrl(audioSrc)) {
    const abs = resolve(baseDir, audioSrc);
    if (!existsSync(abs)) {
      throw new Error(
        `Audio asset not found: ${audioSrc}\n  Resolved to: ${abs}\n  Base directory: ${baseDir}`
      );
    }
  }
}
