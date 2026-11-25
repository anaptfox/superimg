//! Vite plugin merge for React Router framework mode.

import type { Plugin } from "vite";
import {
  superimg,
  type SuperimgViteOptions,
} from "@superimg/adapters/vite";

export type { SuperimgViteOptions };
export { superimg, superimgViteConfig } from "@superimg/adapters/vite";

/**
 * SuperImg Vite plugin for React Router apps.
 * Place after `reactRouter()` (or before — both work; RR owns SSR).
 */
export function superimgReactRouter(
  options: SuperimgViteOptions = {},
): Plugin {
  return superimg({
    strictServerImports: options.strictServerImports ?? true,
    ...options,
  });
}
