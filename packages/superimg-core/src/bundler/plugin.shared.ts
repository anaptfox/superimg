//! Shared superimg bundler plugin factory (browser + server).
//!
//! Handlers supply resolve targets; only synthetic ids (e.g. stdlib no-op)
//! need a `load` body. Real modules are read from disk by rolldown.

/** Subpaths of @superimg/stdlib that must be bundled (not stripped). */
export const BUNDLED_STDLIB_SUBPATHS = ["code", "cue", "text"] as const;

export type BundledStdlibSubpath = (typeof BUNDLED_STDLIB_SUBPATHS)[number];

export const STDLIB_NOOP_ID = "\0stdlib-noop";

export interface SuperimgBundlerPlugin {
  name: string;
  resolveId(source: string): string | null;
  load(id: string): string | null;
}

export function parseStdlibSubpath(source: string): string | null {
  const prefix = source.startsWith("superimg/stdlib/")
    ? "superimg/stdlib/"
    : source.startsWith("@superimg/stdlib/")
      ? "@superimg/stdlib/"
      : null;
  if (!prefix) return null;
  return source.slice(prefix.length);
}

export interface SuperimgPluginHandlers {
  /** Absolute path or virtual id for bare `superimg`. */
  resolveSuperimg(): string;
  /** Absolute path or virtual id for `superimg/define` / `gumbo/media/define`. */
  resolveDefine(): string;
  /** Absolute path or virtual id for a stdlib subpath, or null to strip. */
  resolveStdlibSubpath(sub: string): string | null;
  /** Optional load for virtual ids (browser embeds, stdlib no-op). */
  load?(id: string): string | null;
}

/**
 * Plugin that maps template imports (`superimg`, define, stdlib subpaths)
 * to real modules or environment-specific virtual ids.
 */
export function buildSuperimgPlugin(
  handlers: SuperimgPluginHandlers,
): SuperimgBundlerPlugin {
  return {
    name: "superimg-resolve",

    resolveId(source: string) {
      if (source === "superimg") {
        return handlers.resolveSuperimg();
      }
      if (source === "superimg/define" || source === "gumbo/media/define") {
        return handlers.resolveDefine();
      }

      const sub = parseStdlibSubpath(source);
      if (sub) {
        return handlers.resolveStdlibSubpath(sub) ?? STDLIB_NOOP_ID;
      }

      return null;
    },

    load(id: string) {
      if (id === STDLIB_NOOP_ID) {
        return "export {}";
      }
      if (handlers.load) {
        return handlers.load(id);
      }
      return null;
    },
  };
}
