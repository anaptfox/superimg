import { describe, expect, it } from "vitest";
import { Output, BufferTarget, WebMOutputFormat, VideoSampleSource, VideoSample, Quality } from "mediabunny";
import { SnapdomCaptureBackend } from "./capture.js";

function pixel(image: ImageData, x: number, y: number): readonly number[] {
  const offset = (y * image.width + x) * 4;
  return Array.from(image.data.slice(offset, offset + 4));
}

describe("SnapDOM capture in Chromium", () => {
  it("captures text, SVG, and canvas pixels with explicit CSS-region dimensions", async () => {
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;left:0;top:0;box-sizing:border-box;width:120px;height:80px;background:#102030;color:white;font:20px sans-serif;padding:10px";
    root.innerHTML = "<span>Glass</span><svg width=24 height=24><circle cx=12 cy=12 r=10 fill=red /></svg>";
    const canvas = document.createElement("canvas");
    canvas.width = 20;
    canvas.height = 20;
    canvas.getContext("2d")!.fillStyle = "lime";
    canvas.getContext("2d")!.fillRect(0, 0, 20, 20);
    root.append(canvas);
    document.body.append(root);

    const image = await new SnapdomCaptureBackend().capture(root, {
      width: 120,
      height: 80,
      dpr: 1,
      region: { x: 0, y: 0, width: 60, height: 40 },
    });
    expect(image.width).toBe(60);
    expect(image.height).toBe(40);
    expect(pixel(image, 2, 2)).toEqual([16, 32, 48, 255]);
    expect(pixel(image, 30, 30)[3]).toBe(255);
    root.remove();
  });

  it("keeps cached and uncached captures fresh when canvas pixels change", async () => {
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;left:0;top:0;width:16px;height:16px";
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    root.append(canvas);
    document.body.append(root);
    const context = canvas.getContext("2d")!;
    const backend = new SnapdomCaptureBackend();
    context.fillStyle = "red";
    context.fillRect(0, 0, 16, 16);
    const red = await backend.capture(root, { width: 16, height: 16, dpr: 1, burst: true });
    context.fillStyle = "blue";
    context.fillRect(0, 0, 16, 16);
    const blue = await backend.capture(root, { width: 16, height: 16, dpr: 1, burst: true });
    expect(pixel(red, 4, 4)).not.toEqual(pixel(blue, 4, 4));
    await backend.dispose();
    root.remove();
  });

  it("captures transformed SVG/text and glass backdrop pixels", async () => {
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;left:0;top:0;width:80px;height:60px;background:repeating-linear-gradient(45deg,#102040 0 4px,#8090c0 4px 8px);color:white";
    root.innerHTML = `<div style="position:absolute;inset:8px;background:rgba(255,255,255,.25);backdrop-filter:blur(2px);transform:rotate(-4deg);font:18px sans-serif">Backdrop</div><svg width="30" height="30" style="transform:translate(35px,20px)"><rect width="30" height="30" fill="#00ff00"/></svg>`;
    document.body.append(root);
    const image = await new SnapdomCaptureBackend().capture(root, { width: 80, height: 60, dpr: 1, reconcile: true });
    expect(image.width).toBe(80);
    expect(image.height).toBe(60);
    const greenMaximum = Math.max(...Array.from(image.data).filter((_value, index) => index % 4 === 1));
    const greenMinimum = Math.min(...Array.from(image.data).filter((_value, index) => index % 4 === 1));
    expect(greenMaximum).toBeGreaterThan(100);
    expect(greenMaximum - greenMinimum).toBeGreaterThan(20);
    expect(Array.from(image.data).some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
    root.remove();
  });

  it("honors DPR for a clipped region and keeps live WebGL and video pixels fresh", async () => {
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;left:0;top:0;width:32px;height:32px";
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    root.append(canvas);
    document.body.append(root);
    const context = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    expect(context).not.toBeNull();
    const backend = new SnapdomCaptureBackend();
    context!.clearColor(1, 0, 0, 1);
    context!.clear(context!.COLOR_BUFFER_BIT);
    const first = await backend.capture(root, { width: 32, height: 32, dpr: 2, region: { x: 4, y: 4, width: 12, height: 12 }, burst: true });
    context!.clearColor(0, 0, 1, 1);
    context!.clear(context!.COLOR_BUFFER_BIT);
    const second = await backend.capture(root, { width: 32, height: 32, dpr: 2, region: { x: 4, y: 4, width: 12, height: 12 }, burst: true });
    expect(first.width).toBe(24);
    expect(first.height).toBe(24);
    expect(pixel(first, 8, 8)).not.toEqual(pixel(second, 8, 8));
    const source = document.createElement("canvas");
    source.width = 32;
    source.height = 32;
    const sourceContext = source.getContext("2d")!;
    const video = document.createElement("video");
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.autoplay = false;
    video.style.cssText = "width:32px;height:32px";
    const target = new BufferTarget();
    const output = new Output({ format: new WebMOutputFormat(), target });
    const frames = new VideoSampleSource({ codec: "vp9", quality: new Quality("high") });
    output.addVideoTrack(frames);
    await output.start();
    for (const [timestamp, color] of ["red", "lime"].entries()) {
      sourceContext.fillStyle = color;
      sourceContext.fillRect(0, 0, 32, 32);
      const frame = new VideoSample(source, { timestamp, duration: 1 });
      try { await frames.add(frame); } finally { frame.close(); }
    }
    await output.finalize();
    const url = URL.createObjectURL(new Blob([target.buffer!], { type: "video/webm" }));
    root.replaceChildren(video);
    const loaded = new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video fixture could not decode"));
    });
    video.src = url;
    await loaded;
    const seek = (time: number) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("video seek timed out")), 3000);
      video.onseeked = () => { clearTimeout(timer); resolve(); };
      video.currentTime = time;
    });
    try {
      await seek(0.1);
      const videoFirst = await backend.capture(root, { width: 32, height: 32, dpr: 1, burst: true });
      await seek(1.1);
      const videoSecond = await backend.capture(root, { width: 32, height: 32, dpr: 1, burst: true });
      const videoSecondUncached = await backend.capture(root, { width: 32, height: 32, dpr: 1 });
      expect(pixel(videoFirst, 8, 8)[0]).toBeGreaterThan(200);
      expect(pixel(videoSecond, 8, 8)[1]).toBeGreaterThan(200);
      expect(pixel(videoFirst, 8, 8)).not.toEqual(pixel(videoSecond, 8, 8));
      expect(Array.from(videoSecond.data)).toEqual(Array.from(videoSecondUncached.data));
    } finally { video.pause(); video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url); }
    await backend.dispose();
    root.remove();
  });

  it("measures repeated cached and uncached captures on one fixture", async () => {
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;left:0;top:0;width:48px;height:48px;background:#345";
    root.textContent = "capture benchmark";
    document.body.append(root);
    const backend = new SnapdomCaptureBackend();
    const measure = async (burst: boolean) => {
      const samples: number[] = [];
      for (let i = 0; i < 4; i += 1) {
        const start = performance.now();
        await backend.capture(root, { width: 48, height: 48, dpr: 1, burst, fast: true });
        samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      return samples[Math.floor(samples.length / 2)]!;
    };
    const uncachedMedianMs = await measure(false);
    const cachedMedianMs = await measure(true);
    console.warn(JSON.stringify({ captureBenchmark: { uncachedMedianMs, cachedMedianMs, samples: 4 } }));
    expect(uncachedMedianMs).toBeGreaterThan(0);
    expect(cachedMedianMs).toBeGreaterThan(0);
    await backend.dispose();
    root.remove();
  });

  it("rejects capture after disposal", async () => {
    const root = document.createElement("div");
    const backend = new SnapdomCaptureBackend();
    await backend.dispose();
    await expect(backend.capture(root, { width: 1, height: 1 })).rejects.toThrow(/disposed/i);
  });
});
