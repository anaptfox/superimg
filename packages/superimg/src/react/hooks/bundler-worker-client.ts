//! Queues browser template compilation behind the opt-in compiler dependency.

import type { TemplateBundle } from "@superimg/types";
import { enqueueTemplateCompile } from "./compile-queue.js";

async function bundleWithBrowserCompiler(code: string): Promise<TemplateBundle> {
  const { initBundler, bundleTemplateBrowser } = await import(
    "../../bundler-browser.js"
  );
  await initBundler();
  return bundleTemplateBrowser(code);
}

/** Queue-backed bundle using the app-provided @rolldown/browser peer. */
export function bundleTemplateQueued(code: string, queueKey: object): Promise<TemplateBundle> {
  return enqueueTemplateCompile(queueKey, () => bundleWithBrowserCompiler(code));
}
