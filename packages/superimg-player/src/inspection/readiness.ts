import { waitForBrowserResources } from "@superimg/core/html";
import { PreviewInspectionError } from "./types.js";

/** Host owns the accepted revision, custom readiness, deadline and cancellation. */
export async function waitForResources(document: Document, surfaceId: string, timeoutMs: number, signal: AbortSignal, custom?: (signal: AbortSignal) => Promise<void>): Promise<void> {
  if (signal.aborted) throw new PreviewInspectionError("PRESENTATION_SUPERSEDED", "Inspection was replaced or disposed", surfaceId);
  const linked = new AbortController();
  const abort = () => linked.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const probe = waitForBrowserResources({ document, root: document.getElementById("root") ?? document.body, timeoutMs, waitVideos: true, signal: linked.signal });
    const host = custom ? Promise.resolve().then(() => custom(linked.signal)) : Promise.resolve();
    const interrupted = new Promise<never>((_, reject) => {
      const cancelled = () => reject(new PreviewInspectionError("PRESENTATION_SUPERSEDED", "Inspection was replaced or disposed", surfaceId));
      linked.signal.addEventListener("abort", cancelled, { once: true });
      timer = setTimeout(() => reject(new PreviewInspectionError("RESOURCE_READINESS_TIMEOUT", `Resources did not become ready within ${timeoutMs}ms`, surfaceId)), timeoutMs);
    });
    const [result] = await Promise.race([Promise.all([probe, host]), interrupted]);
    if (!result.ok) throw new PreviewInspectionError(result.aborted ? "PRESENTATION_SUPERSEDED" : result.error === "timeout" ? "RESOURCE_READINESS_TIMEOUT" : "RESOURCE_FAILED", result.error === "timeout" ? `Resources did not become ready within ${timeoutMs}ms` : result.error ?? "Resource failed", surfaceId);
  } catch (cause) {
    if (cause instanceof PreviewInspectionError) throw cause;
    throw new PreviewInspectionError("RESOURCE_FAILED", cause instanceof Error ? cause.message : String(cause), surfaceId);
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); linked.abort(); }
}
