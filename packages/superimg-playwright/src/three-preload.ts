import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Page } from "playwright";

/** Compatibility identity retained by schema-0 Three artifacts. */
export const THREE_VERSION = "0.184.0";
export const THREE_MODULE = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.min.js`;
const THREE_CORE_MODULE = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.core.min.js`;
const routes = new WeakMap<Page, Promise<void>>();
let packageBytes: Promise<{ module: Buffer; core: Buffer }> | undefined;

function loadPackage(): Promise<{ module: Buffer; core: Buffer }> {
  return packageBytes ??= (async () => {
    const require = createRequire(import.meta.url);
    const build = dirname(require.resolve("three"));
    const manifest = JSON.parse(await readFile(join(build, "..", "package.json"), "utf8")) as { version?: string };
    if (manifest.version !== THREE_VERSION) throw new Error(`Legacy Three needs ${THREE_VERSION}; installed package is ${String(manifest.version)}`);
    const [module, core] = await Promise.all([readFile(join(build, "three.module.min.js")), readFile(join(build, "three.core.min.js"))]);
    return { module, core };
  })().catch(error => { packageBytes = undefined; throw error; });
}

/** Serve the original module URLs from owned package bytes, without a CDN request. */
export async function preloadThreeModule(page: Page): Promise<void> {
  let registered = routes.get(page);
  if (!registered) {
    registered = (async () => {
      const bytes = await loadPackage();
      const main = (route: import("playwright").Route) => route.fulfill({ status: 200, contentType: "text/javascript", body: bytes.module });
      const core = (route: import("playwright").Route) => route.fulfill({ status: 200, contentType: "text/javascript", body: bytes.core });
      await page.route(THREE_MODULE, main);
      try { await page.route(THREE_CORE_MODULE, core); }
      catch (error) { await page.unroute(THREE_MODULE, main); throw error; }
    })();
    routes.set(page, registered);
    registered.catch(() => routes.delete(page));
  }
  await registered;
  // Keep the browser import outside the host bundler's dynamic-import transform.
  await page.evaluate(`(async () => { if (!window.__SUPERIMG_THREE__) window.__SUPERIMG_THREE__ = await import(${JSON.stringify(THREE_MODULE)}); })()`);
}
