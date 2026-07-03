//! Web Worker entry — standalone @superimg/browser-bundler off the main thread.

import { initBundler, bundleTemplateBrowser } from "@superimg/browser-bundler";

let initPromise: Promise<void> | null = null;

async function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = initBundler();
  await initPromise;
}

self.onmessage = async (event: MessageEvent<{ id: number; code: string }>) => {
  const { id, code } = event.data;
  try {
    await ensureInit();
    const result = await bundleTemplateBrowser(code);
    self.postMessage({ id, ok: true as const, result });
  } catch (err) {
    self.postMessage({
      id,
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};