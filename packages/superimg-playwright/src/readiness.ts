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
  return {
    timeoutMs: policy?.timeoutMs ?? DEFAULT_READINESS.timeoutMs,
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
  '(or std.viz.three.scene which auto-wires). Do not await inside render().';

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

/**
 * Runs inside Playwright page.evaluate after frame HTML is injected.
 * Must be self-contained (no outer closures).
 */
export async function readinessEvaluateInPage(
  input: ReadinessEvaluateInput,
): Promise<ReadinessEvaluateResult> {
  const ready = (
    window as unknown as {
      __superimgReady?: {
        done: (label: string) => void;
        fail: (label: string, err?: string) => void;
        __reset: () => void;
        __wait: (
          labels: string[],
          timeoutMs: number,
        ) => Promise<{ ok: boolean; open: string[]; error?: string }>;
      };
    }
  ).__superimgReady;

  if (!ready) {
    return {
      ok: false,
      open: [],
      error: "window.__superimgReady missing — page shell not loaded",
    };
  }

  // Do not __reset() here — captureFrame already resets before injecting HTML and
  // running scripts. Resetting after would erase synchronous done() from three/canvas.

  const root = document.getElementById("frame");
  if (!root) {
    return { ok: false, open: [], error: "#frame element missing" };
  }

  if (input.waitFonts && document.fonts?.ready) {
    await document.fonts.ready;
  }

  async function decodeImg(img: HTMLImageElement): Promise<void> {
    if (img.complete && img.naturalWidth > 0) return;
    if (typeof img.decode === "function") {
      try {
        await img.decode();
        return;
      } catch {
        // fall through to load/error events
      }
    }
    if (img.complete) return;
    await new Promise<void>((resolve) => {
      const done = () => {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
        resolve();
      };
      img.addEventListener("load", done);
      img.addEventListener("error", done);
    });
  }

  const labeled = root.querySelectorAll<HTMLElement>(`[${input.waitAttr}]`);
  const labels: string[] = [];
  const labelSet = new Set<string>();

  for (const el of labeled) {
    const label = el.getAttribute(input.waitAttr)?.trim();
    if (!label || labelSet.has(label)) continue;
    labelSet.add(label);
    labels.push(label);

    // Auto-clear labels on static media so authors need not call done().
    if (el instanceof HTMLImageElement) {
      void decodeImg(el).then(
        () => ready.done(label),
        () => ready.done(label), // still clear so timeout isn't infinite on broken src
      );
    } else if (el instanceof HTMLVideoElement) {
      const v = el;
      const mark = () => ready.done(label);
      if (v.readyState >= 2) mark();
      else {
        v.addEventListener("loadeddata", mark, { once: true });
        v.addEventListener("error", mark, { once: true });
      }
    }
    // canvas / other: author must call __superimgReady.done(label)
  }

  if (input.waitImages) {
    const imgs = root.querySelectorAll("img");
    await Promise.all(Array.from(imgs).map((img) => decodeImg(img as HTMLImageElement)));
  }

  if (labels.length === 0) {
    return { ok: true, open: [] };
  }

  const result = await ready.__wait(labels, input.timeoutMs);
  return {
    ok: result.ok,
    open: result.open ?? [],
    ...(result.error !== undefined ? { error: result.error } : {}),
  };
}
