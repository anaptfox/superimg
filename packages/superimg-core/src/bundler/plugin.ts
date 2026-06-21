//! Shared plugin for superimg template bundling
//! Used by both server (rolldown) and browser (@rolldown/browser) bundlers
//!
//! This plugin handles:
//! 1. "superimg" - provides defineScene, defineConfig, compose, scene
//! 2. "@superimg/stdlib/*" - stripped unless direct imports must be bundled

import { RUNTIME_CODE } from "../generated/runtime-code.js";

/**
 * Creates the plugin that provides the `superimg` virtual module
 * and handles private stdlib imports used by templates. Public
 * `superimg/stdlib/*` imports are aliased to these private paths by the
 * bundler options before this plugin runs.
 */
export function createSuperimgPlugin(): any {
  return {
    name: "superimg-resolve",
    
    resolveId(source: string) {
      if (source === "superimg") {
        return "\0superimg-virtual";
      }
      
      if (source.startsWith("@superimg/stdlib")) {
        const bundledModules = [
          "@superimg/stdlib/code",
          "@superimg/stdlib/cue",
          "@superimg/stdlib/text",
        ];
        if (bundledModules.includes(source)) {
          return null; // Let the normal resolver handle it
        }
        return "\0stdlib-noop";
      }
      return null;
    },

    load(id: string) {
      if (id === "\0superimg-virtual") {
        return RUNTIME_CODE;
      }
      if (id === "\0stdlib-noop") {
        return "export {}";
      }
      return null;
    }
  };
}
