import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { acceptedMarkerIssues, captureMarkerEvidence, markerMediaCrop, waitForFailedMarker } from "./hmr-acceptance.mjs";

function accepted() {
  const snapshot = { generation: 1, source: { id: "bench", revision: "new-output" }, compilation: { status: "succeeded", source: { id: "bench", revision: "new-output" }, inputIdentity: "new-input" }, clock: { owner: "inspection" }, readiness: { status: "ready" }, requestedFrame: 0, presented: { frame: 0, revision: 2 } };
  return { before: structuredClone(snapshot), after: snapshot, bundle: { source: snapshot.source, inputIdentity: "new-input" }, marker: "marker-1", visibleMarker: "marker-1" };
}
test("HMR needs accepted source, ready authored frame and visible marker together", () => {
  assert.deepEqual(acceptedMarkerIssues(accepted()), []);
  const stale = accepted();
  stale.after.source = { id: "bench", revision: "old-output" };
  assert.ok(acceptedMarkerIssues(stale).includes("compiled-source-not-presented"));
  const bytesOnly = accepted(); bytesOnly.visibleMarker = null;
  assert.ok(acceptedMarkerIssues(bytesOnly).includes("visible-marker-missing"));
  const unknown = accepted(); unknown.after.compilation.status = "failed";
  assert.ok(acceptedMarkerIssues(unknown).includes("compilation-not-succeeded"));
  const changed = accepted(); changed.before.presented.revision = 1;
  assert.ok(acceptedMarkerIssues(changed).includes("presented-changed"));
});

test("media crop maps content geometry into the same viewport image and discloses clipping", () => {
  const snapshot = { geometry: { content: { x: 10.25, y: 5, width: 20, height: 10 } } };
  const identity = { viewport: { width: 40, height: 30 } };
  assert.deepEqual(markerMediaCrop(snapshot, identity, { width: 80, height: 60 }), { left: 21, top: 10, width: 40, height: 20, scaleX: 2, scaleY: 2, clipped: false });
  snapshot.geometry.content.x = -2;
  assert.equal(markerMediaCrop(snapshot, identity, { width: 80, height: 60 }).clipped, true);
  snapshot.geometry.content.x = 50;
  assert.throws(() => markerMediaCrop(snapshot, identity, { width: 80, height: 60 }), /outside/);
  assert.throws(() => markerMediaCrop({}, identity, { width: 80, height: 60 }), /unavailable/);
});

async function captureFixture(mutate = () => {}, { diagnostic = false, screenshotError = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "superimg-hmr-pixels-"));
  const value = accepted();
  Object.assign(value.after, { surfaceId: "dev-preview", width: 20, height: 10, fps: 30, totalFrames: 30,
    geometry: { coordinateSpace: "host-viewport", dpr: 2, content: { x: 10, y: 5, width: 20, height: 10 } } });
  if (diagnostic) { value.after.compilation.status = "failed"; value.bundle = null; value.bundleResponse = { status: 500, error: { message: "Expected closing delimiter" } }; }
  const identity = { url: "http://localhost/", browserVersion: "test", documentTimeOrigin: 1, viewport: { width: 40, height: 30, dpr: 2, x: 0, y: 0 } };
  const raw = Buffer.alloc(80 * 60 * 4);
  for (let y = 0; y < 60; y++) for (let x = 0; x < 80; x++) {
    const offset = (y * 80 + x) * 4; raw.set([x, y, 37, 255], offset);
  }
  const png = await sharp(raw, { raw: { width: 80, height: 60, channels: 4 } }).png().toBuffer();
  let screenshots = 0;
  const page = {
    async evaluate(fn) {
      if (fn.name === "readCaptureIdentity") return structuredClone(identity);
      assert.equal(fn.name, "readMarkerEvidence");
      return structuredClone({ ...value, before: value.after });
    },
    async screenshot(options) {
      screenshots++;
      assert.deepEqual(options, { type: "png", fullPage: false, scale: "device", caret: "initial", animations: "allow" });
      mutate(value, identity);
      if (screenshotError) throw Error("Disconnected");
      return png;
    },
  };
  try {
    const evidence = await captureMarkerEvidence(page, "marker-1", { directory, expectedSource: { id: "bench", revision: "new-output" }, diagnostic, editStarted: performance.now() - 10 });
    return { evidence, directory, screenshots, png };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}

test("one accepted screenshot retains hashed context and a same-byte media crop", async () => {
  const { evidence, directory, screenshots, png } = await captureFixture();
  try {
    assert.equal(screenshots, 1); assert.equal(evidence.status, "accepted");
    assert.equal(evidence.guard.freshness.status, "matched"); assert.deepEqual(evidence.issues, []);
    assert.equal(evidence.context.width, 80); assert.equal(evidence.context.height, 60);
    assert.equal(evidence.media.width, 40); assert.equal(evidence.media.height, 20);
    assert.equal(evidence.context.sha256, createHash("sha256").update(png).digest("hex"));
    assert.deepEqual(await readFile(evidence.context.path), png);
    const media = await readFile(evidence.media.path);
    assert.equal(evidence.media.sha256, createHash("sha256").update(media).digest("hex"));
    const decoded = await sharp(media).ensureAlpha().raw().toBuffer();
    assert.deepEqual([...decoded.subarray(0, 4)], [20, 10, 37, 255]);
    assert.ok(evidence.timings.editToCapturedMs >= 10); assert.ok(evidence.timings.screenshotMs >= 0);
    assert.equal(JSON.parse(await readFile(evidence.reportPath)).guard.after.readiness.status, "ready");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("changes during screenshot retain rejected bytes without recapture", async () => {
  const changes = [
    ["generation-changed", value => value.after.generation++],
    ["source-changed", value => value.after.source.revision = "changed"],
    ["presented-changed", value => value.after.presented.frame = 1],
    ["compilation-changed", value => value.after.compilation.status = "pending"],
    ["geometry-changed", value => value.after.geometry.content.x++],
    ["resources-not-ready", value => value.after.readiness.status = "pending"],
    ["capture-target-or-geometry-changed", (_value, identity) => identity.viewport.width++],
  ];
  for (const [issue, mutate] of changes) {
    const { evidence, directory, screenshots } = await captureFixture(mutate);
    try {
      assert.equal(screenshots, 1); assert.equal(evidence.status, "rejected", issue);
      assert.ok(evidence.issues.includes(issue), JSON.stringify(evidence.issues));
      assert.ok((await readFile(evidence.context.path)).length > 0);
      assert.equal(JSON.parse(await readFile(evidence.reportPath)).status, "rejected");
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
});

test("syntax failure pixels remain stale diagnostics and screenshot errors are not retried", async () => {
  const stale = await captureFixture(() => {}, { diagnostic: true });
  try {
    assert.equal(stale.screenshots, 1); assert.equal(stale.evidence.status, "diagnostic");
    assert.equal(stale.evidence.kind, "stale-diagnostic"); assert.equal(stale.evidence.guard.freshness.status, "stale");
    assert.equal(stale.evidence.guard.after.compilation.status, "failed");
    assert.ok((await readFile(stale.evidence.media.path)).length > 0);
  } finally { await rm(stale.directory, { recursive: true, force: true }); }
  const failed = await captureFixture(() => {}, { screenshotError: true });
  try {
    assert.equal(failed.screenshots, 1); assert.equal(failed.evidence.status, "rejected");
    assert.ok(failed.evidence.issues.includes("capture-incomplete"));
    assert.equal(failed.evidence.context, null); assert.equal(failed.evidence.guard.error.message, "Disconnected");
  } finally { await rm(failed.directory, { recursive: true, force: true }); }
});

test("failed-source observation awaits async false states and the structured bundle error before capture", async () => {
  const retainedSource = { id: "bench", revision: "new-output" };
  let reads = 0, screenshots = 0;
  const page = {
    waitForFunction() { throw Error("An async predicate must not use Playwright waitForFunction"); },
    screenshot() { screenshots++; throw Error("Failure observation must not capture"); },
    async evaluate(fn) {
      assert.equal(fn.name, "readMarkerEvidence"); reads++;
      await Promise.resolve();
      const value = accepted();
      value.bundleResponse = { status: 200 };
      if (reads >= 2) value.after.compilation.status = "failed";
      if (reads >= 3) { value.bundle = null; value.bundleResponse = { status: 500, error: { code: "PARSE_ERROR", message: "Expected closing delimiter" } }; }
      value.before = structuredClone(value.after);
      return value;
    },
  };
  const result = await waitForFailedMarker(page, "marker-1", retainedSource, 1000);
  assert.equal(reads, 3); assert.equal(screenshots, 0);
  assert.equal(result.after.compilation.status, "failed"); assert.equal(result.bundleResponse.status, 500);
  assert.equal(result.failureWait.count, 3);
  assert.ok(result.failureWait.observations[0].issues.includes("compilation-not-failed"));
  assert.ok(result.failureWait.observations[1].issues.includes("source-error-response-unobserved"));
  assert.deepEqual(result.failureWait.observations[2].issues, []);
});

test("failed-source observation rejects the wrong retained source and preserves its timeout evidence", async () => {
  let reads = 0;
  const page = { async evaluate() {
    reads++; const value = accepted(); value.after.compilation.status = "failed";
    value.before = structuredClone(value.after); value.bundle = null;
    value.bundleResponse = { status: 500, error: { message: "syntax error" } }; return value;
  } };
  await assert.rejects(waitForFailedMarker(page, "marker-1", { id: "bench", revision: "other" }, 1), error => {
    assert.match(error.message, /retained-source-changed/);
    assert.equal(error.evidence.after.compilation.status, "failed");
    assert.equal(error.failureWait.count, reads); assert.equal(reads, 1); return true;
  });
});
