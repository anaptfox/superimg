//! Lazy-load the browser bundler so client bundles (e.g. Next.js) do not
//! statically pull rolldown / node:module at import time.

type BundlerModule = typeof import("../../index.bundler.js");

let bundlerModule: BundlerModule | null = null;

export async function loadBundler(): Promise<BundlerModule> {
  if (!bundlerModule) {
    bundlerModule = await import("../../index.bundler.js");
  }
  return bundlerModule;
}