//! Frame readiness helpers — pure + page-evaluate payload for Playwright capture.

import type { FrameReadinessPolicy } from "@superimg/types";

export const WAIT_ATTR = "data-superimg-wait";

export const DEFAULT_READINESS: Required<FrameReadinessPolicy> = {
  timeoutMs: 8000,
  waitImplicit: ["fonts", "images"],
};

export function resolveReadinessPolicy(
  policy?: FrameReadinessPolicy,
): Required<FrameReadinessPolicy> {
  const timeoutMs = policy?.timeoutMs ?? DEFAULT_READINESS.timeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new TypeError("Frame readiness timeout must be a positive finite timeout in milliseconds");
  }
  return {
    timeoutMs,
    waitImplicit: policy?.waitImplicit ?? DEFAULT_READINESS.waitImplicit,
  };
}

/** Collect unique non-empty data-superimg-wait labels from HTML (best-effort regex). */
export function collectWaitLabels(html: string): string[] {
  const re = /data-superimg-wait\s*=\s*["']([^"']+)["']/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const label = m[1]?.trim();
    if (label) seen.add(label);
  }
  return [...seen];
}

const READY_HINT =
  'Hint: img/video with data-superimg-wait auto-clear after load. ' +
  'For custom canvas/WebGL use std.ready.token("label") and run token.done after paint ' +
  '(NativeSurface handles readiness automatically). Do not await inside render().';

export function formatReadinessTimeout(
  openLabels: string[],
  timeoutMs: number,
  extraError?: string,
): string {
  const open = openLabels.length ? openLabels.join(", ") : "(unknown)";
  const base = `Frame readiness timeout (${timeoutMs}ms). Still waiting: ${open}`;
  const withExtra = extraError ? `${base}. ${extraError}` : base;
  return `${withExtra}. ${READY_HINT}`;
}

export function formatReadinessFail(openLabels: string[], error?: string): string {
  const open = openLabels.length ? openLabels.join(", ") : "(unknown)";
  const base = error
    ? `Frame readiness failed for: ${open}. ${error}`
    : `Frame readiness failed for: ${open}`;
  return `${base}. ${READY_HINT}`;
}

export interface ReadinessEvaluateInput {
  timeoutMs: number;
  waitFonts: boolean;
  waitImages: boolean;
  waitAttr: string;
}

export interface ReadinessEvaluateResult {
  ok: boolean;
  open: string[];
  error?: string;
}

/** The shared self-contained probe is also used by Player and browser export. */
export { waitForBrowserResources as readinessEvaluateInPage } from "@superimg/core/html";
