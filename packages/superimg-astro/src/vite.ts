import type { Plugin } from "vite";
import {
  superimg,
  type SuperimgViteOptions,
} from "@superimg/adapters/vite";

export type { SuperimgViteOptions };
export { superimg, superimgViteConfig } from "@superimg/adapters/vite";

/** Merge into `astro.config` → `vite.plugins`. */
export function superimgAstro(options: SuperimgViteOptions = {}): Plugin {
  return superimg({
    strictServerImports: options.strictServerImports ?? true,
    ...options,
  });
}
