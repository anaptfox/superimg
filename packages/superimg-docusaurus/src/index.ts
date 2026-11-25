//! @superimg/docusaurus — Docusaurus plugin (WASM) + theme Player embeds.
//!
//! Register under `plugins` (not themes) so configureWebpack runs:
//!   plugins: [["@superimg/docusaurus", { /* options */ }]]
//!
//! Theme components (use @theme/* aliases after the plugin is registered):
//!   import SuperImgPlayer from "@theme/SuperImgPlayer";
//!   import AnimatedFigure from "@theme/AnimatedFigure";

/// <reference path="./theme-types.d.ts" />

import {
  normalizeOptions,
  type NormalizedSuperimgDocusaurusOptions,
  type SuperimgDocusaurusOptions,
} from "./options.js";

export type { SuperimgDocusaurusOptions, NormalizedSuperimgDocusaurusOptions };
export { normalizeOptions } from "./options.js";

/**
 * Minimal Docusaurus plugin shape we implement.
 * Avoid importing `@docusaurus/types` at build time (pulls webpack/joi CJS .d.ts).
 */
export type SuperimgDocusaurusPlugin = {
  name: string;
  getThemePath: () => string;
  getTypeScriptThemePath: () => string;
  configureWebpack: (
    config: unknown,
    isServer: boolean,
    utils?: unknown,
    content?: unknown,
  ) => { experiments?: { asyncWebAssembly?: boolean } } | Record<string, never>;
};

/**
 * Docusaurus plugin: client asyncWebAssembly + @theme SuperImg components.
 */
export default function superimgDocusaurus(
  _context: unknown,
  opts: SuperimgDocusaurusOptions = {},
): SuperimgDocusaurusPlugin {
  const options = normalizeOptions(opts);

  return {
    name: "docusaurus-plugin-superimg",

    getThemePath() {
      // Relative to this package entry (dist/) — theme emits next to index.js.
      return "./theme";
    },

    getTypeScriptThemePath() {
      // Swizzle / monorepo source map when src is present.
      return "../src/theme";
    },

    configureWebpack(_config, isServer) {
      if (!options.asyncWebAssembly) return {};
      if (isServer && !options.asyncWebAssemblyOnServer) return {};
      return {
        experiments: {
          asyncWebAssembly: true,
        },
      };
    },
  };
}
