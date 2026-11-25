//! Shared superimg bundler plugin factory (browser + server).
//!
//! Handlers supply resolve targets; only synthetic ids (e.g. stdlib no-op)
//! need a `load` body. Real modules are read from disk by rolldown.

/** Subpaths of @superimg/stdlib that must be bundled (not stripped). */
export const BUNDLED_STDLIB_SUBPATHS = ["code", "cue", "text", "charts"] as const;

export type BundledStdlibSubpath = (typeof BUNDLED_STDLIB_SUBPATHS)[number];

export const STDLIB_NOOP_ID = "\0stdlib-noop";

export interface SuperimgBundlerPlugin {
  name: string;
  resolveId(source: string): string | null;
  load(id: string): string | null;
}

/** Host-owned bare authoring specifiers mapped to browser-safe module files. */
export type MediaAuthoringFacadeModules = Readonly<Record<string, string>>;

export function parseStdlibSubpath(source: string): string | null {
  const prefix = source.startsWith("@foxworth/superimg/stdlib/")
    ? "@foxworth/superimg/stdlib/"
    : source.startsWith("@superimg/stdlib/")
      ? "@superimg/stdlib/"
      : null;
  if (!prefix) return null;
  return source.slice(prefix.length);
}

export interface SuperimgPluginHandlers {
  /** Absolute path or virtual id for bare `@foxworth/superimg`. */
  resolveSuperimg(): string;
  /** Absolute path or virtual id for interactive authoring. */
  resolveInteractive(): string;
  /** Absolute path or virtual id for `@foxworth/superimg/film`. */
  resolveFilm?(): string | null;
  /** Absolute path or virtual id for a host-defined authoring facade. */
  resolveAuthoringFacade?(source: string): string | null;
  /** Absolute path or virtual id for a stdlib subpath, or null to strip. */
  resolveStdlibSubpath(sub: string): string | null;
  /** Optional load for virtual ids (browser embeds, stdlib no-op). */
  load?(id: string): string | null;
}

/**
 * Plugin that maps template imports (`@foxworth/superimg`, interactive, stdlib subpaths)
 * to real modules or environment-specific virtual ids.
 */
export function buildSuperimgPlugin(
  handlers: SuperimgPluginHandlers,
): SuperimgBundlerPlugin {
  return {
    name: "superimg-resolve",

    resolveId(source: string) {
      if (source === "@foxworth/superimg") {
        return handlers.resolveSuperimg();
      }
      if (source === "@foxworth/superimg/interactive/define") {
        return handlers.resolveInteractive();
      }
      if (source === "@foxworth/superimg/film") {
        return handlers.resolveFilm?.() ?? null;
      }
      const facade = handlers.resolveAuthoringFacade?.(source);
      if (facade) return facade;

      if (source === "@foxworth/superimg/charts") {
        const target = handlers.resolveStdlibSubpath("charts");
        if (!target || target === STDLIB_NOOP_ID) {
          throw new Error("@foxworth/superimg/charts is unavailable. Rebuild the chart authoring modules.");
        }
        return target;
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
