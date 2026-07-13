import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const engineState = vi.hoisted(() => ({
  initCount: 0,
  adapterCount: 0,
  disposeCount: 0,
  capture: async (html: string) => html,
}));

vi.mock("@superimg/node/internal", () => ({
  PlaywrightEngine: class {
    async init() { engineState.initCount += 1; }
    registerAsset(path: string) { return `http://assets.test/${encodeURIComponent(path)}`; }
    createAdapters() {
      engineState.adapterCount += 1;
      return {
        renderer: {
          init: async () => {},
          captureFrame: (html: string) => engineState.capture(html),
          dispose: async () => {},
        },
        encoder: {
          init: async () => {},
          addFrame: async () => {},
          finalize: async () => new Uint8Array([1, 2, 3]),
          dispose: async () => {},
        },
      };
    }
    async dispose() { engineState.disposeCount += 1; }
  },
}));

import { loadTemplate } from "./load-template.js";

describe("loadTemplate lifecycle", () => {
  let directory: string;
  let templatePath: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "superimg-load-template-test-"));
    templatePath = join(directory, "demo.media.ts");
    writeFileSync(templatePath, `
      import { define } from "superimg";
      export default define({
        config: { width: 100, height: 100, fps: 10, duration: 0.1 },
        render() { return "<main>demo</main>"; },
      });
    `);
    engineState.initCount = 0;
    engineState.adapterCount = 0;
    engineState.disposeCount = 0;
    engineState.capture = async (html) => html;
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("serializes shared-engine renders and rejects work after disposal", async () => {
    let releaseCapture!: () => void;
    const captureGate = new Promise<void>((resolve) => { releaseCapture = resolve; });
    let captureStarted!: () => void;
    const started = new Promise<void>((resolve) => { captureStarted = resolve; });
    let captures = 0;
    engineState.capture = async (html) => {
      captures += 1;
      if (captures === 1) {
        captureStarted();
        await captureGate;
      }
      return html;
    };

    const loaded = await loadTemplate(templatePath);
    const first = loaded.render();
    const second = loaded.render();
    await started;
    expect(engineState.initCount).toBe(1);
    expect(engineState.adapterCount).toBe(1);

    releaseCapture();
    await expect(Promise.all([first, second])).resolves.toEqual([
      new Uint8Array([1, 2, 3]),
      new Uint8Array([1, 2, 3]),
    ]);
    expect(engineState.adapterCount).toBe(2);

    await loaded.dispose();
    await loaded.dispose();
    expect(engineState.disposeCount).toBe(1);
    await expect(loaded.render()).rejects.toThrow(/disposed/);
  });

  it("cancels a render while it waits for the shared engine", async () => {
    let releaseCapture!: () => void;
    const captureGate = new Promise<void>((resolve) => { releaseCapture = resolve; });
    let captureStarted!: () => void;
    const started = new Promise<void>((resolve) => { captureStarted = resolve; });
    engineState.capture = async (html) => {
      captureStarted();
      await captureGate;
      return html;
    };

    const loaded = await loadTemplate(templatePath);
    const first = loaded.render();
    await started;
    const controller = new AbortController();
    const queued = loaded.render({ signal: controller.signal });
    controller.abort();

    await expect(queued).rejects.toMatchObject({ code: "aborted" });
    expect(engineState.adapterCount).toBe(1);
    releaseCapture();
    await first;
    await loaded.dispose();
  });
});
