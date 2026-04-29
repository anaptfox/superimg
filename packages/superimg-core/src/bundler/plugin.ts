//! Shared esbuild plugin for superimg template bundling
//! Used by both server (esbuild) and browser (esbuild-wasm) bundlers
//!
//! This plugin handles:
//! 1. "superimg" - provides defineScene, defineConfig, compose, scene
//! 2. "@superimg/stdlib/*" - stripped unless direct imports must be bundled

import { RUNTIME_CODE } from "../generated/runtime-code.js";

interface EsbuildPlugin {
  name: string;
  setup(build: { onResolve: Function; onLoad: Function }): void;
}

/**
 * Creates the esbuild plugin that provides the `superimg` virtual module
 * and handles private stdlib imports used by templates. Public
 * `superimg/stdlib/*` imports are aliased to these private paths by the
 * bundler options before this plugin runs.
 */
export function createSuperimgPlugin(namespace = "superimg-virtual"): EsbuildPlugin {
  return {
    name: "superimg-resolve",
    setup(build) {
      // Resolve "superimg" to virtual module
      build.onResolve({ filter: /^superimg$/ }, () => ({
        path: "superimg",
        namespace,
      }));

      // Load the virtual "superimg" module (generated from compose, scene, etc.)
      build.onLoad({ filter: /^superimg$/, namespace }, () => ({
        contents: RUNTIME_CODE,
        loader: "js",
      }));

      // Strip most stdlib imports (accessed via ctx.std at runtime)
      // EXCEPT certain modules that need to be bundled:
      // - @superimg/stdlib/code: for static syntax highlighting
      // - @superimg/stdlib/cue: for direct cue helpers imports
      // - @superimg/stdlib/text: for module-level formatting helpers
      build.onResolve({ filter: /^@superimg\/stdlib/ }, (args: { path: string }) => {
        const bundledModules = [
          "@superimg/stdlib/code",
          "@superimg/stdlib/cue",
          "@superimg/stdlib/text",
        ];
        if (bundledModules.includes(args.path)) {
          return null; // Let esbuild handle it normally
        }
        return {
          path: "stdlib-noop",
          namespace,
        };
      });

      build.onLoad({ filter: /^stdlib-noop$/, namespace }, () => ({
        contents: "export {}",
        loader: "js",
      }));
    },
  };
}
