import { afterEach, describe, expect, it, vi } from "vitest";
import { installSuperimgReady } from "@superimg/core/html";
import {
  WAIT_ATTR,
  collectWaitLabels,
  formatReadinessFail,
  formatReadinessTimeout,
  readinessEvaluateInPage,
  resolveReadinessPolicy,
} from "./readiness.js";

describe("resolveReadinessPolicy", () => {
  it("defaults to fonts+images and 8000ms", () => {
    expect(resolveReadinessPolicy()).toEqual({
      timeoutMs: 8000,
      waitImplicit: ["fonts", "images"],
    });
  });

  it("merges partial policy", () => {
    expect(resolveReadinessPolicy({ timeoutMs: 1000, waitImplicit: ["fonts"] })).toEqual({
      timeoutMs: 1000,
      waitImplicit: ["fonts"],
    });
  });
});

describe("collectWaitLabels", () => {
  it("collects unique labels", () => {
    const html = `
      <img data-superimg-wait="hero" src="a.png" />
      <canvas data-superimg-wait='gl'></canvas>
      <div data-superimg-wait="hero"></div>
    `;
    expect(collectWaitLabels(html).sort()).toEqual(["gl", "hero"]);
  });

  it("returns empty when none", () => {
    expect(collectWaitLabels("<div>hi</div>")).toEqual([]);
  });
});

describe("formatReadinessTimeout", () => {
  it("names open labels", () => {
    const msg = formatReadinessTimeout(["hero", "gl"], 8000);
    expect(msg).toContain("8000ms");
    expect(msg).toContain("hero, gl");
  });
});

describe("formatReadinessFail", () => {
  it("includes error detail", () => {
    expect(formatReadinessFail(["gl"], "WebGL init failed")).toContain("WebGL init failed");
    expect(formatReadinessFail(["gl"], "WebGL init failed")).toContain("gl");
  });
});

describe("WAIT_ATTR", () => {
  it("is stable public attribute name", () => {
    expect(WAIT_ATTR).toBe("data-superimg-wait");
  });
});

/**
 * Minimal document/window stub for readinessEvaluateInPage (node env, no happy-dom).
 * Uses plain canvas-like nodes so instanceof HTMLImageElement/Video is false.
 */
function installFrameDom(opts: {
  labels: { tag: string; label: string }[];
  ready: ReturnType<typeof installSuperimgReady>;
}) {
  class FakeHTMLImageElement {}
  class FakeHTMLVideoElement {}

  const children = opts.labels.map(({ tag, label }) => ({
    tagName: tag.toUpperCase(),
    getAttribute: (name: string) => (name === WAIT_ATTR ? label : null),
  }));

  const root = {
    querySelectorAll: (sel: string) => {
      if (sel.includes("data-superimg-wait")) {
        return children as unknown as NodeListOf<HTMLElement>;
      }
      if (sel === "img") return [] as unknown as NodeListOf<HTMLImageElement>;
      return [] as unknown as NodeListOf<HTMLElement>;
    },
  };

  const prev = {
    window: (globalThis as { window?: unknown }).window,
    document: (globalThis as { document?: unknown }).document,
    HTMLImageElement: (globalThis as { HTMLImageElement?: unknown }).HTMLImageElement,
    HTMLVideoElement: (globalThis as { HTMLVideoElement?: unknown }).HTMLVideoElement,
  };

  (globalThis as { HTMLImageElement: unknown }).HTMLImageElement = FakeHTMLImageElement;
  (globalThis as { HTMLVideoElement: unknown }).HTMLVideoElement = FakeHTMLVideoElement;
  (globalThis as { window: { __superimgReady: typeof opts.ready } }).window = {
    __superimgReady: opts.ready,
  };
  (globalThis as {
    document: { getElementById: (id: string) => typeof root | null };
  }).document = {
    getElementById: (id: string) => (id === "frame" ? root : null),
  };

  return () => {
    const g = globalThis as Record<string, unknown>;
    if (prev.window === undefined) delete g.window;
    else g.window = prev.window;
    if (prev.document === undefined) delete g.document;
    else g.document = prev.document;
    if (prev.HTMLImageElement === undefined) delete g.HTMLImageElement;
    else g.HTMLImageElement = prev.HTMLImageElement;
    if (prev.HTMLVideoElement === undefined) delete g.HTMLVideoElement;
    else g.HTMLVideoElement = prev.HTMLVideoElement;
  };
}

describe("readinessEvaluateInPage — sync done before wait", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call __reset (would wipe sync done from inject scripts)", async () => {
    const ready = installSuperimgReady();
    const resetSpy = vi.spyOn(ready, "__reset");
    ready.done("three-gl");

    const cleanup = installFrameDom({
      labels: [{ tag: "canvas", label: "three-gl" }],
      ready,
    });
    try {
      const result = await readinessEvaluateInPage({
        timeoutMs: 200,
        waitFonts: false,
        waitImages: false,
        waitAttr: WAIT_ATTR,
      });
      expect(resetSpy).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
      expect(result.open).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("succeeds when canvas label was done before evaluate (correct capture order)", async () => {
    const ready = installSuperimgReady();
    // captureFrame order: reset → script done → readinessEvaluateInPage
    ready.__reset();
    ready.done("three-gl");

    const cleanup = installFrameDom({
      labels: [{ tag: "canvas", label: "three-gl" }],
      ready,
    });
    try {
      const result = await readinessEvaluateInPage({
        timeoutMs: 100,
        waitFonts: false,
        waitImages: false,
        waitAttr: WAIT_ATTR,
      });
      expect(result).toMatchObject({ ok: true, open: [] });
    } finally {
      cleanup();
    }
  });

  it("would hang if reset after done (documents the bug we fixed)", async () => {
    const ready = installSuperimgReady();
    ready.__reset();
    ready.done("three-gl");
    ready.__reset(); // simulate old readinessEvaluateInPage first line

    const cleanup = installFrameDom({
      labels: [{ tag: "canvas", label: "three-gl" }],
      ready,
    });
    try {
      const result = await readinessEvaluateInPage({
        timeoutMs: 40,
        waitFonts: false,
        waitImages: false,
        waitAttr: WAIT_ATTR,
      });
      expect(result.ok).toBe(false);
      expect(result.open).toContain("three-gl");
    } finally {
      cleanup();
    }
  });
});
