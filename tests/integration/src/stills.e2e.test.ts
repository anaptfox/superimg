import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { Fill, Frame, Html, Stack, Text, image, ogImage } from "@foxworth/superimg";
import { render, shutdown } from "@foxworth/superimg/runtime";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const indexUrl = pathToFileURL(join(repoRoot, "packages", "superimg", "dist", "index.js")).href;
const runtimeUrl = pathToFileURL(join(repoRoot, "packages", "superimg", "dist", "runtime.node.js")).href;
const cliPkg = join(repoRoot, "packages", "superimg-cli", "package.json");

const script = `
import { createRequire } from "node:module";
import { Fill, Frame, Html, Stack, Text, image, ogImage } from ${JSON.stringify(indexUrl)};
import { render } from ${JSON.stringify(runtimeUrl)};
const require = createRequire(${JSON.stringify(cliPkg)});
const sharp = require("sharp");

const og = ogImage({
  sample: { title: "Lane Title" },
  render(ctx) {
    return Frame(
      { width: "fill", height: "fill" },
      Fill({ gradient: { kind: "linear", at: "to bottom", stops: ["#102030 0%", "#203040 100%"] } }),
      Stack(
        { width: "fill", height: "fill", align: "center", justify: "center" },
        Text({ variant: "display", color: "#ffffff" }, ctx.data.title),
      ),
    );
  },
});

const png = await render(og, { as: "png" });
const pngBytes = await png.bytes();
const view = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
const size = { width: view.getUint32(16), height: view.getUint32(20) };
const raw = await sharp(Buffer.from(pngBytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let ink = 0;
const x0 = Math.floor(raw.info.width * 0.25);
const x1 = Math.floor(raw.info.width * 0.75);
const y0 = Math.floor(raw.info.height * 0.35);
const y1 = Math.floor(raw.info.height * 0.65);
for (let y = y0; y < y1; y++) {
  for (let x = x0; x < x1; x++) {
    const index = (y * raw.info.width + x) * raw.info.channels;
    const red = raw.data[index] ?? 0;
    const green = raw.data[index + 1] ?? 0;
    const blue = raw.data[index + 2] ?? 0;
    if (red + green + blue > 500) ink += 1;
  }
}

const svg = await (await render(og, { as: "svg" })).text();

const wrapped = image({
  size: { width: 600, height: 300 },
  background: "#111111",
  sample: { title: "A very long title that has to wrap inside the padded canvas before it reaches the edge" },
  render(ctx) {
    return Frame(
      { width: "fill", height: "fill" },
      Stack(
        { width: "fill", height: "fill", align: "center", justify: "center", pad: 48 },
        Text({ variant: "title", color: "#ffffff" }, ctx.data.title),
      ),
    );
  },
});
const wrapBytes = await (await render(wrapped, { as: "png" })).bytes();
const wrapRaw = await sharp(Buffer.from(wrapBytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const edge = [];
for (let y = 0; y < wrapRaw.info.height; y++) {
  for (let x = 0; x < wrapRaw.info.width; x++) {
    if (x >= 20 && x < wrapRaw.info.width - 20) continue;
    const index = (y * wrapRaw.info.width + x) * wrapRaw.info.channels;
    const red = wrapRaw.data[index] ?? 0;
    const green = wrapRaw.data[index + 1] ?? 0;
    const blue = wrapRaw.data[index + 2] ?? 0;
    if (red > 128 && green > 128 && blue > 128) edge.push({ x, y });
  }
}
const bands = [];
let bandStart;
for (let y = 0; y < wrapRaw.info.height; y++) {
  let bright = false;
  for (let x = 0; x < wrapRaw.info.width; x++) {
    const index = (y * wrapRaw.info.width + x) * wrapRaw.info.channels;
    if ((wrapRaw.data[index] ?? 0) > 200) { bright = true; break; }
  }
  if (bright && bandStart === undefined) bandStart = y;
  if (!bright && bandStart !== undefined) {
    bands.push({ start: bandStart, end: y - 1 });
    bandStart = undefined;
  }
}
if (bandStart !== undefined) bands.push({ start: bandStart, end: wrapRaw.info.height - 1 });

const htmlCard = image({
  size: { width: 64, height: 64 },
  render() { return Html({ html: "<div>browser</div>" }); },
});
let htmlCode = null;
try {
  await render(htmlCard, { as: "png" });
} catch (error) {
  htmlCode = error && typeof error === "object" ? error.code ?? null : null;
}

console.log(JSON.stringify({
  width: size.width,
  height: size.height,
  ink,
  svgStarts: svg.startsWith("<svg"),
  svgHasText: svg.includes("<text"),
  svgHasTitle: svg.includes("Lane Title"),
  htmlCode,
  wrapWidth: wrapRaw.info.width,
  wrapHeight: wrapRaw.info.height,
  edge: edge.length,
  bands: bands.length,
}));
`;

describe("svg lane stills", () => {
  let emptyBrowsers: string | undefined;

  afterAll(async () => {
    await shutdown();
    if (emptyBrowsers !== undefined) await rm(emptyBrowsers, { recursive: true, force: true });
  });

  it("paints an og card without chromium and refuses an Html still", async () => {
    emptyBrowsers = await mkdtemp(join(repoRoot, "tests/integration/.e2e-browsers-"));
    const result = await runNode(script, {
      ...process.env,
      SUPERIMG_BROWSERS_PATH: emptyBrowsers,
    });
    const parsed = JSON.parse(result.stdout) as {
      width: number;
      height: number;
      ink: number;
      svgStarts: boolean;
      svgHasText: boolean;
      svgHasTitle: boolean;
      htmlCode: string | null;
      wrapWidth: number;
      wrapHeight: number;
      edge: number;
      bands: number;
    };

    expect(result.code, result.stderr).toBe(0);
    expect(parsed.width).toBe(1200);
    expect(parsed.height).toBe(630);
    expect(parsed.ink).toBeGreaterThan(20);
    expect(parsed.svgStarts).toBe(true);
    expect(parsed.svgHasText).toBe(true);
    expect(parsed.svgHasTitle).toBe(true);
    expect(parsed.htmlCode).toBe("CHROMIUM_MISSING");
    expect(parsed.wrapWidth).toBe(600);
    expect(parsed.wrapHeight).toBe(300);
    expect(parsed.edge).toBe(0);
    expect(parsed.bands).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it("keeps a tight display title above the following caption", async () => {
    const card = ogImage({
      size: { width: 640, height: 360 },
      render() {
        return Frame(
          { width: "fill", height: "fill" },
          Fill({ color: "#000000" }),
          Stack(
            { width: "fill", pad: 32, gap: 0 },
            Text(
              { variant: "display", size: 96, lineHeight: 0.95, weight: 400, color: "#ffffff" },
              "SuperImg",
            ),
            Text(
              { variant: "caption", size: 28, lineHeight: 1.8, color: "#2244ff" },
              "caption sits under the title",
            ),
          ),
        );
      },
    });
    const bytes = await (await render(card, { as: "png" })).bytes();
    const sharp = createRequire(cliPkg)("sharp") as typeof import("sharp");
    const raw = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let captionTop = -1;
    for (let y = 0; y < raw.info.height; y++) {
      for (let x = 0; x < raw.info.width; x++) {
        const index = (y * raw.info.width + x) * raw.info.channels;
        const red = raw.data[index] ?? 0;
        const green = raw.data[index + 1] ?? 0;
        const blue = raw.data[index + 2] ?? 0;
        if (blue > 150 && red < 80 && green < 120) {
          captionTop = y;
          break;
        }
      }
      if (captionTop >= 0) break;
    }
    expect(captionTop).toBeGreaterThan(0);
    let leak = 0;
    for (let y = captionTop - 1; y < raw.info.height; y++) {
      for (let x = 0; x < raw.info.width; x++) {
        const index = (y * raw.info.width + x) * raw.info.channels;
        const red = raw.data[index] ?? 0;
        const green = raw.data[index + 1] ?? 0;
        const blue = raw.data[index + 2] ?? 0;
        if (red > 200 && green > 200 && blue > 200) leak += 1;
      }
    }
    expect(leak).toBe(0);
  }, 60_000);
});

function runNode(source: string, env: NodeJS.ProcessEnv): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
      env,
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => child.kill("SIGKILL"), 55_000);
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}
