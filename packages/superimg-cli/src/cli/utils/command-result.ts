/** CLI transport envelope. Native receipts and reports retain their own schema. */
export function commandResult<T extends object>(value: T, options: { ok?: boolean; code?: string; message?: string } = {}) {
  const original = value as T & { schemaVersion?: unknown };
  const ok = options.ok ?? true;
  return {
    ...value,
    ...(typeof original.schemaVersion === "number" && original.schemaVersion !== 1 ? { resultSchemaVersion: original.schemaVersion } : {}),
    schemaVersion: 1 as const,
    ok,
    certainty: "completed" as const,
    certaintyScope: "command" as const,
    ...(ok ? {} : { error: { code: options.code ?? "CHECK_FAILED", message: options.message ?? "The command completed with failed checks." } }),
  };
}

export function commandError(error: unknown) {
  const e = (error && typeof error === "object" ? error : {}) as { code?: string; path?: string; message?: string; failures?: unknown; exitCode?: number; certainty?: string; certaintyScope?: string; phase?: string; effectState?: string; findings?: unknown; details?: unknown; suggestion?: string };
  const usage = e.code?.startsWith("commander.") === true || e.code === "MISSING_DESTINATION" || e.code === "INVALID_TIME" || e.code === "INVALID_DIFF" || e.code === "INVALID_DATA" || e.code === "CONFLICTING_STILL_SELECTION";
  const findings = e.failures ?? e.findings;
  const details = e.details !== null && typeof e.details === "object" && !Array.isArray(e.details)
    ? Object.fromEntries(Object.entries(e.details).filter(([key]) => key !== "findings" && key !== "failures")) : e.details;
  const certainty = usage ? { certainty: "not-started", certaintyScope: "command" } : e.certainty !== undefined ? { certainty: e.certainty, certaintyScope: e.certaintyScope ?? "command" } : e.phase === "admission" ? { certainty: "completed", certaintyScope: "command" } : e.effectState === "not-started" || e.effectState === "completed" ? { certainty: e.effectState, certaintyScope: "publication" } : { certainty: "unknown", certaintyScope: e.effectState === undefined ? "command" : "publication" };
  return {
    exitCode: usage ? 2 : e.exitCode || 1,
    result: { schemaVersion: 1 as const, ok: false as const, ...certainty, ...(e.phase === undefined ? {} : { phase: e.phase }), ...(e.effectState === undefined ? {} : { publication: { state: e.effectState } }), error: { code: e.code ?? "COMMAND_FAILED", message: e.message ?? (typeof error === "string" ? error : "Command failed"), ...(e.path === undefined ? {} : { path: e.path }), ...(e.suggestion === undefined ? {} : { suggestion: e.suggestion }), ...(details === undefined || (typeof details === "object" && details !== null && !Object.keys(details).length) ? {} : { details }) }, ...(findings === undefined ? {} : { findings }) },
  };
}
