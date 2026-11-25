import { captureAccepted as guardCapture, sameCaptureFact, type CaptureFreshness, type CaptureSnapshot as PortableSnapshot, type PreviewCompilationState } from "../../packages/superimg-player/src/inspection/capture.js";
import type { BrowserConnection, BrowserIdentity } from "./transport.js";

export interface CaptureSnapshot extends Omit<PortableSnapshot, "presented" | "readiness" | "clock" | "source"> {
  surfaceId: string; generation: number; requestedFrame: number | null;
  presented?: { frame: number; revision: number } | null;
  readiness: { status: string }; clock: { owner: string };
  source?: { id: string; revision?: string } | null;
  compilation?: PreviewCompilationState | null;
}
export interface CaptureAdapter {
  inspect(): Promise<CaptureSnapshot>;
  identity(): Promise<BrowserIdentity>;
  screenshot(): Promise<void>;
}
export interface CaptureReport {
  schema: "superimg-browser-capture/1";
  status: "accepted" | "rejected";
  issues: string[];
  backend?: "chromium-viewport";
  expectedFrame?: number;
  before?: CaptureSnapshot;
  after?: CaptureSnapshot;
  browserBefore?: BrowserIdentity;
  browserAfter?: BrowserIdentity;
  freshness?: CaptureFreshness;
  timings?: { clock: "local-monotonic"; totalMs: number; captureMs?: number };
  error?: { message: string; code?: string };
}

/** Compatibility facade over the public, browser-safe acceptance guard. */
export async function captureAccepted(adapter: CaptureAdapter, expectedFrame?: number, expectedRevision?: string): Promise<CaptureReport> {
  let sourceId: string | undefined;
  const result = await guardCapture({
    inspect: async () => { const value = await adapter.inspect(); sourceId = value.source?.id; return value; },
    identity: () => adapter.identity(), capture: () => adapter.screenshot(),
  }, { ...(expectedFrame !== undefined ? { expectedFrame } : {}) });
  const { schema: _schema, identityBefore, identityAfter, ...facts } = result;
  const report: CaptureReport = { ...facts, schema: "superimg-browser-capture/1", backend: "chromium-viewport", browserBefore: identityBefore, browserAfter: identityAfter };
  if (expectedRevision !== undefined) {
    const matched = !!sourceId && report.after?.source?.revision === expectedRevision && report.freshness?.status !== "stale";
    report.freshness = { status: matched ? "matched" : "stale", reason: matched ? "accepted-source-matches" : "expected-revision-not-presented", expected: sourceId ? { id: sourceId, revision: expectedRevision } : null, accepted: report.after?.source ?? null };
    if (!matched) { report.status = "rejected"; report.issues.push("expected-source-not-presented"); }
  }
  return report;
}

export type InspectionEntry = "public" | "fixture";
export function inspectionCall(entry: InspectionEntry, method: string, input: Record<string, unknown>): string {
  const expression = entry === "public" ? "window.superimgInspection" : "window.__inspectionFixture?.inspection";
  return `(async()=>{const inspection=${expression};if(!inspection)throw new Error('Inspection surface unavailable');return await inspection[${JSON.stringify(method)}](${JSON.stringify(input)})})()`;
}
export async function selectFrame(browser: BrowserConnection, entry: InspectionEntry, surfaceId: string, frame: number): Promise<CaptureSnapshot> {
  if (!Number.isSafeInteger(frame) || frame < 0) throw new Error("Frame must be a nonnegative integer");
  const before = await browser.evaluate<CaptureSnapshot>(inspectionCall(entry, "inspect", { surfaceId }));
  const owned = await browser.evaluate<CaptureSnapshot>(inspectionCall(entry, "setMode", { surfaceId, expectedGeneration: before.generation, mode: "inspection" }));
  return browser.evaluate<CaptureSnapshot>(inspectionCall(entry, "seek", { surfaceId, expectedGeneration: owned.generation, frame }));
}
export function browserCapture(browser: BrowserConnection, entry: InspectionEntry, surfaceId: string, path: string): CaptureAdapter {
  return { inspect: () => browser.evaluate<CaptureSnapshot>(inspectionCall(entry, "inspect", { surfaceId })), identity: () => browser.identity(), screenshot: async () => { await browser.command(["screenshot", path]); } };
}

export interface MediaCrop { left: number; top: number; width: number; height: number; clipped: boolean; scaleX: number; scaleY: number }
/** Map the accepted content rectangle to the ONE captured viewport image. Never scroll. */
export function mediaCrop(snapshot: CaptureSnapshot, browser: BrowserIdentity, image: { width: number; height: number }): MediaCrop {
  const geometry = snapshot.geometry as { content?: { x: number; y: number; width: number; height: number } | null } | undefined;
  const box = geometry?.content;
  if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite) || !(box.width > 0 && box.height > 0)) throw new Error("Accepted media content geometry is unavailable");
  const scaleX = image.width / browser.viewport.width, scaleY = image.height / browser.viewport.height;
  const raw = { left: Math.round(box.x * scaleX), top: Math.round(box.y * scaleY), right: Math.round((box.x + box.width) * scaleX), bottom: Math.round((box.y + box.height) * scaleY) };
  const left = Math.max(0, raw.left), top = Math.max(0, raw.top), right = Math.min(image.width, raw.right), bottom = Math.min(image.height, raw.bottom);
  if (right <= left || bottom <= top) throw new Error("Accepted media is outside the captured viewport");
  return { left, top, width: right - left, height: bottom - top, clipped: left !== raw.left || top !== raw.top || right !== raw.right || bottom !== raw.bottom, scaleX, scaleY };
}

export function comparable(before: CaptureReport, after: CaptureReport): { comparable: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (before.status !== "accepted" || after.status !== "accepted") reasons.push("capture-not-accepted");
  if (!before.backend || !after.backend) reasons.push("capture-backend-unknown");
  else if (before.backend !== after.backend) reasons.push("capture-backend-differs");
  if (!before.after?.source?.id || !after.after?.source?.id) reasons.push("source-identity-unknown");
  else if (before.after.source.id !== after.after.source.id) reasons.push("source-differs");
  if (after.freshness?.status === "stale") reasons.push("current-source-stale");
  for (const field of ["surfaceId", "routes", "currentPart", "stepId", "coordinates"] as const) {
    if (!sameCaptureFact(before.after?.[field], after.after?.[field])) reasons.push(`${field}-differs`);
  }
  if (!before.after?.coordinates || !after.after?.coordinates) reasons.push("selection-coordinates-unknown");
  for (const field of ["width", "height", "fps", "totalFrames"] as const) {
    if (before.after?.[field] === undefined || after.after?.[field] === undefined) reasons.push(`${field}-unknown`);
    else if (before.after[field] !== after.after[field]) reasons.push(`${field}-differs`);
  }
  if (before.after?.presented?.frame !== after.after?.presented?.frame) reasons.push("frame-differs");
  if (before.browserAfter?.url !== after.browserAfter?.url) reasons.push("url-differs");
  if (!before.browserAfter?.browserVersion || !after.browserAfter?.browserVersion) reasons.push("browser-version-unknown");
  else if (before.browserAfter.browserVersion !== after.browserAfter.browserVersion) reasons.push("browser-version-differs");
  if (before.browserAfter?.viewport.dpr !== after.browserAfter?.viewport.dpr) reasons.push("viewport-differs");
  const content = (report: CaptureReport) => { const box = (report.after?.geometry as { content?: { width: number; height: number } } | undefined)?.content; return box ? { width: box.width, height: box.height } : null; };
  if (!content(before) || !content(after)) reasons.push("media-geometry-unknown");
  else if (!sameCaptureFact(content(before), content(after))) reasons.push("media-size-differs");
  // Source revisions/generations may intentionally differ across an edit.
  return { comparable: reasons.length === 0, reasons: [...new Set(reasons)] };
}
