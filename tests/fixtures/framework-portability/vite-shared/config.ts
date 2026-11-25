//! Shared Vite config used by TanStack Start + React Router fixtures.
//! Prefer the full `superimg()` plugin in real apps.

import {
  superimg,
  superimgViteConfig,
  SUPERIMG_SERVER_ONLY_IMPORTS,
} from "@superimg/adapters/vite";

/** Lightweight merge (tests). Real apps should use `superimg()` plugin. */
export function frameworkViteConfig(base = "/") {
  return {
    ...superimgViteConfig({ base, optimizeDeps: true }),
  };
}

/** Full plugin list fragment for Vite / RR / TanStack. */
export function frameworkVitePlugins(options?: { base?: string }) {
  return [
    superimg({
      base: options?.base ?? "/",
      strictServerImports: true,
    }),
  ];
}

export { SUPERIMG_SERVER_ONLY_IMPORTS, superimg };
