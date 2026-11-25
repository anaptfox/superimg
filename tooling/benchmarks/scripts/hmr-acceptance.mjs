import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { captureAccepted } from "../../../packages/superimg-player/dist/inspection.js";

/** Read-only acceptance rule; a fetched source string alone cannot finish HMR timing. */
export function acceptedMarkerIssues({ before, after, bundle, marker, visibleMarker }) {
  const issues = [];
  if (after?.compilation?.status !== "succeeded") issues.push("compilation-not-succeeded");
  if (!after?.source?.revision || after.source.id !== bundle?.source?.id || after.source.revision !== bundle.source.revision) issues.push("compiled-source-not-presented");
  if (after?.compilation?.source?.id !== after?.source?.id || after?.compilation?.source?.revision !== after?.source?.revision) issues.push("compilation-source-not-accepted");
  if (bundle?.inputIdentity && after?.compilation?.inputIdentity !== bundle.inputIdentity) issues.push("input-identity-differs");
  if (after?.clock?.owner !== "inspection" || after?.readiness?.status !== "ready" || after?.presented?.frame !== 0 || after?.requestedFrame !== 0) issues.push("frame-not-ready");
  for (const key of ["generation", "source", "presented", "compilation", "geometry"]) if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) issues.push(`${key}-changed`);
  if (visibleMarker !== marker) issues.push("visible-marker-missing");
  return issues;
}

function readCaptureIdentity() {
  return { url: location.href, browserVersion: navigator.userAgent, documentTimeOrigin: performance.timeOrigin,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, x: scrollX, y: scrollY } };
}

/** Geometry is in host viewport coordinates. Crop only the ONE viewport exposure. */
export function markerMediaCrop(snapshot, identity, image) {
  const box = snapshot?.geometry?.content, viewport = identity?.viewport;
  if (!box || ![box.x, box.y, box.width, box.height, viewport?.width, viewport?.height, image.width, image.height].every(Number.isFinite)
    || Math.min(box.width, box.height, viewport.width, viewport.height, image.width, image.height) <= 0) throw new Error("Media content or viewport geometry is unavailable");
  const scaleX = image.width / viewport.width, scaleY = image.height / viewport.height;
  const raw = { left: Math.round(box.x * scaleX), top: Math.round(box.y * scaleY), right: Math.round((box.x + box.width) * scaleX), bottom: Math.round((box.y + box.height) * scaleY) };
  const left = Math.max(0, raw.left), top = Math.max(0, raw.top), right = Math.min(image.width, raw.right), bottom = Math.min(image.height, raw.bottom);
  if (right <= left || bottom <= top) throw new Error("Media is outside the captured viewport");
  return { left, top, width: right - left, height: bottom - top, scaleX, scaleY,
    clipped: left !== raw.left || top !== raw.top || right !== raw.right || bottom !== raw.bottom };
}

function staleMarkerIssues(evidence, retainedSource) {
  const issues = [];
  if (evidence?.after?.compilation?.status !== "failed") issues.push("compilation-not-failed");
  if (JSON.stringify(evidence?.after?.source) !== JSON.stringify(retainedSource)) issues.push("retained-source-changed");
  if (evidence?.visibleMarker !== evidence?.marker) issues.push("visible-marker-missing");
  if (evidence?.bundleResponse?.status !== 500 || !evidence.bundleResponse.error?.message) issues.push("source-error-response-unobserved");
  for (const key of ["generation", "source", "presented", "compilation", "geometry"]) {
    if (JSON.stringify(evidence?.before?.[key]) !== JSON.stringify(evidence?.after?.[key])) issues.push(`${key}-changed`);
  }
  return issues;
}

/** Save one guarded exposure, including rejected/stale diagnostics. Never replay. */
export async function captureMarkerEvidence(page, marker, { directory, name = marker, expectedSource, diagnostic = false, editStarted } = {}) {
  if (!directory || !/^[a-z0-9-]+$/i.test(name)) throw new Error("Capture needs a directory and a simple unique name");
  await mkdir(directory, { recursive: true });
  const started = performance.now(), markerEvidence = [];
  let png, capturedAt, screenshotMs;
  const guard = await captureAccepted({
    identity: () => page.evaluate(readCaptureIdentity),
    inspect: async () => {
      const value = await page.evaluate(readMarkerEvidence, marker);
      markerEvidence.push(value);
      return value.after;
    },
    capture: async () => {
      const screenshotStarted = performance.now();
      png = await page.screenshot({ type: "png", fullPage: false, scale: "device", caret: "initial", animations: "allow" });
      capturedAt = performance.now(); screenshotMs = capturedAt - screenshotStarted;
    },
  }, { expectedFrame: 0, ...(!diagnostic && expectedSource ? { expectedSource } : {}) });
  const issues = [...guard.issues];
  for (const evidence of markerEvidence) issues.push(...(diagnostic ? staleMarkerIssues(evidence, expectedSource) : acceptedMarkerIssues(evidence)));
  if (markerEvidence.length !== 2) issues.push("capture-marker-observation-incomplete");
  if (diagnostic && guard.freshness.status !== "stale") issues.push("failure-freshness-not-stale");
  const evidence = { schema: "superimg-hmr-pixels/1", backend: "chromium-viewport", marker,
    kind: diagnostic ? "stale-diagnostic" : "accepted-media", status: "rejected", issues, guard, markerEvidence,
    context: null, media: null, timings: { clock: "local-monotonic", ...(screenshotMs === undefined ? {} : { screenshotMs }),
      ...(editStarted === undefined || capturedAt === undefined ? {} : { editToCapturedMs: capturedAt - editStarted }) } };
  const describe = (path, bytes, size) => ({ path, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, width: size.width, height: size.height });
  if (png) {
    const path = join(directory, `${name}.context.png`);
    await writeFile(path, png, { flag: "wx" });
    try {
      const dimensions = await sharp(png).metadata();
      evidence.context = describe(path, png, dimensions);
      const crop = markerMediaCrop(guard.before, guard.identityBefore, dimensions);
      if (crop.clipped && !diagnostic) issues.push("media-clipped-by-viewport");
      const media = await sharp(png).extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height }).png().toBuffer();
      const mediaPath = join(directory, `${name}.media.png`);
      await writeFile(mediaPath, media, { flag: "wx" });
      evidence.media = { ...describe(mediaPath, media, crop), crop, geometry: guard.before?.geometry?.content, geometrySnapshot: "before" };
    } catch (error) { issues.push("media-crop-failed"); evidence.cropError = { message: error.message }; }
  }
  evidence.issues = [...new Set(issues)];
  evidence.status = evidence.issues.length ? "rejected" : diagnostic ? "diagnostic" : "accepted";
  evidence.timings.totalMs = performance.now() - started;
  evidence.reportPath = join(directory, `${name}.json`);
  await writeFile(evidence.reportPath, JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" });
  return evidence;
}

/** Executes in the preview, without modifying its DOM or manufacturing evidence. */
export async function readMarkerEvidence(marker) {
  const inspection = window.superimgInspection;
  if (!inspection) return { marker, visibleMarker: null, before: null, after: null, bundle: null, bundleResponse: null };
  let bundle = null;
  const response = await fetch("/api/template-bundle");
  const body = await response.json();
  const bundleResponse = { status: response.status, ...(!response.ok ? { error: body.error ?? null } : {}) };
  if (response.ok) bundle = { source: body.source, inputIdentity: body.inputIdentity, projectionIdentity: body.projectionIdentity, outputIdentity: body.outputIdentity };
  const before = await inspection.inspect({ surfaceId: "dev-preview" });
  let visibleMarker = null;
  for (const frame of document.querySelectorAll("iframe")) {
    const stage = frame.closest("[data-superimg-player-stage], [data-superimg-dom-stage], [data-superimg-stage]");
    if (stage?.style.visibility === "hidden" || getComputedStyle(frame).visibility === "hidden") continue;
    try {
      const root = frame.contentDocument?.getElementById("root");
      const node = root?.querySelector(`[data-bench-marker="${marker}"]`);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      const style = frame.contentWindow.getComputedStyle(node);
      if (box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0) visibleMarker = node.textContent.trim();
    } catch { /* A cross-origin candidate is not accepted output evidence. */ }
  }
  const after = await inspection.inspect({ surfaceId: "dev-preview" });
  return { before, after, bundle, bundleResponse, marker, visibleMarker };
}

/** Await async inspection in Node. Playwright 1.64 waitForFunction truth-tests a
 * returned Promise before it resolves, so an async false predicate ends its wait.
 * This observes state before capture; it never retries a rejected screenshot. */
export async function waitForFailedMarker(page, marker, retainedSource, timeoutMs = 10_000) {
  const started = performance.now(), deadline = started + timeoutMs, observations = [];
  let evidence, count = 0;
  while (performance.now() < deadline) {
    evidence = await page.evaluate(readMarkerEvidence, marker);
    count++;
    const issues = staleMarkerIssues(evidence, retainedSource);
    observations.push({ elapsedMs: performance.now() - started, compilation: evidence.after?.compilation,
      source: evidence.after?.source, generation: evidence.after?.generation,
      bundleResponse: evidence.bundleResponse, issues });
    if (observations.length > 100) observations.shift();
    if (!issues.length) return { ...evidence, failureWait: { count, truncated: count > observations.length, observations } };
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw Object.assign(new Error(`HMR did not expose the intended compile failure for ${marker}: ${staleMarkerIssues(evidence, retainedSource).join(", ")}`),
    { evidence, failureWait: { count, truncated: count > observations.length, observations } });
}

export async function waitForAcceptedMarker(page, marker, timeoutMs = 10_000) {
  const deadline = performance.now() + timeoutMs;
  let evidence;
  while (performance.now() < deadline) {
    evidence = await page.evaluate(readMarkerEvidence, marker);
    const snapshot = evidence.after;
    if (snapshot?.compilation?.status === "succeeded") {
      try {
        if (snapshot.clock.owner !== "inspection") await page.evaluate(generation => window.superimgInspection.setMode({ surfaceId: "dev-preview", expectedGeneration: generation, mode: "inspection" }), snapshot.generation);
        if (snapshot.clock.owner !== "inspection" || snapshot.readiness.status !== "ready" || snapshot.presented?.frame !== 0) await page.evaluate(generation => window.superimgInspection.seek({ surfaceId: "dev-preview", expectedGeneration: generation, frame: 0 }), snapshot.generation);
      } catch (error) {
        if (!/STALE_GENERATION|superseded|generation changed/i.test(String(error))) throw error;
      }
      evidence = await page.evaluate(readMarkerEvidence, marker);
      if (!acceptedMarkerIssues(evidence).length) return evidence;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`HMR did not present ${marker}: ${acceptedMarkerIssues(evidence ?? { marker }).join(", ")}`);
}
