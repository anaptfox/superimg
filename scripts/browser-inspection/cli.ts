import { execFile as execFileCallback } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { browserCapture, captureAccepted, comparable, mediaCrop, selectFrame, type CaptureReport, type InspectionEntry } from "./capture.js";
import { inspectionConnection } from "./session.js";
import { finishBrowserObservation } from "./diagnostics.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const execFile = promisify(execFileCallback);
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const writeJson = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });

async function pixels(before: string, after: string, path: string) {
  // Reuse the integration workspace's pinned image dependency; no personal-skill imports.
  const sharp = createRequire(join(root, "tests/integration/package.json"))("sharp") as typeof import("../../tests/integration/node_modules/sharp/lib/index.js");
  const a = await sharp(before).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(after).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return { comparable: false, reason: "image-dimensions-differ" };
  let changed = 0;
  const output = Buffer.alloc(b.data.length);
  for (let offset = 0; offset < b.data.length; offset += 4) {
    const different = [0, 1, 2, 3].some(channel => a.data[offset + channel] !== b.data[offset + channel]);
    if (different) changed++;
    output[offset] = different ? 255 : 235;
    output[offset + 1] = different ? 0 : 235;
    output[offset + 2] = different ? 120 : 235;
    output[offset + 3] = 255;
  }
  await sharp(output, { raw: { width: b.info.width, height: b.info.height, channels: 4 } }).png().toFile(path);
  return { comparable: true, changedPixels: changed, totalPixels: b.info.width * b.info.height, diff: path, threshold: 0 };
}

async function main() {
  const { values } = parseArgs({ options: {
    "session-file": { type: "string" }, session: { type: "string" }, config: { type: "string" }, executable: { type: "string" },
    surface: { type: "string" }, frame: { type: "string" }, entry: { type: "string", default: "public" },
    compare: { type: "string" }, "output-dir": { type: "string" }, "expected-revision": { type: "string" }, trace: { type: "boolean" }, explore: { type: "boolean" }, help: { type: "boolean" },
  } });
  if (values.help) {
    console.log("just browser-inspect --session-file PATH --surface story --frame 6 [--compare CAPTURE.json]\nOr use --session NAME [--config PATH]. --entry fixture is for repository fixtures.\nLeaves the selected frame held in inspection mode. --expected-revision REV checks freshness; --trace records an optional Chrome trace; --explore returns observational deltas/conditional pixels (not accepted evidence). Comparisons use media pixels; viewport context is retained. JSON summary on stdout, full artifacts on disk.");
    return;
  }
  if (!values.surface || values.frame === undefined || !/^(0|[1-9]\d*)$/.test(values.frame)) throw new Error("Pass --surface and a nonnegative integer --frame.");
  if (values.entry !== "public" && values.entry !== "fixture") throw new Error("--entry must be public or fixture");
  if (values["session-file"] && (values.session || values.config || values.executable)) throw new Error("A session file owns configuration; do not combine it with session/config/executable overrides.");
  if (values.explore && values.compare) throw new Error("Exploration is not accepted evidence; omit --compare or --explore.");
  const frame = Number(values.frame);
  if (!Number.isSafeInteger(frame)) throw new Error("Frame is outside the safe integer range");
  const owned = await inspectionConnection(values, root);
  const { browser } = owned;
  const directory = resolve(values["output-dir"] ?? join(owned.state?.directory ?? join(root, "tests/integration/output/browser-inspection"), `capture-${Date.now()}-${randomUUID().slice(0, 8)}`));
  const artifact = join(directory, "capture.json");
  const screenshot = join(directory, "capture.png");
  try {
    await mkdir(dirname(directory), { recursive: true, mode: 0o700 });
    await mkdir(directory, { mode: 0o700 });
  } catch (error) { await owned.release(); throw error; }
  let traceOwned = false;
  let verifiedSession = false;
  let traceError: { message: string; code?: string } | undefined;
  let exploration: unknown;
  let diagnostics: Record<string, unknown> | undefined;
  let report: CaptureReport = { schema: "superimg-browser-capture/1", status: "rejected", issues: ["capture-not-started"] };
  try {
    const info = (await browser.command(["session", "info"])).data;
    if (!info?.active || !info.runtime?.browserLaunched) throw new Error("Browser is not running; this command does not start one.");
    if (owned.state?.pid && info.pid !== owned.state.pid) throw new Error("The saved daemon was replaced; inspect session status before continuing.");
    if (owned.state?.launchHash && info.runtime.launchHash !== owned.state.launchHash) throw new Error("Browser launch identity changed.");
    const version = await browser.version();
    if (version !== "agent-browser 0.39.1") throw new Error(`Capture transport is qualified with agent-browser 0.39.1; found ${version}`);
    verifiedSession = true;
    if (values.trace) { await browser.command(["trace", "start"]); traceOwned = true; }
    await selectFrame(browser, values.entry as InspectionEntry, values.surface, frame);
    if (values.explore) {
      const delta = await browser.command(["diff", "snapshot"], false);
      const conditional = await browser.command(["screenshot", screenshot, "--if-changed"]);
      exploration = { kind: "exploratory-observation", delta, conditional, acceptance: "unverified" };
    } else {
      report = await captureAccepted(browserCapture(browser, values.entry as InspectionEntry, values.surface, screenshot), frame, values["expected-revision"]);
    }
  } catch (error) {
    const failure = error as { message?: string; code?: string };
    report.error = { message: failure.message ?? String(error), ...(failure.code ? { code: failure.code } : {}) };
    // No effect or failed selection is replayed. A capture can remain incomplete.
    report.issues.push("capture-incomplete");
  } finally {
    const finished = await finishBrowserObservation(browser, { enabled: verifiedSession, ...(traceOwned ? { tracePath: join(directory, "trace.json") } : {}), ...(report.error ? { priorError: report.error } : {}) });
    traceError = finished.traceError;
    diagnostics = finished.diagnostics;
    if (traceError?.code === "COMMAND_UNCERTAIN") {
      report.status = "rejected";
      report.issues.push("trace-cleanup-uncertain");
    }
  }
  try {
    if (exploration) {
      await writeJson(artifact, { ...exploration as object, diagnostics, traceError });
      await writeJson(join(directory, "commands.json"), browser.transcript);
      console.log(JSON.stringify({ kind: "exploratory-observation", acceptance: "unverified", artifact }));
      return;
    }
    const imageHash = await readFile(screenshot).then(hash, () => null);
    if (!imageHash && report.status === "accepted") {
      report.status = "rejected";
      report.issues.push("capture-image-unavailable");
    }
    let media: { path: string; sha256: string; crop: ReturnType<typeof mediaCrop>; width: number; height: number } | null = null;
    if (imageHash && report.after && report.browserAfter) {
      try {
        const sharp = createRequire(join(root, "tests/integration/package.json"))("sharp");
        const info = await sharp(screenshot).metadata();
        const crop = mediaCrop(report.after, report.browserAfter, { width: info.width, height: info.height });
        const path = join(directory, "media.png");
        await sharp(screenshot).extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height }).png().toFile(path);
        media = { path, sha256: await readFile(path).then(hash), crop, width: crop.width, height: crop.height };
      } catch (error) {
        report.status = "rejected"; report.issues.push("media-crop-unavailable");
        if (!report.error) report.error = { message: String(error) };
      }
    }
    const checkout = await execFile("git", ["rev-parse", "HEAD"], { cwd: root }).then(result => result.stdout.trim(), () => "unknown");
    const record: Record<string, unknown> = {
      ...report, screenshot: media?.path ?? null, imageSha256: media?.sha256 ?? null, media, contextScreenshot: imageHash ? screenshot : null, contextImageSha256: imageHash, diagnostics,
      ...(traceOwned ? { trace: { kind: "chrome-trace-json", path: join(directory, "trace.json"), error: traceError ?? null } } : {}),
      session: browser.session, transport: "host-javascript", cliVersion: await browser.version().catch(() => "unknown"),
      source: report.after?.source ?? "unknown", checkout,
      freshness: report.freshness ?? { status: "unknown", reason: "host-compilation-state-unavailable" },
    };
    if (values.compare) {
      try {
        const baselinePath = resolve(values.compare);
        const baseline = await readJson(baselinePath);
        const comparison = comparable(baseline, report);
        if (!baseline.media || !media) { comparison.comparable = false; comparison.reasons.push("media-evidence-unavailable"); }
        else if (baseline.media.crop?.clipped || media.crop.clipped) { comparison.comparable = false; comparison.reasons.push("media-is-partially-visible"); }
        else if (baseline.media.crop?.scaleX !== media.crop.scaleX || baseline.media.crop?.scaleY !== media.crop.scaleY) { comparison.comparable = false; comparison.reasons.push("capture-scale-differs"); }
        const baselineImage = typeof baseline.screenshot === "string"
          ? await readFile(baseline.screenshot).catch(() => undefined) : undefined;
        if (!baselineImage || typeof baseline.imageSha256 !== "string") {
          comparison.comparable = false;
          comparison.reasons.push("baseline-image-evidence-unavailable");
        } else if (baseline.imageSha256 !== hash(baselineImage)) {
          comparison.comparable = false;
          comparison.reasons.push("baseline-image-changed");
        }
        const pixelComparison = comparison.comparable && media
          ? await pixels(baseline.screenshot, media.path, join(directory, "diff.png")) : undefined;
        if (pixelComparison && !pixelComparison.comparable) {
          comparison.comparable = false;
          comparison.reasons.push(pixelComparison.reason!);
        }
        record.comparison = { ...comparison, baseline: baselinePath,
          ...(pixelComparison ? { pixels: pixelComparison } : {}),
        };
        if (!comparison.comparable) process.exitCode = 1;
      } catch (error) {
        record.comparison = { comparable: false, error: String(error) };
        process.exitCode = 1;
      }
    }
    await writeJson(join(directory, "commands.json"), browser.transcript);
    await writeJson(artifact, record);
    const summary = { status: report.status, issues: report.issues, surface: values.surface, frame: report.after?.presented?.frame,
      generation: report.after?.generation, revision: report.after?.presented?.revision, source: record.source, freshness: record.freshness,
      artifact, screenshot: record.screenshot, comparison: record.comparison, error: report.error };
    console.log(JSON.stringify(summary, null, 2));
    if (report.status !== "accepted" || report.freshness?.status === "stale") process.exitCode = 1;
  } finally { await owned.release(); }
}

main().catch(error => { console.error(JSON.stringify({ status: "error", message: String(error) })); process.exitCode = 1; });
