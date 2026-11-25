//! Portable acceptance guard. Hosts own clocks, transport, image bytes and files.

export interface InspectionSourceIdentity { readonly id: string; readonly revision?: string }
export interface PreviewCompilationState {
  readonly status: "pending" | "succeeded" | "failed";
  readonly source?: InspectionSourceIdentity;
  readonly inputIdentity?: string;
  readonly projectionIdentity?: string;
  /** Host compile generation; distinct from Player presentation generation. */
  readonly hostGeneration?: number;
  readonly error?: { readonly code?: string; readonly message: string };
}
export interface CaptureSnapshot {
  readonly surfaceId: string;
  readonly generation: number;
  readonly requestedFrame: number | null;
  readonly presented?: { readonly frame: number; readonly revision: number } | null;
  readonly readiness: { readonly status: string };
  readonly clock: { readonly owner: string };
  readonly source?: InspectionSourceIdentity | null | undefined;
  readonly compilation?: PreviewCompilationState | null;
  readonly coordinates?: Readonly<{ entryId: string | null; variantId: string | null; editionId: string | null }> | undefined;
  readonly geometry?: unknown;
  readonly routes?: unknown;
  readonly currentPart?: unknown;
  readonly stepId?: unknown;
  readonly width?: number;
  readonly height?: number;
  readonly fps?: number;
  readonly totalFrames?: number;
}
export interface CaptureFreshness {
  readonly status: "matched" | "stale" | "unknown";
  readonly reason: string;
  readonly expected: InspectionSourceIdentity | null;
  readonly accepted: InspectionSourceIdentity | null;
  readonly inputIdentity?: string;
}
export interface AcceptedCaptureAdapter<S extends CaptureSnapshot, I> {
  inspect(): Promise<S>;
  identity(): Promise<I>;
  /** Save bytes in host-owned storage, including when the guard rejects them. */
  capture(): Promise<void>;
}
export interface AcceptedCaptureReport<S extends CaptureSnapshot = CaptureSnapshot, I = unknown> {
  schema: "superimg-accepted-capture/1";
  status: "accepted" | "rejected";
  issues: string[];
  expectedFrame?: number;
  before?: S;
  after?: S;
  identityBefore?: I;
  identityAfter?: I;
  freshness: CaptureFreshness;
  timings: { clock: "local-monotonic"; totalMs: number; captureMs?: number };
  error?: { message: string; code?: string };
}

/** Stable comparison of detached JSON facts; no DOM/transport objects belong here. */
export function sameCaptureFact(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => sameCaptureFact(value, right[index]));
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a).filter(key => a[key] !== undefined);
  return keys.length === Object.keys(b).filter(key => b[key] !== undefined).length && keys.every(key => Object.hasOwn(b, key) && sameCaptureFact(a[key], b[key]));
}

export function captureFreshness(snapshot: CaptureSnapshot | undefined, expected?: InspectionSourceIdentity): CaptureFreshness {
  const accepted = snapshot?.source ?? null;
  const compilation = snapshot?.compilation;
  const intended = expected ?? compilation?.source ?? null;
  const extra = compilation?.inputIdentity ? { inputIdentity: compilation.inputIdentity } : {};
  if (!accepted?.revision) return { status: "unknown", reason: "accepted-source-unavailable", accepted, expected: intended, ...extra };
  if (compilation?.status === "pending" || compilation?.status === "failed") return { status: "stale", reason: `compilation-${compilation.status}`, accepted, expected: intended, ...extra };
  if (!intended?.revision) return { status: "unknown", reason: "expected-source-unavailable", accepted, expected: intended, ...extra };
  const matched = accepted.id === intended.id && accepted.revision === intended.revision;
  return { status: matched ? "matched" : "stale", reason: matched ? "accepted-source-matches" : "accepted-source-differs", accepted, expected: intended, ...extra };
}

function readiness(snapshot: CaptureSnapshot, expectedFrame?: number): string[] {
  const issues: string[] = [];
  if (!Number.isInteger(snapshot.generation)) issues.push("missing-generation");
  if (!snapshot.presented || !Number.isInteger(snapshot.presented.frame) || !Number.isInteger(snapshot.presented.revision)) issues.push("missing-presentation");
  if (snapshot.readiness?.status !== "ready") issues.push("resources-not-ready");
  if (snapshot.clock?.owner !== "inspection") issues.push("clock-not-owned");
  if (snapshot.requestedFrame !== snapshot.presented?.frame) issues.push("requested-frame-not-presented");
  if (expectedFrame !== undefined && snapshot.presented?.frame !== expectedFrame) issues.push("unexpected-frame");
  return issues;
}

/** Observe once around one capture. Rejected bytes are retained; effects are never replayed. */
export async function captureAccepted<S extends CaptureSnapshot, I>(adapter: AcceptedCaptureAdapter<S, I>, options: { expectedFrame?: number; expectedSource?: InspectionSourceIdentity; signal?: AbortSignal } = {}): Promise<AcceptedCaptureReport<S, I>> {
  const started = performance.now();
  const report: AcceptedCaptureReport<S, I> = { schema: "superimg-accepted-capture/1", status: "rejected", issues: [], ...(options.expectedFrame !== undefined ? { expectedFrame: options.expectedFrame } : {}), freshness: captureFreshness(undefined, options.expectedSource), timings: { clock: "local-monotonic", totalMs: 0 } };
  const checkpoint = () => { if (options.signal?.aborted) throw Object.assign(new Error("Capture was cancelled"), { code: "CAPTURE_ABORTED" }); };
  try {
    checkpoint();
    report.identityBefore = structuredClone(await adapter.identity());
    report.before = structuredClone(await adapter.inspect());
    report.issues.push(...readiness(report.before, options.expectedFrame));
    checkpoint();
    const captureStarted = performance.now();
    await adapter.capture();
    report.timings.captureMs = performance.now() - captureStarted;
    checkpoint();
    report.after = structuredClone(await adapter.inspect());
    report.identityAfter = structuredClone(await adapter.identity());
    report.issues.push(...readiness(report.after, options.expectedFrame));
    for (const field of ["surfaceId", "generation", "requestedFrame", "presented", "source", "compilation", "coordinates", "geometry", "routes", "currentPart", "stepId", "width", "height", "fps", "totalFrames"] as const) {
      if (!sameCaptureFact(report.before[field], report.after[field])) report.issues.push(`${field}-changed`);
    }
    if (!sameCaptureFact(report.identityBefore, report.identityAfter)) report.issues.push("capture-target-or-geometry-changed");
    report.freshness = captureFreshness(report.after, options.expectedSource);
    if (options.expectedSource && report.freshness.status !== "matched") report.issues.push("expected-source-not-presented");
    report.issues = [...new Set(report.issues)];
    report.status = report.issues.length ? "rejected" : "accepted";
  } catch (cause) {
    const error = cause as { message?: string; code?: string };
    report.error = { message: error?.message ?? String(cause), ...(error?.code ? { code: error.code } : {}) };
    report.issues.push("capture-incomplete");
    report.freshness = captureFreshness(report.after ?? report.before, options.expectedSource);
  } finally { report.timings.totalMs = performance.now() - started; }
  return report;
}
