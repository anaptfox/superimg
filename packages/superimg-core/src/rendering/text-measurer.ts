//! Parse resolved faces once per byte hash and build a layout measurer.

import { createTextMeasurer, parseFontMetrics, type FontMetrics, type TextMeasurer } from "@superimg/stdlib/svg";
import { sha256Hex } from "../ir/pure/sha256.js";
import type { ResolvedFont } from "./fonts.js";

export interface MetricFontSource {
  family: string;
  weight?: number;
  style?: "normal" | "italic";
  data: Uint8Array;
}

const parsedFonts = new Map<string, FontMetrics | null>();

export function textMeasurerFromFaces(faces: readonly MetricFontSource[]): TextMeasurer | undefined {
  const ready: { family: string; weight: number; style: "normal" | "italic"; metrics: FontMetrics }[] = [];
  for (const face of faces) {
    const metrics = metricsFor(face.data);
    if (!metrics) continue;
    ready.push({
      family: face.family,
      weight: face.weight ?? 400,
      style: face.style === "italic" ? "italic" : "normal",
      metrics,
    });
  }
  return ready.length > 0 ? createTextMeasurer(ready) : undefined;
}

/** Preserve the resolved-font entry point for callers holding prepared faces. */
export function textMeasurerFromResolved(faces: readonly ResolvedFont[]): TextMeasurer | undefined {
  return textMeasurerFromFaces(faces);
}

const planMeasurers = new WeakMap<object, TextMeasurer>();

export function rememberPlanMeasurer(plan: object, measurer: TextMeasurer | undefined): void {
  if (measurer) planMeasurers.set(plan, measurer);
}

export function measurerForPlan(plan: object): TextMeasurer | undefined {
  return planMeasurers.get(plan);
}

function metricsFor(data: Uint8Array): FontMetrics | null {
  const hash = sha256Hex(data);
  const cached = parsedFonts.get(hash);
  if (cached !== undefined) return cached;
  let metrics: FontMetrics | null;
  try {
    metrics = parseFontMetrics(data);
  } catch {
    metrics = null;
  }
  parsedFonts.set(hash, metrics);
  return metrics;
}
