import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = join(packageRoot, "../..");

interface RenditionReceipt {
  path: string;
  format?: string;
  width?: number;
  height?: number;
  coordinates: { editionId?: string; variantId?: string };
}

interface ExportReceipt {
  manifest: { renditions: RenditionReceipt[] };
}

describe("WS0 library-first export fixes", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("exports the default edition at the requested PNG size", async () => {
    const dir = await tempDir(dirs);
    const receipt = await exportMedia(dir, [
      join(repoRoot, "examples/basics/og-card/og-card.media.ts"),
      "--for", "1200x630.png",
    ]);
    const defaults = pngRenditions(receipt).filter((rendition) => rendition.coordinates.editionId === "default");
    expect(defaults).toHaveLength(1);
    const meta = await imageMeta(join(dir, defaults[0]!.path));
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
    expect(meta.width).not.toBe(2400);
    expect(meta.height).not.toBe(1260);
  }, 60_000);

  it("selects the compact edition for a 600x315 PNG", async () => {
    const dir = await tempDir(dirs);
    const receipt = await exportMedia(dir, [
      join(repoRoot, "examples/basics/og-card/og-card.media.ts"),
      "--for", "600x315.png",
    ]);
    const pngs = pngRenditions(receipt);
    expect(pngs).toHaveLength(1);
    expect(pngs[0]!.coordinates.editionId).toBe("compact");
    const meta = await imageMeta(join(dir, pngs[0]!.path));
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(315);
  }, 60_000);

  it("writes the default rendition and the queued variant", async () => {
    const dir = await tempDir(dirs);
    const receipt = await exportMedia(dir, [
      join(repoRoot, "examples/vector/status-badge/status-badge.media.ts"),
      "--for", "600x180.png",
    ]);
    const pngs = pngRenditions(receipt);
    const queued = pngs.filter((rendition) => rendition.path.split(/[/\\]/).includes("queued"));
    const plain = pngs.filter((rendition) => /^media\/[^/]+\.png$/.test(rendition.path));
    expect(plain.length).toBeGreaterThan(0);
    expect(queued.length).toBeGreaterThan(0);
    expect(plain.every((rendition) => rendition.coordinates.variantId !== "queued")).toBe(true);
    for (const rendition of [...plain, ...queued]) {
      const meta = await imageMeta(join(dir, rendition.path));
      expect(meta.width).toBe(600);
      expect(meta.height).toBe(180);
    }
  }, 60_000);

  it("wraps a long title inside the padded canvas", async () => {
    const dir = await tempDir(dirs);
    const receipt = await exportMedia(dir, [
      join(packageRoot, "src/__fixtures__/long-title.media.ts"),
      "--for", "600x300.png",
    ]);
    const pngs = pngRenditions(receipt);
    expect(pngs).toHaveLength(1);
    const image = await rawRgba(join(dir, pngs[0]!.path));
    expect(image.width).toBe(600);
    expect(image.height).toBe(300);
    const overflow = brightEdgePixels(image, 20);
    expect(overflow).toEqual([]);
    const bands = whiteRowBands(image);
    expect(bands.length).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it("keeps authored scale when motion is also set", async () => {
    const dir = await tempDir(dirs);
    const receipt = await exportMedia(dir, [
      join(packageRoot, "src/__fixtures__/motion-style.media.ts"),
      "--for", "200x200.png",
      "--at", "0.9s",
    ]);
    const pngs = pngRenditions(receipt);
    expect(pngs).toHaveLength(1);
    const image = await rawRgba(join(dir, pngs[0]!.path));
    expect(image.width).toBe(200);
    expect(image.height).toBe(200);
    const outside = pixel(image, 60, 60);
    const inside = pixel(image, 100, 100);
    expect(outside).toEqual({ r: 0, g: 0, b: 0 });
    expect(inside).toEqual({ r: 255, g: 255, b: 255 });
  }, 60_000);

  it("renders SVG text with bundled Inter when no author font is declared", async () => {
    const dir = await tempDir(dirs);
    const receipt = await exportMedia(dir, [
      join(packageRoot, "src/__fixtures__/svg-text-no-font.media.ts"),
      "--for", "200x80.png",
    ]);
    const pngs = pngRenditions(receipt);
    expect(pngs).toHaveLength(1);
    const image = await rawRgba(join(dir, pngs[0]!.path));
    expect(image.width).toBe(200);
    expect(image.height).toBe(80);
    let ink = 0;
    for (let index = 0; index < image.data.length; index += image.channels) {
      const red = image.data[index] ?? 0;
      const green = image.data[index + 1] ?? 0;
      const blue = image.data[index + 2] ?? 0;
      const alpha = image.data[index + 3] ?? 0;
      if (alpha > 0 && red + green + blue < 600) ink += 1;
    }
    expect(ink).toBeGreaterThan(20);
  }, 60_000);

  it("does not mutate PLAYWRIGHT_BROWSERS_PATH on import", async () => {
    const runtime = join(repoRoot, "packages/superimg/dist/runtime.node.js");
    const script = `process.env.PLAYWRIGHT_BROWSERS_PATH = "sentinel"; await import(${JSON.stringify(runtime)}); process.stdout.write(String(process.env.PLAYWRIGHT_BROWSERS_PATH));`;
    const result = await runNode(["--input-type=module", "-e", script]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("sentinel");
  }, 60_000);

  it("keeps player export names longer than two characters", async () => {
    const source = await readFile(join(repoRoot, "packages/superimg/dist/player.js"), "utf8");
    const blocks = [...source.matchAll(/export\s*\{([^}]*)\}/g)];
    expect(blocks.length).toBeGreaterThan(0);
    const names = exportNames(blocks[blocks.length - 1]![1]!);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => name.length <= 2)).toEqual([]);
  }, 60_000);
});

async function tempDir(dirs: string[]): Promise<string> {
  const dir = await mkdtemp(join(await realpath(tmpdir()), "superimg-ws0-"));
  dirs.push(dir);
  return dir;
}

async function exportMedia(dir: string, args: string[]): Promise<ExportReceipt> {
  const result = await cli(["export", ...args, "-o", dir, "--json"]);
  if (result.code !== 0) {
    throw new Error(`CLI exited ${result.code}\n${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout) as ExportReceipt;
}

function pngRenditions(receipt: ExportReceipt): RenditionReceipt[] {
  return receipt.manifest.renditions.filter((rendition) => rendition.path.endsWith(".png") || rendition.format === "png");
}

async function imageMeta(path: string): Promise<{ width?: number; height?: number }> {
  const { default: sharp } = await import("sharp");
  return sharp(path).metadata();
}

async function rawRgba(path: string): Promise<{ data: Buffer; width: number; height: number; channels: number }> {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function pixel(image: { data: Buffer; width: number; channels: number }, x: number, y: number): { r: number; g: number; b: number } {
  const index = (y * image.width + x) * image.channels;
  return { r: image.data[index]!, g: image.data[index + 1]!, b: image.data[index + 2]! };
}

function brightEdgePixels(image: { data: Buffer; width: number; height: number; channels: number }, inset: number): Array<{ x: number; y: number }> {
  const hits: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (x >= inset && x < image.width - inset) continue;
      const { r, g, b } = pixel(image, x, y);
      if (r > 128 && g > 128 && b > 128) hits.push({ x, y });
    }
  }
  return hits;
}

function whiteRowBands(image: { data: Buffer; width: number; height: number; channels: number }): Array<{ start: number; end: number }> {
  const bands: Array<{ start: number; end: number }> = [];
  let start: number | undefined;
  for (let y = 0; y < image.height; y++) {
    let bright = false;
    for (let x = 0; x < image.width; x++) {
      if (pixel(image, x, y).r > 200) { bright = true; break; }
    }
    if (bright && start === undefined) start = y;
    if (!bright && start !== undefined) {
      bands.push({ start, end: y - 1 });
      start = undefined;
    }
  }
  if (start !== undefined) bands.push({ start, end: image.height - 1 });
  return bands;
}

function exportNames(body: string): string[] {
  return body.split(",").map((part) => {
    const trimmed = part.trim();
    if (trimmed.length === 0) return "";
    const alias = trimmed.match(/\bas\s+([A-Za-z_$][\w$]*)\s*$/);
    if (alias) return alias[1] ?? "";
    const ident = trimmed.match(/([A-Za-z_$][\w$]*)\s*$/);
    return ident?.[1] ?? "";
  }).filter((name) => name.length > 0);
}

function cli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return runNode(["dist/cli.js", ...args], packageRoot);
}

function runNode(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

describe("WS0-f check prepares stdlib capabilities", () => {
  it("checks a phased responsive fixture", async () => {
    const result = await cli([
      "check",
      join(packageRoot, "src/__fixtures__/phased-responsive.media.ts"),
      "--json",
    ]);
    const report = JSON.parse(result.stdout) as { ok?: boolean; error?: unknown };
    expect(result.code).toBe(0);
    expect(report.error).toBeUndefined();
    expect(report.ok).toBe(true);
  }, 60_000);

  it("checks the tweet example", async () => {
    const result = await cli([
      "check",
      join(repoRoot, "examples/social/tweet/tweet.media.ts"),
      "--json",
    ]);
    const report = JSON.parse(result.stdout) as { ok?: boolean; error?: unknown };
    expect(result.code).toBe(0);
    expect(report.error).toBeUndefined();
    expect(report.ok).toBe(true);
  }, 120_000);
});
