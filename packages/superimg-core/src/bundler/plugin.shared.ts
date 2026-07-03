//! Shared superimg bundler plugin factory (browser + server).

import { DEFINE_CODE } from "../generated/define-code.js";
import { RUNTIME_CODE } from "../generated/runtime-code.js";

/** Subpaths of @superimg/stdlib that must be bundled (not stripped). */
export const BUNDLED_STDLIB_SUBPATHS = ["code", "cue", "text"] as const;

export type BundledStdlibSubpath = (typeof BUNDLED_STDLIB_SUBPATHS)[number];

export interface SuperimgBundlerPlugin {
  name: string;
  resolveId(source: string): string | null;
  load(id: string): string | null;
}

function parseStdlibSubpath(source: string): string | null {
  const prefix = source.startsWith("superimg/stdlib/")
    ? "superimg/stdlib/"
    : source.startsWith("@superimg/stdlib/")
      ? "@superimg/stdlib/"
      : null;
  if (!prefix) return null;
  return source.slice(prefix.length);
}

export interface SuperimgPluginHandlers {
  resolveStdlibSubpath(sub: string): string | null;
  loadStdlib?(id: string): string | null;
}

/**
 * Creates the plugin that provides the `superimg` virtual module
 * and handles private stdlib imports used by templates.
 */
export function buildSuperimgPlugin(
  handlers: SuperimgPluginHandlers,
): SuperimgBundlerPlugin {
  return {
    name: "superimg-resolve",

    resolveId(source: string) {
      if (source === "superimg") {
        return "\0superimg-virtual";
      }
      if (source === "superimg/define" || source === "gumbo/media/define") {
        return "\0superimg-define";
      }

      const sub = parseStdlibSubpath(source);
      if (sub) {
        return handlers.resolveStdlibSubpath(sub);
      }

      return null;
    },

    load(id: string) {
      if (id === "\0superimg-virtual") {
        return RUNTIME_CODE;
      }
      if (id === "\0superimg-define") {
        return DEFINE_CODE;
      }
      if (id === "\0stdlib-noop") {
        return "export {}";
      }
      if (handlers.loadStdlib) {
        const content = handlers.loadStdlib(id);
        if (content) return content;
      }
      return null;
    },
  };
}