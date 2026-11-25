//! Async face resolution for callers that do not already hold font bytes.
//! Kept off the pure HTML render closure, which must not see font loading.

import type { TextMeasurer } from "@superimg/stdlib/svg";
import { resolveRuntimeFonts } from "./fonts.js";
import { textMeasurerFromFaces, type MetricFontSource } from "./text-measurer.js";

export async function textMeasurerForDeclarations(
  fonts: readonly unknown[] | undefined,
  signal?: AbortSignal,
): Promise<TextMeasurer | undefined> {
  const resolved = await resolveRuntimeFonts(fonts, signal !== undefined ? { signal } : {});
  const faces: MetricFontSource[] = resolved.faces.map((face) => ({
    family: face.family,
    weight: face.weight,
    style: face.style,
    data: face.data,
  }));
  return textMeasurerFromFaces(faces);
}
