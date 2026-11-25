import type { BrowserConnection } from "./transport.js";

interface TransportFailure { message: string; code?: string }
/** Cleanup is single-shot; an unknown transport outcome ends daemon input. */
export async function finishBrowserObservation(browser: BrowserConnection, options: { tracePath?: string; priorError?: { code?: string }; enabled: boolean }): Promise<{ diagnostics: Record<string, unknown>; traceError?: TransportFailure }> {
  let traceError: TransportFailure | undefined;
  if (options.tracePath && options.priorError?.code !== "COMMAND_UNCERTAIN") {
    try { await browser.command(["trace", "stop", options.tracePath]); }
    catch (cause) {
      const failure = cause as { message?: string; code?: string };
      traceError = { message: failure.message ?? String(cause), ...(failure.code ? { code: failure.code } : {}) };
    }
  } else if (options.tracePath) traceError = { message: "Trace stop was withheld after an uncertain operation; inspect the retained session before another input.", code: "COMMAND_UNCERTAIN" };
  const uncertain = options.priorError?.code === "COMMAND_UNCERTAIN" || traceError?.code === "COMMAND_UNCERTAIN";
  const diagnostics = options.enabled && !uncertain ? await browserDiagnostics(browser) : { scope: "unavailable", reason: uncertain ? "transport-outcome-unknown" : "session-not-verified", note: "No further daemon commands were issued." };
  return { diagnostics, ...(traceError ? { traceError } : {}) };
}

const LIMIT = 100;
const TEXT_LIMIT = 2_000;
function bounded(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.length > TEXT_LIMIT ? value.slice(0, TEXT_LIMIT) + "…" : value;
  if (depth > 8) return "[depth limit]";
  if (Array.isArray(value)) return value.slice(-LIMIT).map(item => bounded(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, LIMIT).map(([key, item]) => [key, bounded(item, depth + 1)]));
  return value;
}
export async function browserDiagnostics(browser: BrowserConnection): Promise<Record<string, unknown>> {
  const observations: Record<string, unknown> = {};
  for (const [key, args] of [["console", ["console"]], ["errors", ["errors"]], ["requests", ["network", "requests"]], ["aria", ["snapshot", "--compact", "--depth", "6"]]] as const) {
    try {
      const response = await browser.command(args, false);
      const serialized = JSON.stringify(response.data ?? response);
      const compact = bounded(response.data ?? response);
      const compactJson = JSON.stringify(compact);
      observations[key] = { value: compactJson.length > 64 * 1024 ? { preview: compactJson.slice(0, 64_000) } : compact, truncated: serialized !== compactJson || compactJson.length > 64 * 1024, scope: key === "requests" ? "observed-request-history" : key === "aria" ? "current-context" : "buffered-unscoped" };
    } catch (cause) {
      const error = cause as { code?: string; message?: string };
      observations[key] = { unavailable: error.message ?? String(cause), code: error.code };
      if (error.code === "COMMAND_UNCERTAIN") break;
    }
  }
  return { maxEntries: LIMIT, maxTextLength: TEXT_LIMIT, coverage: "Browser refs are temporary; buffered errors are not attributed to this capture. Requests are observed only after network collection begins.", observations };
}
