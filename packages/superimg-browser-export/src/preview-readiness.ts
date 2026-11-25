import { waitForBrowserResources } from "@superimg/core/html";
import type { FrameReadinessPolicy } from "@superimg/types";

/** Wait for a DOM resource while releasing every listener on abort or completion. */
export function waitForResource(
  target: EventTarget,
  loadedEvent: string,
  label: string,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(loadedEvent, loaded);
      target.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
    };
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error(`Browser capture resource failed: ${label}`)); };
    const aborted = () => { cleanup(); reject(signal.reason); };
    if (signal.aborted) { aborted(); return; }
    target.addEventListener(loadedEvent, loaded, { once: true });
    target.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
  });
}

export async function waitForFrameResources(
  root: HTMLElement,
  policy: FrameReadinessPolicy | undefined,
  signal: AbortSignal,
): Promise<void> {
  const implicit = policy?.waitImplicit ?? ["fonts", "images"];
  const result = await waitForBrowserResources({ root, timeoutMs: policy?.timeoutMs ?? 8000, waitFonts: implicit.includes("fonts"), waitImages: implicit.includes("images"), signal });
  signal.throwIfAborted();
  if (!result.ok) throw new Error(`Browser capture resource failed: ${result.error ?? result.open.join(", ")}`);
}
