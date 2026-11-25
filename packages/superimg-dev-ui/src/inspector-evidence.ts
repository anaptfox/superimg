import type { AcceptedCaptureReport, PreviewSnapshot } from "@foxworth/superimg/inspection";
import type { BrowserCaptureEvidence } from "@foxworth/superimg/browser-export";
import type { RuntimeFinding, RuntimeMediaCoordinates } from "@superimg/types";

export interface InspectorFindingsReport {
  source?: { id: string; revision?: string };
  generation?: number;
  frame?: number;
  report?: { coordinates?: readonly RuntimeMediaCoordinates[]; findings?: readonly RuntimeFinding[] };
}

/** Associate only identities observed in the accepted canonical tree and report scope. */
export function selectedNodeFindings(snapshot: PreviewSnapshot, target: { id: string; occurrence: string | null }, envelope?: InspectorFindingsReport): { state: "available" | "partial" | "unavailable"; reason?: string; findings: readonly RuntimeFinding[]; unassociatedCount: number } {
  const unavailable = (reason: string) => ({ state: "unavailable" as const, reason, findings: [], unassociatedCount: 0 });
  if (!envelope?.report?.findings) return unavailable("findings-report-unavailable");
  const source = snapshot.source, compilation = snapshot.compilation;
  if (!source?.revision || compilation?.status !== "succeeded" || compilation.source?.id !== source.id || compilation.source.revision !== source.revision) return unavailable("accepted-source-unverified");
  if (snapshot.disposed || snapshot.readiness.status !== "ready" || !snapshot.presented || snapshot.requestedFrame !== snapshot.presented.frame || envelope.source?.id !== source.id || envelope.source.revision !== source.revision || compilation.hostGeneration === undefined || envelope.generation !== compilation.hostGeneration || envelope.frame !== snapshot.presented.frame) return unavailable("findings-report-scope-mismatch");
  const coordinates = (value: { entryId?: string | null; variantId?: string | null; editionId?: string | null }) => ({ entryId: value.entryId ?? null, variantId: value.variantId ?? "default", editionId: value.editionId ?? "default" });
  const scopes = envelope.report.coordinates;
  if (!snapshot.coordinates || scopes?.length !== 1 || !sameFact(coordinates(snapshot.coordinates), coordinates(scopes[0]!))) return unavailable("findings-selection-unverified");
  const identities = snapshot.nodes.filter(node => node.id === target.id);
  if (identities.filter(node => node.occurrence === target.occurrence).length !== 1) return unavailable("canonical-node-identity-unverified");
  const findings: RuntimeFinding[] = [];
  let unassociatedCount = 0;
  for (const finding of envelope.report.findings) {
    const details = finding.details;
    if (!details?.nodeId) { unassociatedCount++; continue; }
    if (details.nodeId !== target.id) continue;
    const occurrence = details.occurrence;
    const verifiedOccurrence = occurrence !== undefined ? occurrence === target.occurrence : target.occurrence === null && identities.length === 1;
    if (!verifiedOccurrence || details.frame !== snapshot.presented.frame || (finding.coordinates && !sameFact(coordinates(finding.coordinates), coordinates(snapshot.coordinates)))) { unassociatedCount++; continue; }
    findings.push(finding);
  }
  return { state: unassociatedCount ? "partial" : "available", findings, unassociatedCount, ...(unassociatedCount ? { reason: "some-findings-lack-verified-node-scope" } : {}) };
}

export interface InspectorBrowserIdentity {
  browserVersion: string;
  url: string;
  documentTimeOrigin: number;
  viewport: { width: number; height: number; dpr: number };
}

export interface InspectorCapture {
  readonly backend: "snapdom";
  readonly blob: Blob;
  readonly url: string;
  readonly report: AcceptedCaptureReport<PreviewSnapshot, InspectorBrowserIdentity>;
  readonly evidence: BrowserCaptureEvidence;
}
type ComparableCapture = Pick<InspectorCapture, "backend" | "report"> & Partial<Pick<InspectorCapture, "evidence">>;
const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const text = (value: unknown) => typeof value === "string" && value.length > 0;
function sameFact(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => sameFact(value, right[index]));
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a).filter(key => a[key] !== undefined);
  return keys.length === Object.keys(b).filter(key => b[key] !== undefined).length && keys.every(key => Object.hasOwn(b, key) && sameFact(a[key], b[key]));
}
function validRect(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const rect = value as Record<string, unknown>;
  return finite(rect.x) && finite(rect.y) && positive(rect.width) && positive(rect.height);
}
function validGeometry(value: BrowserCaptureEvidence["geometry"] | undefined): boolean {
  return !!value && [value.w0, value.h0, value.vbW, value.vbH, value.targetW, value.targetH].every(positive) && [value.contentX, value.contentY].every(finite) && (value.clip === null || validRect(value.clip));
}
export function comparableInspectorCaptures(a: ComparableCapture, b: ComparableCapture): string[] {
  const reasons: string[] = [];
  const compare = (label: string, left: unknown, right: unknown, valid: (value: unknown) => boolean = value => value !== undefined) => {
    if (!valid(left) || !valid(right)) reasons.push(`${label}-unavailable`);
    else if (!sameFact(left, right)) reasons.push(`${label}-differs`);
  };
  if (a.report.status !== "accepted" || b.report.status !== "accepted") reasons.push("capture-not-accepted");
  compare("capture-backend", a.backend, b.backend, text);
  const left = a.report.after, right = b.report.after;
  if (!left || !right) return [...reasons, "accepted-presentation-unavailable"];
  compare("source", left.source?.id, right.source?.id, text);
  compare("surfaceId", left.surfaceId, right.surfaceId, text);
  for (const field of ["width", "height", "fps", "totalFrames"] as const) compare(field, left[field], right[field], positive);
  for (const field of ["routes", "currentPart", "stepId"] as const) compare(field, left[field], right[field]);
  const coordinates = (value: unknown) => !!value && typeof value === "object" && ["entryId", "variantId", "editionId"].every(key => { const item = Reflect.get(value, key); return item === null || text(item); });
  compare("selection-coordinates", left.coordinates, right.coordinates, coordinates);
  const frame = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  compare("frame", left.presented?.frame, right.presented?.frame, frame);
  compare("requested-frame", left.requestedFrame, right.requestedFrame, frame);
  for (const [name, report] of [["baseline", a.report], ["current", b.report]] as const) {
    if (report.freshness?.status !== "matched") reasons.push(`${name}-source-${report.freshness?.status === "stale" ? "stale" : "unavailable"}`);
  }
  const browserA = a.report.identityAfter, browserB = b.report.identityAfter;
  compare("browser-version", browserA?.browserVersion, browserB?.browserVersion, text);
  compare("url", browserA?.url, browserB?.url, text);
  const viewport = (value: unknown) => !!value && typeof value === "object" && ["width", "height", "dpr"].every(key => positive(Reflect.get(value, key)));
  compare("viewport", browserA?.viewport, browserB?.viewport, viewport);
  const requestedA = a.evidence?.requested, requestedB = b.evidence?.requested;
  if (!requestedA || !requestedB) reasons.push("capture-requested-unavailable");
  for (const field of ["width", "height", "dpr", "scale"] as const) compare(`capture-${field}`, requestedA?.[field], requestedB?.[field], positive);
  compare("capture-region", requestedA?.region, requestedB?.region, value => value === null || value === "viewport" || validRect(value));
  const dimensions = (value: unknown) => !!value && typeof value === "object" && ["width", "height"].every(key => positive(Reflect.get(value, key)));
  compare("capture-actual", a.evidence?.actual, b.evidence?.actual, dimensions);
  compare("capture-geometry", a.evidence?.geometry, b.evidence?.geometry, value => validGeometry(value as BrowserCaptureEvidence["geometry"] | undefined));
  // Capture-local geometry is authoritative. Inspector placement, selected nodes,
  // source/presentation revisions and document time origins may change per edit.
  return reasons;
}
export function pixelDifference(a: Uint8ClampedArray, b: Uint8ClampedArray): { changedPixels: number; totalPixels: number; pixels: Uint8ClampedArray<ArrayBuffer> } {
  if (a.length !== b.length || a.length % 4 !== 0) throw new Error("Captured image dimensions differ");
  const pixels = new Uint8ClampedArray(a.length);
  let changedPixels = 0;
  for (let i = 0; i < a.length; i += 4) {
    const changed = a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3];
    if (changed) changedPixels++;
    pixels.set(changed ? [255, 0, 120, 255] : [235, 235, 235, 255], i);
  }
  return { changedPixels, totalPixels: a.length / 4, pixels };
}

/** Intersect transformed edges, rather than preserving width after clamping an origin. */
export function visibleNodeCrop(rect: { x: number; y: number; width: number; height: number }, stage: { width: number; height: number }, image: { width: number; height: number }) {
  const sx = image.width / stage.width, sy = image.height / stage.height;
  const x = Math.max(0, Math.floor(rect.x * sx)), y = Math.max(0, Math.floor(rect.y * sy));
  const right = Math.min(image.width, Math.ceil((rect.x + rect.width) * sx)), bottom = Math.min(image.height, Math.ceil((rect.y + rect.height) * sy));
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}
