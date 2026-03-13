//! Shared esbuild plugin for superimg template bundling
//! Used by both server (esbuild) and browser (esbuild-wasm) bundlers
//!
//! This plugin handles:
//! 1. "superimg" - provides defineScene, defineConfig, compose, scene
//! 2. "@superimg/stdlib/*" - stripped (accessed via ctx.std at runtime)

import { RUNTIME_CODE } from "./generated/runtime-code.js";

interface EsbuildPlugin {
  name: string;
  setup(build: { onResolve: Function; onLoad: Function }): void;
}

/**
 * Creates the esbuild plugin that provides the `superimg` virtual module
 * and strips `@superimg/stdlib` imports (accessed via ctx.std at runtime).
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
      // EXCEPT @superimg/stdlib/code - that one needs to be bundled for static highlighting
      build.onResolve({ filter: /^@superimg\/stdlib/ }, (args: { path: string }) => {
        // Don't strip the code module - it needs to be bundled for static highlighting
        if (args.path === "@superimg/stdlib/code") {
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
