//! Player policy bundles over the media core.
//!
//! **Default product boundary is `render-only`** (production embeds): strip scripts,
//! no `allow-scripts`, silent strip log unless the host opts into warnings.
//!
//! - **render-only** — shipped Player / Media embeds
//! - **dev** — playground / first-party islands: allow-scripts + re-exec after morphdom
//!
//! Call sites should pass `playerMode` explicitly when they need `dev`; omitting it
//! (or any unknown value) resolves as render-only.

export type PlayerMode = "render-only" | "dev";

export interface PlayerPolicy {
  mode: PlayerMode;
  /** Sandbox allow-scripts + Tailwind CDN createElement path */
  allowScripts: boolean;
  /** DOM-sanitize template HTML before morphdom */
  stripHtml: boolean;
  /** After morphdom, clone/re-append <script> so islands run (dev only) */
  reexecuteScripts: boolean;
  /** Inject Tailwind browser CDN when template has config.tailwind */
  injectTailwindCdn: boolean;
  /**
   * Whether the presenter should console.warn on strips / wall-clock CSS.
   * Default: on for `dev`, off for `render-only` (hosts may override via
   * `IframePresenterOptions.warn`).
   */
  warnDefault: boolean;
}

export interface ResolvePlayerPolicyInput {
  /** Product boundary; omit → render-only. */
  playerMode?: PlayerMode;
  /** Template resolved tailwind config present */
  hasTailwind?: boolean;
}

/**
 * Resolve policy for the composite presenter.
 * **Defaults to render-only** — that is the production design, not a fallback accident.
 */
export function resolvePlayerPolicy(input: ResolvePlayerPolicyInput = {}): PlayerPolicy {
  const mode = input.playerMode === "dev" ? "dev" : "render-only";
  const hasTailwind = !!input.hasTailwind;

  if (mode === "dev") {
    return {
      mode: "dev",
      allowScripts: true,
      stripHtml: false,
      reexecuteScripts: true,
      injectTailwindCdn: hasTailwind,
      warnDefault: true,
    };
  }

  return {
    mode: "render-only",
    allowScripts: false,
    stripHtml: true,
    reexecuteScripts: false,
    injectTailwindCdn: false,
    warnDefault: false,
  };
}
