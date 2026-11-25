import { execFile as execFileCb, spawn, type ChildProcess } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { ALL_FORMATS, AudioSampleSink, BufferSource, Input, VideoSampleSink } from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";
import { chromium, type Browser } from "playwright";
import { directVideoBytes } from "../fixtures/composition/direct-video.js";

const execFile = promisify(execFileCb);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const timeout = 300_000;
const npmCache = join(tmpdir(), "superimg-installed-resources-npm-cache");

type PackedPackages = Record<string, string>;
type ChildResult = { code: number | null; stdout: string; stderr: string };

let scratch = "";
let browser: Browser | undefined;
const children: ChildProcess[] = [];

async function packedPackages(directory: string): Promise<PackedPackages> {
  const result: PackedPackages = {};
  for (const file of await readdir(directory)) {
    if (!file.endsWith(".tgz")) continue;
    const path = join(directory, file);
    const { stdout } = await execFile("tar", ["-xOf", path, "package/package.json"], { maxBuffer: 4 * 1024 * 1024 });
    const manifest = JSON.parse(stdout) as { name?: string };
    if (manifest.name) result[manifest.name] = path;
  }
  return result;
}

function run(entry: string, args: string[], cwd: string): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, CI: "1", npm_config_audit: "false", npm_config_fund: "false" };
    delete env.NODE_PATH;
    delete env.NODE_OPTIONS;
    delete env.SUPERIMG_EXAMPLES_ROOT;
    const child = spawn(process.execPath, [entry, ...args], { cwd, env, timeout: 180_000, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }));
  });
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 5_000)),
  ]);
}

function wavTone(): Buffer {
  const rate = 8_000;
  const samples = rate;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++) bytes.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * index / rate) * 0x3fff), 44 + index * 2);
  return bytes;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("installed package resource delivery", { timeout, hookTimeout: timeout }, () => {
  beforeAll(async () => {
    registerMediabunnyServer();
    scratch = await mkdtemp(join(tmpdir(), "superimg-installed-resources-"));
  }, timeout);

  afterAll(async () => {
    for (const child of children) await stop(child);
    await browser?.close();
    if (scratch) await rm(scratch, { recursive: true, force: true });
  }, timeout);

  const packedLane = process.env.SUPERIMG_ONBOARDING_PACKED_DIR ? it : it.skip;
  packedLane("previews and exports app-owned resources through the installed archive packages", async () => {
    const archives = await packedPackages(process.env.SUPERIMG_ONBOARDING_PACKED_DIR!);
    for (const name of ["@foxworth/superimg", "@foxworth/superimg-cli", "@foxworth/boundary"]) {
      expect(archives[name], `Missing ${name} tarball`).toBeTruthy();
    }

    const project = join(scratch, "consumer");
    const mediaDir = join(project, "media");
    const assets = join(mediaDir, "assets");
    const commandCwd = join(project, "different-cwd");
    await mkdir(mediaDir, { recursive: true });
    await mkdir(assets, { recursive: true });
    await mkdir(commandCwd, { recursive: true });
    await writeJson(join(project, "package.json"), {
      name: "installed-resource-consumer", private: true, type: "module",
      dependencies: { "@foxworth/superimg": archives["@foxworth/superimg"], "@foxworth/boundary": archives["@foxworth/boundary"] },
      devDependencies: {
        "@foxworth/superimg-cli": archives["@foxworth/superimg-cli"],
        "node-av": "6.2.0",
        sharp: "0.35.5",
      },
    });
    await execFile("npm", ["install", "--prefix", project, "--no-audit", "--no-fund", "--prefer-offline", "--cache", npmCache], {
      env: { ...process.env, NODE_PATH: "", npm_config_audit: "false", npm_config_fund: "false" },
      maxBuffer: 20 * 1024 * 1024, timeout: 240_000,
    });
    const installedSuperimg = join(project, "node_modules", "@foxworth", "superimg");
    const installedCli = join(project, "node_modules", "@foxworth", "superimg-cli", "dist", "cli.js");
    expect((await lstat(installedSuperimg)).isSymbolicLink()).toBe(false);
    expect((await lstat(dirname(installedCli))).isSymbolicLink()).toBe(false);

    const fixtureSource = await readFile(join(repoRoot, "tests/integration/fixtures/installed-resources/resources.media.ts"), "utf8");
    await copyFile(join(repoRoot, "packages/superimg-core/assets/fonts/Inter-400.ttf"), join(assets, "Inter-400.ttf"));
    await writeFile(join(assets, "direct.mp4"), directVideoBytes);
    await writeFile(join(assets, "tone.wav"), wavTone());
    await sharp({ create: { width: 24, height: 24, channels: 3, background: { r: 230, g: 30, b: 60 } } }).jpeg().toFile(join(assets, "pixel.jpeg"));
    await sharp({ create: { width: 24, height: 24, channels: 3, background: { r: 20, g: 210, b: 110 } } }).webp().toFile(join(assets, "pixelWebp.webp"));

    const mediaPath = join(mediaDir, "resources.media.js");
    const bytesExpression = (bytes: Uint8Array) => `embeddedBytes(${JSON.stringify(Buffer.from(bytes).toString("base64"))})`;
    const jpegBytes = await readFile(join(assets, "pixel.jpeg"));
    const webpBytes = await readFile(join(assets, "pixelWebp.webp"));
    const jpegDecoded = await sharp(jpegBytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const jpegPixel = [...jpegDecoded.data.subarray(0, 3)];
    expect(jpegDecoded.info).toMatchObject({ width: 24, height: 24 });
    expect(jpegPixel[0]).toBeGreaterThan(170);
    expect(jpegPixel[1]).toBeLessThan(90);
    expect(jpegPixel[2]).toBeLessThan(120);
    const webpDecoded = await sharp(webpBytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const webpPixel = [...webpDecoded.data.subarray(0, 3)];
    expect(webpDecoded.info).toMatchObject({ width: 24, height: 24 });
    expect(webpPixel[0]).toBeLessThan(90);
    expect(webpPixel[1]).toBeGreaterThan(160);
    expect(webpPixel[2]).toBeLessThan(130);
    const sourceWithAssets = fixtureSource
      .replace("__JPEG_BYTES__", bytesExpression(jpegBytes))
      .replace("__WEBP_BYTES__", bytesExpression(webpBytes))
      .replace("__VIDEO_BYTES__", bytesExpression(directVideoBytes))
      .replace("__FILE_URL__", pathToFileURL(join(assets, "pixel.jpeg")).href)
      .replace("__WAV_SOURCE__", JSON.stringify(`data:audio/wav;base64,${wavTone().toString("base64")}`));
    await writeFile(mediaPath, sourceWithAssets.replace("__FONT_SOURCE__", '"./assets/Inter-400.ttf"'));

    await writeFile(join(project, "_config.ts"), `export default { outputs: { image: ["320x180.png"] } };\n`);
    const appProbe = join(project, "app-import.mjs");
    await writeFile(appProbe, `import media from "./media/resources.media.js";\nif (media?.kind !== "media" || media.media !== "video") throw new Error("declared SuperImg app import failed");\nconsole.log("app-media-import-ok");\n`);
    const imported = await run(appProbe, [], project);
    expect(imported.code, `${imported.stdout}\n${imported.stderr}`).toBe(0);
    expect(imported.stdout.trim()).toBe("app-media-import-ok");
    const checked = await run(installedCli, ["check", mediaPath, "--json"], commandCwd);
    expect(checked.code, `${checked.stdout}\n${checked.stderr}`).toBe(0);

    const port = await (async () => {
      const { createServer } = await import("node:net");
      const server = createServer();
      await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected loopback port");
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      return address.port;
    })();
    const dev = spawn(process.execPath, [installedCli, "dev", mediaPath, "--no-open", "--port", String(port)], {
      cwd: commandCwd, env: { ...process.env, NODE_PATH: "", CI: "1" }, stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(dev);
    let devOutput = "";
    dev.stdout?.on("data", (chunk) => { devOutput += String(chunk); });
    dev.stderr?.on("data", (chunk) => { devOutput += String(chunk); });
    const origin = `http://127.0.0.1:${port}`;
    let config: { previewKind?: string; mediaKind?: string; width?: number; height?: number } | undefined;
    const configDeadline = Date.now() + 45_000;
    let configStatus = 0;
    while (Date.now() < configDeadline) {
      if (dev.exitCode !== null) throw new Error(`Installed dev exited: ${devOutput}`);
      let response: Response;
      try {
        response = await fetch(`${origin}/api/config`);
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      configStatus = response.status;
      if (response.status >= 500) throw new Error(`Installed dev /api/config returned ${response.status}: ${await response.text()}\n${devOutput}`);
      if (response.ok) { config = await response.json() as typeof config; break; }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(configStatus, `Installed dev config did not become ready. Last status: ${configStatus}\n${devOutput}`).toBe(200);
    expect(config).toMatchObject({ previewKind: "media", mediaKind: "video", width: 320, height: 180 });
    const printedPreviewUrl = devOutput.match(/running at (https?:\/\/\S+)/i)?.[1] ?? origin;
    const previewUrl = `${origin}${new URL(printedPreviewUrl).search}`;

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("requestfailed", (request) => browserErrors.push(`${request.url()}: ${request.failure()?.errorText ?? "request failed"}`));
    await page.goto(previewUrl);
    await expect.poll(async () => page.locator(".si-deck").count(), { timeout: 30_000 }).toBeGreaterThan(0);
    await expect.poll(async () => page.locator("#inspector-btn").count(), { timeout: 30_000 }).toBeGreaterThan(0);
    await expect.poll(async () => page.evaluate(() => Boolean(window.superimgInspection)), { timeout: 30_000 }).toBe(true);
    await expect.poll(async () => page.evaluate(async () => (await window.superimgInspection.inspect({ surfaceId: "dev-preview" })).compilation?.status), { timeout: 30_000 }).toBe("succeeded");
    const snapshot = await page.evaluate(() => window.superimgInspection.inspect({ surfaceId: "dev-preview" }));
    const frameResources = await Promise.all(page.frames().map(async (frame) => frame.evaluate(async () => ({
      url: location.href,
      images: [...document.images].map((image) => ({ complete: image.complete, width: image.naturalWidth, height: image.naturalHeight })),
      videos: [...document.querySelectorAll("video")].map((video) => ({ readyState: video.readyState, width: video.videoWidth, height: video.videoHeight })),
      fontLoaded: (await document.fonts.load("16px InstalledFixture")).length > 0 && document.fonts.check("16px InstalledFixture"),
      fontFamily: [...document.querySelectorAll("*")].map((element) => getComputedStyle(element).fontFamily).find((family) => family.includes("InstalledFixture")) ?? "",
    })).catch((error) => ({ url: frame.url(), error: String(error) }))));
    const iframe = page.locator("iframe");
    const iframeCount = await iframe.count();
    expect(iframeCount, JSON.stringify({ snapshot, frameResources, browserErrors, body: await page.locator("body").innerText(), html: (await page.locator("body").innerHTML()).slice(0, 2000) })).toBeGreaterThan(0);
    const videoResources = frameResources.flatMap((frame) => "videos" in frame ? frame.videos : []);
    const imageResources = frameResources.flatMap((frame) => "images" in frame ? frame.images : []);
    const fontLoaded = frameResources.some((frame) => "fontLoaded" in frame && frame.fontLoaded && frame.fontFamily.includes("InstalledFixture"));
    expect(videoResources.some((video) => video.readyState >= 2 && video.width === 64 && video.height === 48), JSON.stringify({ snapshot, frameResources, browserErrors })).toBe(true);
    expect(imageResources.filter((image) => image.complete && image.width === 24 && image.height === 24), JSON.stringify({ frameResources, browserErrors })).toHaveLength(3);
    expect(fontLoaded, JSON.stringify({ frameResources, browserErrors })).toBe(true);
    await page.close();
    await stop(dev);

    const doctor = await run(installedCli, ["doctor", "--json"], project);
    expect(doctor.code, `${doctor.stdout}\n${doctor.stderr}`).toBe(0);
    const doctorReport = JSON.parse(doctor.stdout) as { checks?: { status: string; code: string }[]; summary?: { fails: number } };
    expect(doctorReport.summary?.fails, doctor.stdout).toBe(0);
    expect(doctorReport.checks?.find((check) => check.code === "SUPERIMG_VERSION")?.status, doctor.stdout).toBe("ok");

    const nodeAvDirectory = join(project, "node_modules", "node-av");
    await expect(lstat(nodeAvDirectory)).resolves.toBeTruthy();
    const unavailableNodeAvDirectory = `${nodeAvDirectory}.installed-resources-disabled`;
    await rename(nodeAvDirectory, unavailableNodeAvDirectory);
    try {
      const withoutEncoder = await run(installedCli, ["doctor", "--json"], project);
      expect(withoutEncoder.code, `${withoutEncoder.stdout}\n${withoutEncoder.stderr}`).toBe(0);
      expect(JSON.parse(withoutEncoder.stdout).summary.fails).toBe(0);
      await rm(join(project, "output"), { recursive: true, force: true });
      const rejectedExport = await run(installedCli, ["export", mediaPath, "--for", "320x180.mp4", "--json"], commandCwd);
      const rejection = `${rejectedExport.stdout}\n${rejectedExport.stderr}`.toLowerCase();
      expect(rejectedExport.code, rejection).not.toBe(0);
      expect(rejection).toMatch(/mp4|node-av|encoder/);
      await expect(lstat(join(project, "output"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rename(unavailableNodeAvDirectory, nodeAvDirectory);
    }

    const restoredDoctor = await run(installedCli, ["doctor", "--json"], project);
    expect(restoredDoctor.code, `${restoredDoctor.stdout}\n${restoredDoctor.stderr}`).toBe(0);
    expect(JSON.parse(restoredDoctor.stdout).summary.fails).toBe(0);
    await expect(lstat(nodeAvDirectory)).resolves.toBeTruthy();
    const stillExport = await run(installedCli, ["export", mediaPath, "--for", "320x180.png", "--for", "320x180.jpeg", "--for", "320x180.webp", "--at", "0.5s", "--json"], commandCwd);
    expect(stillExport.code, `${stillExport.stdout}\n${stillExport.stderr}`).toBe(0);
    const output = join(project, "output", "media", "resources.export");
    await expect(lstat(join(commandCwd, "output"))).rejects.toMatchObject({ code: "ENOENT" });
    const files = await readdir(output, { recursive: true });
    expect(files.some((file) => String(file).endsWith(".png"))).toBe(true);
    for (const format of ["jpeg", "webp"]) expect(files.some((file) => String(file).endsWith(`.${format}`))).toBe(true);
    const imageFile = files.find((file) => String(file).endsWith(".png"));
    if (!imageFile) throw new Error("Installed export did not write its PNG artifact");
    const exportedPng = await readFile(join(output, String(imageFile)));
    const decodedImage = await sharp(exportedPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(decodedImage.info).toMatchObject({ width: 320, height: 180, channels: 4 });
    const pngPixel = (x: number, y: number) => [...decodedImage.data.subarray((y * decodedImage.info.width + x) * decodedImage.info.channels, (y * decodedImage.info.width + x) * decodedImage.info.channels + 3)];
    expect(pngPixel(4, 4)).toEqual([16, 24, 40]);
    const exportedJpeg = pngPixel(40, 78);
    expect(exportedJpeg[0]).toBeGreaterThan(160);
    expect(exportedJpeg[1]).toBeLessThan(100);
    expect(exportedJpeg[2]).toBeLessThan(135);
    const exportedWebp = pngPixel(108, 78);
    expect(exportedWebp[0]).toBeLessThan(100);
    expect(exportedWebp[1]).toBeGreaterThan(150);
    expect(exportedWebp[2]).toBeLessThan(140);

    for (const format of ["jpeg", "webp"]) {
      const file = files.find((name) => String(name).endsWith(`.${format}`));
      if (!file) throw new Error(`Missing installed ${format} export`);
      const decoded = await sharp(await readFile(join(output, String(file)))).raw().toBuffer({ resolveWithObject: true });
      expect(decoded.info).toMatchObject({ width: 320, height: 180 });
      const pixel = (x: number, y: number) => [...decoded.data.subarray((y * decoded.info.width + x) * decoded.info.channels, (y * decoded.info.width + x) * decoded.info.channels + 3)];
      expect(pixel(4, 4)[0]).toBeLessThan(30);
      expect(pixel(4, 4)[1]).toBeLessThan(40);
      expect(pixel(4, 4)[2]).toBeGreaterThan(25);
      if (format === "jpeg") {
        const color = pixel(40, 78);
        expect(color[0]).toBeGreaterThan(160);
        expect(color[1]).toBeLessThan(100);
        expect(color[2]).toBeLessThan(135);
      } else {
        const color = pixel(108, 78);
        expect(color[0]).toBeLessThan(100);
        expect(color[1]).toBeGreaterThan(150);
        expect(color[2]).toBeLessThan(140);
      }
    }

    const videoExport = await run(installedCli, ["export", mediaPath, "--for", "320x180.mp4", "--json"], commandCwd);
    expect(videoExport.code, `${videoExport.stdout}\n${videoExport.stderr}`).toBe(0);

    const videoFiles = await readdir(output, { recursive: true });
    const mp4File = videoFiles.find((file) => String(file).endsWith(".mp4"));
    if (!mp4File) throw new Error("Installed export did not write its MP4 artifact");
    const input = new Input({ source: new BufferSource(await readFile(join(output, String(mp4File)))), formats: ALL_FORMATS });
    try {
      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack) throw new Error("Installed MP4 export has no video track");
      expect(await videoTrack.getDisplayWidth()).toBe(320);
      expect(await videoTrack.getDisplayHeight()).toBe(180);
      expect(await videoTrack.computeDuration()).toBeGreaterThan(0.5);
      const videoSink = new VideoSampleSink(videoTrack);
      const videoSample = await videoSink.getSample(0.5);
      if (!videoSample) throw new Error("Installed MP4 export did not decode a video frame");
      try {
        const rgba = new Uint8Array(videoSample.allocationSize({ format: "RGBA" }));
        await videoSample.copyTo(rgba, { format: "RGBA" });
        const corner = [...rgba.subarray(0, 4)];
        expect(corner[0]).toBeGreaterThanOrEqual(0);
        expect(corner[0]).toBeLessThan(60);
        expect(corner[1]).toBeLessThan(70);
        expect(corner[2]).toBeLessThan(85);
        expect(rgba.some((value) => value > 100)).toBe(true);
      } finally { videoSample.close(); }
      const [audioTrack] = await input.getAudioTracks();
      if (!audioTrack) throw new Error("Installed MP4 export has no audio track");
      const sink = new AudioSampleSink(audioTrack);
      let decodedFrames = 0;
      let durationSeconds = 0;
      let sumSquares = 0;
      let crossings = 0;
      let previous = 0;
      for await (const sample of sink.samples()) {
        try {
          decodedFrames += sample.numberOfFrames;
          durationSeconds += sample.duration;
          const plane = new Float32Array(sample.allocationSize({ planeIndex: 0, format: "f32-planar" }) / Float32Array.BYTES_PER_ELEMENT);
          sample.copyTo(plane, { planeIndex: 0, format: "f32-planar" });
          for (const current of plane) {
            sumSquares += current * current;
            if (previous <= 0 && current > 0 || previous >= 0 && current < 0) crossings++;
            previous = current;
          }
        } finally { sample.close(); }
      }
      const rms = Math.sqrt(sumSquares / decodedFrames);
      const frequencyHz = crossings / (2 * durationSeconds);
      expect(decodedFrames).toBeGreaterThan(4_000);
      expect(durationSeconds).toBeGreaterThan(0.4);
      expect(rms).toBeGreaterThan(0.01);
      expect(frequencyHz).toBeGreaterThan(300);
      expect(frequencyHz).toBeLessThan(600);
    } finally { input.dispose(); }
  }, timeout);
});
