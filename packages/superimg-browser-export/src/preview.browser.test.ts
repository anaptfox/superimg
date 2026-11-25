import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserRenderer } from "./preview.js";

let renderer: BrowserRenderer | undefined;
afterEach(async () => { await renderer?.dispose(); renderer = undefined; vi.restoreAllMocks(); });

async function createRenderer(options: { cache?: boolean; timeoutMs?: number; inlineCss?: string[] } = {}) {
  renderer = new BrowserRenderer();
  await renderer.init({
    width: 128, height: 64, format: "png",
    capture: { dpr: 1, ...(options.cache !== undefined ? { cache: options.cache } : {}) },
    readiness: { timeoutMs: options.timeoutMs ?? 2000 },
    ...(options.inlineCss !== undefined ? { inlineCss: options.inlineCss } : {}),
  });
  return renderer;
}

// SnapDOM 3 owns a separate shared decoder iframe; inspect only the renderer document.
function rendererFrame() {
  return document.querySelector<HTMLIFrameElement>("iframe:not([data-snapdom-internal])");
}

function pixel(image: ImageData, x: number, y: number) {
  const offset = (y * image.width + x) * 4;
  return Array.from(image.data.slice(offset, offset + 4));
}

describe("BrowserRenderer capture contract in Chromium", () => {
  it.each([
    '<script>document.body.style.background="red"</script>',
    '<script type="module">export {}</script>',
    '<svg><script href="scene.js"></script></svg>',
    '<img onload="draw()" src="logo.png">',
  ])("rejects unsupported executable markup before capture: %s", async (html) => {
    const capture = await createRenderer();
    await expect(capture.captureFrame(html)).rejects.toMatchObject({ code: "BROWSER_EXECUTABLE_MARKUP_UNSUPPORTED" });
    expect(rendererFrame()?.contentDocument?.getElementById("frame")?.childElementCount).toBe(0);
  });

  it("allows inert JSON script data", async () => {
    const capture = await createRenderer();
    const image = await capture.captureFrame('<script type="application/json">{"color":"red"}</script><div style="width:128px;height:64px;background:red"></div>');
    expect(pixel(image, 4, 4)).toEqual([255, 0, 0, 255]);
  });

  it("samples finite and looping CSS animation pixels at exact time, including reverse seeks", async () => {
    const capture = await createRenderer();
    const html = `<style>@keyframes slide { from { transform:translateX(0) } to { transform:translateX(96px) } }
      .box { position:absolute;left:0;width:16px;height:16px;animation:slide 1s linear forwards }
      </style><div class="box" style="top:0;background:red"></div><div class="box" style="top:32px;background:blue;animation-iteration-count:infinite"></div>`;
    for (const [time, left] of [[0.75, 72], [0.25, 24], [1 / 3, 32]] as const) {
      const image = await capture.captureFrame(html, { time });
      expect(pixel(image, left + 4, 4)).toEqual([255, 0, 0, 255]);
      expect(pixel(image, left + 4, 36)).toEqual([0, 0, 255, 255]);
      expect(pixel(image, 4, 4)).toEqual([0, 0, 0, 255]);
    }
  });

  it("reuses unchanged captures with cache:true and invalidates changed pixels", async () => {
    const capture = await createRenderer({ cache: true });
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
    const html = '<div style="width:128px;height:64px;background:red"></div>';
    const first = await capture.captureFrame(html);
    const canvasCalls = getContext.mock.calls.length;
    expect(canvasCalls).toBeGreaterThan(0);
    const second = await capture.captureFrame(html);
    expect(getContext.mock.calls.length).toBe(canvasCalls);
    expect(Array.from(second.data)).toEqual(Array.from(first.data));
    const third = await capture.captureFrame(html.replace("red", "blue"));
    expect(getContext.mock.calls.length).toBeGreaterThan(canvasCalls);
    expect(pixel(third, 4, 4)).toEqual([0, 0, 255, 255]);
  });

  it.each(["svg-image", "mask", "pseudo-image"])("keeps %s resource pixels live even when markup is unchanged", async (kind) => {
    const capture = await createRenderer({ cache: true });
    const url = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>')}`;
    const html = kind === "svg-image"
      ? `<svg width="32" height="32"><image href="${url}" width="32" height="32"/></svg>`
      : kind === "mask"
        ? `<div style="width:32px;height:32px;background:red;mask-image:url('${url}')"></div>`
        : `<style>.resource::before{content:url('${url}')}</style><div class="resource"></div>`;
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
    await capture.captureFrame(html);
    const canvasCalls = getContext.mock.calls.length;
    expect(canvasCalls).toBeGreaterThan(0);
    await capture.captureFrame(html);
    expect(getContext.mock.calls.length).toBeGreaterThan(canvasCalls);
  });

  it.each([
    '<img src="data:image/png;base64,broken">',
    '<div style="width:32px;height:32px;background-image:url(data:image/png;base64,broken)"></div>',
    '<svg><image href="data:image/png;base64,broken" width="32" height="32"/></svg>',
  ])("fails required image decode and discards its frame document: %s", async (html) => {
    const capture = await createRenderer();
    await expect(capture.captureFrame(html)).rejects.toThrow(/image|resource failed/i);
    expect(rendererFrame()).toBeNull();
  });

  it("fails an unusable required font", async () => {
    const capture = await createRenderer();
    await expect(capture.captureFrame('<style>@font-face{font-family:Broken;src:url(data:font/ttf;base64,broken)}</style><div style="font-family:Broken">Required font</div>')).rejects.toThrow(/font failed/i);
    expect(rendererFrame()).toBeNull();
  });

  it("bounds a stalled font task and removes the frame document", async () => {
    const capture = await createRenderer({ timeoutMs: 150 });
    const doc = rendererFrame()!.contentDocument!;
    vi.spyOn(doc.fonts, "ready", "get").mockReturnValue(new Promise(() => {}));
    await expect(capture.captureFrame("<div>Waiting</div>")).rejects.toMatchObject({ code: "deadline_exceeded" });
    expect(rendererFrame()).toBeNull();
  });

  it("actively cancels resource readiness and can initialize a fresh session", async () => {
    const capture = await createRenderer();
    const doc = rendererFrame()!.contentDocument!;
    vi.spyOn(doc.fonts, "ready", "get").mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const pending = capture.captureFrame("<div>Waiting</div>", { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ code: "aborted" });
    controller.abort();
    await rejected;
    expect(rendererFrame()).toBeNull();
    await capture.init({ width: 16, height: 16, capture: { dpr: 1 } });
    const image = await capture.captureFrame('<div style="width:16px;height:16px;background:lime"></div>');
    expect(pixel(image, 4, 4)).toEqual([0, 255, 0, 255]);
  });

  it("rejects unsupported color space and runtime Tailwind before creating a document", async () => {
    renderer = new BrowserRenderer();
    await expect(renderer.init({ width: 16, height: 16, capture: { colorProfile: "display-p3" } })).rejects.toThrow(/Display-P3/);
    await expect(renderer.init({ width: 16, height: 16, tailwind: true })).rejects.toMatchObject({ code: "BROWSER_EXECUTABLE_MARKUP_UNSUPPORTED" });
    expect(rendererFrame()).toBeNull();
  });
});
