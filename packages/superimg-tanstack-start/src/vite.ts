import type { Plugin } from "vite";
import {
  superimg,
  type SuperimgViteOptions,
} from "@superimg/adapters/vite";

export type { SuperimgViteOptions };
export {
  superimg,
  superimgViteConfig,
} from "@superimg/adapters/vite";

/**
 * SuperImg Vite plugin for TanStack Start.
 * Compose with tanstackStart() + react().
 */
export function superimgTanstackStart(
  options: SuperimgViteOptions = {},
): Plugin {
  return superimg({
    strictServerImports: options.strictServerImports ?? true,
    ...options,
  });
}
