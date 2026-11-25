//! Pure authored observations. No renderer, filesystem, host authority, or aesthetic verdict.
import type { JsonObject, ReviewCheck, ReviewObservationContext, ReviewPlan } from "@superimg/types";
const MAX_OBSERVATION_BYTES = 16_384;
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
export interface ReviewAssertion {
  readonly id: string;
  readonly label: string;
  readonly beat: string;
  readonly metric: string;
  readonly status: "pass" | "fail" | "unverified";
  readonly expected: Pick<ReviewCheck, "min" | "max" | "equals">;
  readonly observed?: string | number | boolean | null;
  readonly reason?: string;
}

function jsonObservation(value: unknown): JsonObject {
  const visit = (item: unknown, depth: number): void => {
    if (depth > 12) throw new Error("Review observation exceeds 12 levels");
    if (item === null || typeof item === "boolean" || typeof item === "string" || finite(item)) return;
    if (Array.isArray(item)) { item.forEach((child) => visit(child, depth + 1)); return; }
    if (object(item) && (Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null)) { Object.values(item).forEach((child) => visit(child, depth + 1)); return; }
    throw new Error("Review observation must contain only finite JSON values");
  };
  if (!object(value)) throw new Error("Review observation must return an object");
  visit(value, 0);
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).byteLength > MAX_OBSERVATION_BYTES) throw new Error(`Review observation exceeds ${MAX_OBSERVATION_BYTES} bytes`);
  return JSON.parse(serialized) as JsonObject;
}

export function observeReviewBeat(plan: ReviewPlan, context: ReviewObservationContext): { observation?: JsonObject; observationError?: string } {
  if (plan.observe === undefined) return {};
  try { return { observation: jsonObservation(plan.observe(context)) }; }
  catch (error) { return { observationError: error instanceof Error ? error.message : String(error) }; }
}

export function evaluateReviewAssertions(checks: readonly ReviewCheck[], beat: string, observation?: JsonObject): ReviewAssertion[] {
  return checks.filter((check) => check.beat === undefined || check.beat === beat).map((check) => {
    let found: unknown = observation;
    for (const part of check.metric.split(".")) found = object(found) && Object.hasOwn(found, part) ? found[part] : undefined;
    const expected = { ...(check.min === undefined ? {} : { min: check.min }), ...(check.max === undefined ? {} : { max: check.max }), ...(check.equals === undefined ? {} : { equals: check.equals }) };
    const base = { id: check.id, label: check.label, beat, metric: check.metric, expected };
    if (found === undefined || !(found === null || ["string", "number", "boolean"].includes(typeof found))) return { ...base, status: "unverified", reason: "Observation metric is unavailable or is not a JSON primitive" };
    if ((check.min !== undefined || check.max !== undefined) && !finite(found)) return { ...base, status: "unverified", reason: "Observation metric is not a finite number" };
    const pass = (check.min === undefined || Number(found) >= check.min) && (check.max === undefined || Number(found) <= check.max) && (check.equals === undefined || found === check.equals);
    return { ...base, status: pass ? "pass" : "fail", observed: found as string | number | boolean | null };
  });
}


/** Structural bounds only; an unavailable observation remains unverified. */
export function observeBounds(bounds: Readonly<{x:number;y:number;width:number;height:number}> | null | undefined, canvas: Readonly<{width:number;height:number}>): JsonObject {
  if (!bounds || ![bounds.x,bounds.y,bounds.width,bounds.height,canvas.width,canvas.height].every(Number.isFinite) || bounds.width < 0 || bounds.height < 0 || canvas.width <= 0 || canvas.height <= 0) return {};
  return { contained: bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= canvas.width && bounds.y + bounds.height <= canvas.height, width: bounds.width, height: bounds.height };
}
/** Absence is meaningful only for a complete inventory; duplicates are ambiguous. */
export function observePresence(ids: readonly string[], target: string, coverage: "complete" | "partial" = "partial"): JsonObject {
  const count = ids.filter(id => id === target).length;
  return count > 1 ? {} : count === 1 ? { present: true } : coverage === "complete" ? { present: false } : {};
}
