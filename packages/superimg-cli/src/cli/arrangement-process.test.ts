import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, expect, it } from "vitest";
import { inspectArrangementContrast } from "./utils/arrangement-contrast.js";
import { assertArrangementReviewCurrent } from "./utils/arrangement-review.js";

// These exercise the built executable in a directory with no package scaffold.
const root = mkdtempSync(join(tmpdir(), "superimg-arrange-process-"));
const cli = resolve(import.meta.dirname, "../../dist/cli.js");
const file = join(root, "board.arrange.json");
const request = { pattern: "aligned-intervals", spec: { question: "Do events overlap?", workRemoved: "Comparing timelines", evidence: "observation", size: { width: 1920, height: 1080 }, timeRef: { unit: "s", origin: 0 }, tracks: [{ id: "a", label: "A", intervals: [{ start: 0, end: 4 }] }, { id: "b", label: "B", intervals: [{ start: 2, end: 8 }] }], motion: { phase: "reveal", revealIds: ["b"], predict: "tick" } } };
writeFileSync(file, JSON.stringify(request));
afterAll(() => rmSync(root, { recursive: true, force: true }));
function run(...args: string[]) {
  const p = spawnSync(process.execPath, [cli, ...args, "--json"], { cwd: root, encoding: "utf8", timeout: 120000 });
  return { ...p, value: JSON.parse(p.stdout) };
}
it("uses one versioned refusal for all arrangement commands and rejects usage before jobs", () => {
  const refused = join(root, "parity.json");
  writeFileSync(refused, JSON.stringify({ ...request, spec: { ...request.spec, tracks: [] } }));
  const cases = [run("check", refused), run("export", refused, "--for", "1920x1080.png")];
  for (const result of cases) {
    expect(result.status).toBe(1);
    expect(result.value).toMatchObject({ schemaVersion: 1, ok: false, certainty: "completed", certaintyScope: "command", error: { code: "ARRANGEMENT_REFUSED" } });
    expect(result.value.findings).toEqual(cases[0]!.value.findings);
    expect(result.value.error.failures).toBeUndefined();
  }
  for (const args of [["arrange", file], ["export", file, "--force"], ["export", file, "--no-cache"], ["export", file, "--cache-verify"], ["export", file, "--debug-html"], ["export", file, "--for"], ["export", file, "--bogus"], ["media", "import", "--bogus"]]) {
    const result = run(...args);
    expect(result.status).toBe(2);
    expect(result.value).toMatchObject({ schemaVersion: 1, ok: false, certainty: "not-started", certaintyScope: "command" });
    expect(result.stderr).not.toContain('"kind":"@foxworth/superimg/job"');
  }
  const plain = join(root, "plain.json");
  writeFileSync(plain, JSON.stringify(request));
  expect(run("check", plain).value).toMatchObject({ ok: true, scope: "admission" });
}, 30000);
it("reports conflicting still selection as usage before starting export", () => {
  const result = run("export", file, "--for", "1920x1080.png", "--poster", "--at", "1s");
  expect(result.status).toBe(2);
  expect(result.value).toMatchObject({ ok: false, certainty: "not-started", error: { code: "CONFLICTING_STILL_SELECTION" } });
  expect(result.stderr).not.toContain("@foxworth/superimg/job");
});
it("warns when a media-looking output is a directory", () => {
  const output = join(root, "output.mp4");
  const result = spawnSync(process.execPath, [cli, "export", file, "--for", "1920x1080.png", "-o", output], { cwd: root, encoding: "utf8", timeout: 120000 });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toContain("--output names a bundle directory, not a media file");
  expect(statSync(output).isDirectory()).toBe(true);
  expect(statSync(join(output, "media", "1920x1080.png")).isFile()).toBe(true);
  expect(JSON.parse(result.stdout).input.kind).toBe("arrangement");
}, 120000);
it("checks admission without a project or browser and refuses malformed input", () => {
  const good = run("check", file);
  expect(good.status).toBe(0);
  expect(good.value).toMatchObject({ ok: true, scope: "admission" });
  const bad = join(root, "bad.arrange.json");
  writeFileSync(bad, JSON.stringify({ pattern: "no-such-pattern", spec: {} }));
  const result = run("check", bad);
  expect(result.status).not.toBe(0);
  expect(result.value.ok).toBe(false);
  expect(result.value.error).toMatchObject({ code: "INVALID_REQUEST", path: "pattern" });
  expect(result.value).toMatchObject({ schemaVersion: 1, phase: "preparation", publication: { state: "not-started" } });
  expect(result.stderr).not.toContain("at ");
  const refused = join(root, "refused.arrange.json");
  writeFileSync(refused, JSON.stringify({ ...request, spec: { ...request.spec, tracks: [] } }));
  const denied = run("export", refused, "--for", "1920x1080.png");
  expect(denied.status).not.toBe(0);
  expect(denied.value.error).toMatchObject({ code: "ARRANGEMENT_REFUSED", suggestion: expect.any(String) });
  expect(denied.value.findings.map((f: { code: string }) => f.code)).toContain("missing-correspondence");
}, 30000);
it("reports missing destinations and unsupported selection as JSON", () => {
  expect(run("export", file).value.ok).toBe(false);
  expect(run("export", file, "--for", "1920x1080.png", "--timeout", "1").value.error.code).toBe("UNSUPPORTED_SELECTION");
  expect(run("check", file, "--edition", "square").value.error.code).toBe("UNKNOWN_EDITION");
}, 30000);
it("selects authored arrangement editions and rejects an unqualified aspect", () => {
  const requestPath = resolve(import.meta.dirname, "../../../../tests/fixtures/headless-arrangement/overlap.arrange.json");
  expect(run("check", requestPath, "--edition", "portrait").status).toBe(0);
  const portrait = run("export", requestPath, "--for", "1080x1920.png", "--edition", "portrait", "--output", join(root, "portrait"));
  expect(portrait.status).toBe(0);
  expect(portrait.value.manifest.renditions[0].coordinates.editionId).toBe("portrait");
  const mismatch = run("export", requestPath, "--for", "1080x1080.png", "--edition", "portrait");
  expect(mismatch.status).toBe(1);
  expect(mismatch.value.error).toMatchObject({ code: "MISSING_EDITION", message: expect.stringContaining("--edition square") });
  expect(mismatch.value.error.message).not.toContain("Add an editions entry");
  const refused = run("export", file, "--for", "1080x1920.png");
  expect(refused.status).toBe(1);
  expect(refused.value.error).toMatchObject({ code: "MISSING_EDITION", path: "editions", message: expect.stringContaining("Add an editions entry") });
  expect(refused.stderr).not.toContain("@foxworth/superimg/job");
}, 120000);
it("exports the answer poster and preserves explicit time and receipts", () => {
  const target = "1920x1080.png";
  const poster = run("export", file, "--for", target, "--dpr", "1", "--output", join(root, "poster.png"));
  expect(poster.stderr).toContain("--output names a bundle directory, not a media file");
  expect(poster.status).toBe(0);
  expect(poster.value.input.kind).toBe("arrangement");
  expect(poster.value).toMatchObject({ effectState: "completed", stillSelection: { origin: "pattern-poster", frame: 144, encodedSeconds: 4.8 } });
  const artifact = poster.value.artifacts[0];
  expect(artifact.path).toBe(join(root, "poster.png", poster.value.manifest.renditions[0].path));
  expect(createHash("sha256").update(readFileSync(artifact.path)).digest("hex")).toBe(artifact.sha256);
  const recovered = JSON.parse(readFileSync(join(root, "poster.png", "export.json"), "utf8"));
  expect(recovered.inputIdentity).toEqual({ schemaVersion: 1, kind: "arrangement", digest: poster.value.input.identity });
  expect(recovered.stillSelection).toEqual(poster.value.stillSelection);
  expect(recovered.renditions[0].sha256).toBe(artifact.sha256);
  const zero = run("export", file, "--for", target, "--at", "0s", "--output", join(root, "zero"));
  expect(zero.value.stillSelection).toMatchObject({ origin: "explicit", frame: 0 });
  expect(zero.value.manifest.renditions[0].sha256).not.toBe(poster.value.manifest.renditions[0].sha256);
  const late = run("export", file, "--for", target, "--at", "99s", "--output", join(root, "late"));
  expect(late.status).toBe(0);
  expect(late.value.stillSelection).toMatchObject({ requestedSeconds: 99, frame: 179 });
  expect(late.value.findings).toContainEqual(expect.objectContaining({ code: "STILL_TIME_CLAMPED", requestedSeconds: 99 }));
  const common = run("export", file, "--for", target, "--at", "4s", "--output", join(root, "common"));
  expect(common.status).toBe(0);
  expect(common.value.stillSelection).toMatchObject({ origin: "explicit", frame: 120 });
  const before = common.value.manifestDigest;
  const refused = join(root, "refused.arrange.json");
  const failed = run("export", refused, "--for", target, "--output", join(root, "common"));
  expect(failed.status).not.toBe(0);
  const retained = JSON.parse(readFileSync(join(root, "common", "export.json"), "utf8"));
  expect(retained.renditions[0].sha256).toBe(common.value.manifest.renditions[0].sha256);
  expect(retained.inputIdentity.digest).toBe(common.value.input.identity);
  expect(retained.stillSelection).toEqual(common.value.stillSelection);
  expect(before).toBeTruthy();
}, 240000);

it("writes attributable review evidence for the published PNG and standalone inspect", async () => {
  const output = run("export", file, "--for", "1920x1080.png", "--review", "--output", join(root, "reviewed"));
  expect(output.status, `${output.stdout}
${output.stderr}`).toBe(0);
  expect(output.value).toMatchObject({ schemaVersion: 1, resultSchemaVersion: 0, ok: true, certainty: "completed", certaintyScope: "command" });
  expect(output.value.review.path).toContain(join(root, ".superimg", "reviews"));
  expect(output.value.review.selectionPath).toContain(join("selections", ""));
  expect(output.value.effectState).toBe("completed");
  expect(output.value.review.state).toBe("completed");
  const review = JSON.parse(readFileSync(output.value.review.path, "utf8"));
  expect(review.sourceIdentity).toMatchObject({ kind: "arrangement", inputDigest: output.value.input.identity });
  expect(review.visual.status).toBe("unreviewed");
  expect(review.technical.findings).toContainEqual(expect.objectContaining({ code: "TEXT_CONTRAST_MEASURED", severity: "info", details: expect.objectContaining({ nodeId: "chip-label-unit", evidence: "matched-rendered-pixels", ratio: expect.any(Number), frame: expect.any(Number) }) }));
  expect(review.technical.findings).toContainEqual(expect.objectContaining({ code: "TEXT_CONTRAST_MEASURED", severity: "info", details: expect.objectContaining({ nodeId: "track-a", minimum: 4.5, evidence: "matched-rendered-pixels" }) }));
  expect(review.beats[0].resolved.frame).toBe(output.value.stillSelection.frame);
  expect(review.beats[0].evidence[0].sha256).toBe(output.value.artifacts[0].sha256);
  const background = review.evidence.find((entry: { kind: string }) => entry.kind === "contrast-background");
  const observation = review.evidence.find((entry: { kind: string }) => entry.kind === "contrast-observation");
  expect(background).toBeDefined();
  expect(observation).toBeDefined();
  const pixels = readFileSync(review.beats[0].evidence[0].path);
  const saved = JSON.parse(readFileSync(observation.path, "utf8"));
  const replay = await inspectArrangementContrast({ published: pixels, visible: pixels, background: readFileSync(background.path), ...saved });
  const original = review.technical.findings.find((finding: { code: string; details?: { nodeId?: string } }) => finding.code === "TEXT_CONTRAST_MEASURED" && finding.details?.nodeId === "chip-label-unit");
  expect(replay.findings).toContainEqual(expect.objectContaining({ code: original.code, details: expect.objectContaining({ nodeId: original.details.nodeId, ratio: original.details.ratio }) }));
  await assertArrangementReviewCurrent(review, review.captureSelectionDigest);
  writeFileSync(background.path, "tampered");
  await expect(assertArrangementReviewCurrent(review, review.captureSelectionDigest)).rejects.toThrow(/stale/);
  const inspected = run("inspect", file, "--review", "--at", "4s", "--output", join(root, "inspect-review"));
  expect(inspected.status).toBe(0);
  expect(inspected.value.review.state).toBe("completed");
  expect(inspected.value.review.selectionPath).not.toBe(output.value.review.selectionPath);
  expect(JSON.parse(readFileSync(output.value.review.selectionPath, "utf8")).captureSelectionDigest).toBe(review.captureSelectionDigest);
  expect(JSON.parse(readFileSync(inspected.value.review.path, "utf8")).beats[0].resolved.frame).toBe(120);
}, 240000);

it("does not claim an unavailable one-frame answer poster and honors explicit zero and moving output", () => {
  const args = ["export", file, "--duration", "1f", "--for", "1920x1080.png"];
  const rejected = run(...args);
  expect(rejected.status).not.toBe(0);
  expect(rejected.value.error.suggestion).toMatch(/longer duration.*--at 0s/i);
  const zero = run(...args, "--at", "0s", "--output", join(root, "one-zero"));
  expect(zero.status).toBe(0);
  expect(zero.value.stillSelection).toMatchObject({ origin: "explicit", frame: 0 });
  const boundary = run("export", file, "--duration", "2f", "--for", "1920x1080.png", "--output", join(root, "two-poster"));
  expect(boundary.status).toBe(0);
  expect(boundary.value.stillSelection).toMatchObject({ origin: "pattern-poster", frame: 1 });
  const boundaryZero = run("export", file, "--duration", "2f", "--for", "1920x1080.png", "--at", "0s", "--output", join(root, "two-zero"));
  expect(boundaryZero.status).toBe(0);
  expect(boundary.value.manifest.renditions[0].sha256).not.toBe(boundaryZero.value.manifest.renditions[0].sha256);
  const moving = run("export", file, "--duration", "1f", "--for", "1920x1080.mp4", "--output", join(root, "one-moving"));
  expect(moving.status).toBe(0);
  expect(moving.value.stillSelection).toBeUndefined();
}, 240000);

it("keeps authored media export working", () => {
  const control = resolve(import.meta.dirname, "../../../../tests/fixtures/headless-arrangement/control.media.ts");
  const result = run("export", control, "--for", "1920x1080.png", "--output", join(root, "authored"));
  expect(result.status).toBe(0);
  expect(result.value.manifest.renditions[0].mimeType).toBe("image/png");
}, 120000);


it("checks without a browser and reports missing assets before launching one", () => {
  const missing = join(root, "missing.arrange.json");
  const specimen = (id: string) => ({ id, label: id, view: { src: "absent.png" }, provenance: "capture" });
  writeFileSync(missing, JSON.stringify({ pattern: "registered-comparison", spec: { question: "What differs?", workRemoved: "Compare states", evidence: "observation", states: [specimen("a"), specimen("b")], frame: { scale: "shared", viewport: { width: 100, height: 100 } }, correspondence: ["object"] } }));
  const env = { ...process.env, SUPERIMG_BROWSERS_PATH: join(root, "no-browser") };
  const check = spawnSync(process.execPath, [cli, "check", missing, "--json"], { cwd: root, encoding: "utf8", env });
  expect(check.status).toBe(0);
  expect(JSON.parse(check.stdout)).toMatchObject({ ok: true, scope: "admission" });
  const output = spawnSync(process.execPath, [cli, "export", missing, "--for", "1920x1080.png", "--json"], { cwd: root, encoding: "utf8", env });
  expect(output.status).not.toBe(0);
  expect(JSON.parse(output.stdout)).toMatchObject({ error: { code: "ENOENT" }, phase: "preparation", publication: { state: "not-started" } });
  expect(output.stderr).not.toContain("CHROMIUM");
});

it("exposes the Node preparation helpers from the public interactions package", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `import * as m from "@foxworth/superimg-interactions"; console.log(JSON.stringify([typeof m.readNodeArrangement, typeof m.prepareNodeArrangement]))`], { cwd: resolve(import.meta.dirname, "../.."), encoding: "utf8" });
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual(["function", "function"]);
});
