import { Player } from "../../../packages/superimg/dist/player.js";
import { preCache, snapdom } from "@zumer/snapdom";

const WIDTH = 320;
const HEIGHT = 180;

function fixtureHtml(kind: string): string {
  const base = `width:${WIDTH}px;height:${HEIGHT}px;position:relative;overflow:hidden;box-sizing:border-box`;
  switch (kind) {
    case "alpha":
      return `<div style="${base};background:transparent"><div style="position:absolute;inset:24px;background:rgba(30,100,220,.5)"></div></div>`;
    case "svg":
      return `<div style="${base};background:#fff"><svg width="320" height="180" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="180" fill="#fff"/><circle cx="100" cy="90" r="52" fill="#2563eb"/><rect x="170" y="45" width="90" height="90" rx="18" fill="#f97316"/></svg></div>`;
    case "transform":
      return `<div style="${base};background:#111827"><div style="position:absolute;width:150px;height:80px;left:85px;top:50px;transform:rotate(-8deg);clip-path:polygon(0 0,100% 12%,88% 100%,8% 88%);background:#22c55e"></div></div>`;
    case "image":
      return `<div style="${base};background:#f8fafc"><img width="160" height="100" style="position:absolute;left:80px;top:40px" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='100'%3E%3Crect width='160' height='100' rx='16' fill='%237c3aed'/%3E%3Ccircle cx='80' cy='50' r='24' fill='%23fff'/%3E%3C/svg%3E"/></div>`;
    case "media":
      return `<div style="${base};background:#020617"><div style="position:absolute;inset:20px;border:2px solid #38bdf8;background:linear-gradient(135deg,#0f172a,#1e293b)"><div style="position:absolute;left:126px;top:51px;width:32px;height:32px;background:#fff;clip-path:polygon(0 0,100% 50%,0 100%)"></div></div></div>`;
    default:
      return `<div style="${base};background:#0f172a"><div style="position:absolute;inset:24px;background:#e11d48;border-radius:20px;box-shadow:0 12px 24px rgba(0,0,0,.25)"></div></div>`;
  }
}

async function captureSnap(kind: string) {
  const fixture = document.getElementById("fixture")!;
  fixture.innerHTML = fixtureHtml(kind);
  await document.fonts.ready;
  const result = await snapdom(fixture.firstElementChild as HTMLElement, {
    width: WIDTH,
    height: HEIGHT,
    scale: 1,
    dpr: 1,
    embedFonts: false,
    backgroundColor: "transparent",
    cache: "auto",
    compress: false,
  });
  const canvas = await result.toCanvas();
  const image = canvas.getContext("2d")!.getImageData(0, 0, WIDTH, HEIGHT);
  return { width: image.width, height: image.height, data: Array.from(image.data) };
}

async function benchmarkPlayer(samples: number) {
  const host = document.getElementById("player")!;
  const template = {
    medium: "html" as const,
    animated: true as const,
    config: { width: WIDTH, height: HEIGHT, fps: 30, duration: 2 },
    render(ctx: { globalFrame: number }) {
      return `<div style="width:${WIDTH}px;height:${HEIGHT}px;background:#111827;color:#fff"><span data-frame="${ctx.globalFrame}">${ctx.globalFrame}</span></div>`;
    },
  };
  const player = new Player({ container: host, format: { width: WIDTH, height: HEIGHT } });
  const firstStarted = performance.now();
  const loaded = await player.load(template);
  if (loaded.status !== "success") throw new Error(loaded.message);
  const firstFrameMs = performance.now() - firstStarted;
  const scrubMs: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const started = performance.now();
    await player.render((i * 7) % 60);
    scrubMs.push(performance.now() - started);
  }
  player.dispose();
  host.innerHTML = "";
  return { firstFrameMs, scrubMs };
}

async function benchmarkSnapdom(samples: number) {
  const fixture = document.getElementById("fixture")!;
  fixture.innerHTML = fixtureHtml("opaque");
  const element = fixture.firstElementChild as HTMLElement;
  const coldStarted = performance.now();
  await captureSnap("opaque");
  const coldMs = performance.now() - coldStarted;
  await preCache(element, { embedFonts: false, cache: "full" });
  const warmMs: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const started = performance.now();
    await captureSnap("opaque");
    warmMs.push(performance.now() - started);
  }
  return { coldMs, warmMs };
}

Object.assign(window, {
  __superimgBench: {
    fixtureHtml,
    captureSnap,
    benchmarkPlayer,
    benchmarkSnapdom,
    setFixture(kind: string) {
      document.getElementById("fixture")!.innerHTML = fixtureHtml(kind);
    },
  },
});
