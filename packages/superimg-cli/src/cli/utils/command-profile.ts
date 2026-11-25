//! Command-local diagnostics. Durations are inclusive and never added as a total.
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { JsonObject } from "@superimg/types";

export interface CommandProfile {
  schemaVersion: 1; kind: string; clockDomain: string; wallTimeMs: number; processElapsedMs: number;
  spans: { id: number; parentId: number | null; stage: string; startMs: number; durationMs: number; status: "completed" | "failed"; origin: "command" | "renderer" }[];
  counts: Record<string, number>; truncated: boolean; notes: string[];
}
interface Scope { profile: CommandProfile; started: number; parentId: number | null; enabled: boolean; traceDirectory?: string; diagnostics: JsonObject[] }
const local = new AsyncLocalStorage<Scope>();
export function commandTraceDirectory(): string | undefined { return local.getStore()?.traceDirectory; }
export function commandRendererTiming(event: { stage: string; durationMs: number; status: "completed" | "failed"; clock: "local-monotonic" }): void {
  const scope = local.getStore(); if (!scope?.enabled) return;
  record(scope, { stage: event.stage, durationMs: event.durationMs, status: event.status, origin: "renderer", startMs: Math.max(0, performance.now() - scope.started - event.durationMs) });
}
export function commandInspectionDiagnostics(value: JsonObject): void { local.getStore()?.diagnostics.push(value); }
export function commandProfilingEnabled(): boolean { return local.getStore()?.enabled === true; }
function record(scope: Scope, value: Omit<CommandProfile["spans"][number], "id" | "parentId">) {
  scope.profile.counts[value.stage] = (scope.profile.counts[value.stage] ?? 0) + 1;
  if (scope.profile.spans.length >= 2_000) { scope.profile.truncated = true; return; }
  scope.profile.spans.push({ id: scope.profile.spans.length + 1, parentId: scope.parentId, ...value });
}
export async function profileStage<T>(stage: string, work: () => Promise<T>): Promise<T> {
  const scope = local.getStore(); if (!scope?.enabled) return work();
  const started = performance.now();
  const placeholder = { id: scope.profile.spans.length + 1, parentId: scope.parentId, stage, startMs: started - scope.started, durationMs: 0, status: "completed" as "completed" | "failed", origin: "command" as const };
  if (scope.profile.spans.length < 2_000) scope.profile.spans.push(placeholder); else scope.profile.truncated = true;
  scope.profile.counts[stage] = (scope.profile.counts[stage] ?? 0) + 1;
  try { return await local.run({ ...scope, parentId: placeholder.id }, work); }
  catch (error) { placeholder.status = "failed"; throw error; }
  finally { placeholder.durationMs = performance.now() - started; }
}
export async function withCommandProfile<T>(kind: string, options: { profile?: boolean; trace?: boolean; renderedLayout?: boolean }, work: () => Promise<T>, emit: (value: unknown) => void = value => process.stderr.write(JSON.stringify(value) + "\n")): Promise<T> {
  if (options.trace && !options.renderedLayout) throw new Error("--trace requires --rendered-layout; ordinary checks do not open Chromium");
  if (!options.profile && !options.trace) return work();
  const started = performance.now();
  const profile: CommandProfile = { schemaVersion: 1, kind, clockDomain: `node:${process.pid}:${randomUUID()}`, wallTimeMs: 0, processElapsedMs: 0, spans: [], counts: {}, truncated: false, notes: ["Spans are inclusive and may overlap; do not sum them. Renderer durations use its local monotonic clock. wallTimeMs covers the command action, including its module load; processElapsedMs covers Node startup through the final observation, before process exit. External benchmarks measure whole-process wall time including exit. Build orchestration occurs outside this CLI process."] };
  const scope: Scope = { profile, started, parentId: null, enabled: !!options.profile, ...(options.trace ? { traceDirectory: join(tmpdir(), `superimg-inspection-traces-${randomUUID()}`) } : {}), diagnostics: [] };
  try { return await local.run(scope, work); }
  finally {
    profile.wallTimeMs = performance.now() - started;
    profile.processElapsedMs = performance.now();
    emit({ kind: "superimg-command-diagnostics", ...(options.profile ? { profile } : {}), ...(scope.traceDirectory ? { traceDirectory: scope.traceDirectory } : {}), ...(scope.diagnostics.length ? { observations: scope.diagnostics } : {}) });
  }
}
