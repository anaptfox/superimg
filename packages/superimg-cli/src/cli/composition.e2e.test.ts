import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = join(packageRoot, "../..");
const fixture = join(repoRoot, "examples/composed/acceptance/composition-acceptance.media.ts");

type Result = { code: number; stdout: string; stderr: string };

describe("built CLI retained composition acceptance", () => {
  const dirs: string[] = [];
  afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

  it("checks and inspects a seven-frame retained program at 25 fps", async () => {
    const source = join(repoRoot, "tests/integration/fixtures/composition/seven-frame.media.ts");
    const checked = await cli(["check", source, "--json"]);
    expect(checked.code, checked.stderr).toBe(0);
    expect(JSON.parse(checked.stdout).config).toMatchObject({ fps: 25, totalFrames: 7 });
    const inspected = await cli(["inspect", source, "--at", "100%", "--json"]);
    expect(inspected.code, inspected.stderr).toBe(0);
    const report = JSON.parse(inspected.stdout);
    expect(report.config.totalFrames).toBe(7);
    expect(report.samples[0]).toMatchObject({ frame: 6, text: ["frame6"] });
  }, 60_000);

  it("checks and inspects named held leaves at their exact schedule boundaries", async () => {
    const checked = await cli(["check", fixture, "--json"]);
    expect(checked.code, checked.stderr).toBe(0);
    const report = JSON.parse(checked.stdout) as { ok: boolean; config: { fps: number; totalFrames: number }; ir?: { clock?: unknown } };
    expect(report.ok).toBe(true);
    expect(report.config).toMatchObject({ fps: 10, totalFrames: 10 });

    const inspected = await cli(["inspect", fixture, "--at", "f:4,f:5,f:9", "--json"]);
    expect(inspected.code, inspected.stderr).toBe(0);
    const inspection = JSON.parse(inspected.stdout) as { samples: Array<{ frame: number; text: string[] }> };
    expect(inspection.samples.map((sample) => sample.frame)).toEqual([4, 5, 9]);
    expect(inspection.samples[0]?.text.join(" ")).toContain("RIGHT:4");
    // The right leaf is held after its authored final frame; inspection keeps
    // the named leaf observable at the parent clock's later frames.
    expect(inspection.samples[1]?.text.join(" ")).toContain("RIGHT:4");
    expect(inspection.samples[2]?.text.join(" ")).toContain("RIGHT:4");
  }, 60_000);

  it("exports a browser-rendered hold frame with both retained panels painted", async () => {
    const output = await mkdtemp(join(await realpath(tmpdir()), "superimg-composition-cli-"));
    dirs.push(output);
    const exported = await cli(["export", fixture, "--for", "320x180.png", "--at", "0.9s", "-o", output, "--json"]);
    expect(exported.code, exported.stderr).toBe(0);
    const receipt = JSON.parse(exported.stdout) as { manifest: { renditions: Array<{ path: string }> } };
    const rendition = receipt.manifest.renditions.find((entry) => entry.path.endsWith(".png"));
    expect(rendition).toBeDefined();
    const { default: sharp } = await import("sharp");
    const image = await sharp(await readFile(join(output, rendition!.path))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(image.info).toMatchObject({ width: 320, height: 180, channels: 4 });
    expect(rgb(image.data, image.info.width, 40, 150)).toEqual({ r: 217, g: 40, b: 40 });
    expect(rgb(image.data, image.info.width, 280, 150)).toEqual({ r: 32, g: 76, b: 206 });
  }, 60_000);
});

function rgb(data: Buffer, width: number, x: number, y: number) {
  const offset = (y * width + x) * 4;
  return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
}

function cli(args: string[]): Promise<Result> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["dist/cli.js", ...args], { cwd: packageRoot, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
