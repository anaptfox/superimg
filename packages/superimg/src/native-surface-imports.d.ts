/** A native surface import is prepared by the SuperImg source compiler. */
declare module "*?superimg-surface" {
  const surface: import("@foxworth/superimg").PreparedNativeSurface & import("@foxworth/superimg").PreparedNativeModuleSet;
  export default surface;
}

/** Exact UTF-8 SVG source bytes, prepared by the SuperImg source compiler. */
declare module "*?superimg-svg" {
  const source: Uint8Array;
  export default source;
}

/**
 * A compiled Familiar rig, as `*.rig.toml`, `*.toml?rig` and `rigs/` / `cast/` `*.toml` imports provide it.
 * Spelled out here (same shape as `Rig` from `@foxworth/superimg/film`) so these declarations
 * do not import the package by its own name.
 */
declare module "*.rig.toml" {
  const rig: {
    w: number;
    h: number;
    poses: Record<string, readonly { fill: string; d: string }[]> & { rest: readonly { fill: string; d: string }[] };
    moves?: Record<string, readonly { pose: string; ms: number; alt?: number }[]>;
  };
  export default rig;
}

declare module "*.toml?rig" {
  const rig: {
    w: number;
    h: number;
    poses: Record<string, readonly { fill: string; d: string }[]> & { rest: readonly { fill: string; d: string }[] };
    moves?: Record<string, readonly { pose: string; ms: number; alt?: number }[]>;
  };
  export default rig;
}

declare module "*.toml" {
  const rig: {
    w: number;
    h: number;
    poses: Record<string, readonly { fill: string; d: string }[]> & { rest: readonly { fill: string; d: string }[] };
    moves?: Record<string, readonly { pose: string; ms: number; alt?: number }[]>;
  };
  export default rig;
}

/** Film-facing projection of a SuperImg script. */
declare module "*.script.md" {
  type Base = { id: string | null; section: string | null; fields: Record<string, string> };
  type At = { start: number; end?: number };
  type Block =
    | (Base & { kind: "shot"; text: string; hold?: number; still?: number })
    | (Base & { kind: "speech"; who: string; pace: string; lines: string[]; at?: At })
    | (Base & { kind: "card"; attribution: string | null; sign: string | null; source: string | null; lines: string[]; at?: At });
  const script: { version: 2; title: string | null; hash: string; editHash: string; blocks: Block[] };
  export default script;
}
