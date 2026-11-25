//! Media stage + skeleton — SSR-safe layout primitives for framework shells.
//! Reserves the correct aspect ratio before Player hydrates / first frame paints.
//! No React, Player, Playwright, or Node renderers.

export type MediaSize = {
  width: number;
  height: number;
};

export type MediaSkeletonVariant = "shimmer" | "solid";

export type MediaSkeletonOptions = MediaSize & {
  /** Accessible name only (never painted as text). */
  alt?: string;
  /** Visual style while waiting for first frame. @default "shimmer" */
  variant?: MediaSkeletonVariant;
};

export type MediaStageOptions = MediaSize & {
  /** Inner HTML (poster markup, skeleton, or empty). */
  content: string;
  sourceId?: string;
  /** Extra class names on the stage root. */
  className?: string;
  /**
   * Accessible name for the stage region.
   * Prefer poster alt when content is a real still.
   */
  label?: string;
};

/** CSS `aspect-ratio` value from canvas size, e.g. `"1920 / 1080"`. */
export function mediaAspectRatio(width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) {
    throw new Error(`mediaAspectRatio: invalid size ${width}×${height}`);
  }
  return `${width} / ${height}`;
}

/**
 * Fluid stage box styles: full width, height from aspect-ratio.
 * Use on SSR shells and client islands so the slot never collapses.
 *
 * Do **not** put a CSS border or light box-shadow frame on this box
 * (border breaks contain scale; light rings read as a white border on dark UI).
 */
export function mediaStageStyle(
  width: number,
  height: number,
): Record<string, string> {
  return {
    position: "relative",
    width: "100%",
    maxWidth: "100%",
    aspectRatio: mediaAspectRatio(width, height),
    overflow: "hidden",
    background: "#07070c",
    isolation: "isolate",
  };
}

/** Inline `style="…"` for SSR HTML. */
export function mediaStageStyleAttr(width: number, height: number): string {
  return styleObjectToAttr(mediaStageStyle(width, height));
}

/**
 * Skeleton + stage motion CSS (inject once; safe to duplicate).
 * Generic full-bleed shimmer only — no layout bones (they never match the video).
 */
export const SUPERIMG_SKELETON_CSS = `
@keyframes superimg-shimmer{
  0%{background-position:200% 0}
  100%{background-position:-200% 0}
}
@keyframes superimg-skeleton-in{
  from{opacity:0}
  to{opacity:1}
}
[data-superimg-skeleton]{
  background-size:200% 100%;
  animation:
    superimg-skeleton-in .38s cubic-bezier(.22,1,.36,1) both,
    superimg-shimmer 1.65s ease-in-out infinite;
}
[data-superimg-stage-player],
[data-superimg-stage] .stage-player{
  transition:opacity .34s cubic-bezier(.22,1,.36,1);
}
[data-superimg-stage-fill],
[data-superimg-stage] .stage-poster{
  transition:opacity .28s cubic-bezier(.22,1,.36,1);
}
@media (prefers-reduced-motion:reduce){
  [data-superimg-skeleton]{animation:none!important}
  [data-superimg-stage-player],
  [data-superimg-stage] .stage-player,
  [data-superimg-stage-fill],
  [data-superimg-stage] .stage-poster{transition:none!important}
}
`.replace(/\n/g, "");

/**
 * Generic media-slot fill: correct aspect via parent stage, soft shimmer, no
 * words and no fake UI shapes (those can't match the real first frame).
 */
export function createSkeletonMarkup(options: MediaSkeletonOptions): string {
  const { width, height, alt, variant = "shimmer" } = options;
  if (!(width > 0) || !(height > 0)) {
    throw new Error(`createSkeletonMarkup: invalid size ${width}×${height}`);
  }
  // Accessible only — never paint label/alt as text.
  const aria = escapeAttr(alt ?? "Loading media");
  const isShimmer = variant === "shimmer";
  const bg = isShimmer
    ? "linear-gradient(105deg,#0a0a10 0%,#14141c 42%,#0c0c14 58%,#0a0a10 100%)"
    : "#0c0c14";

  const styleBlock = `<style data-superimg-skeleton-css="">${SUPERIMG_SKELETON_CSS}</style>`;

  return (
    `${styleBlock}` +
    `<div data-superimg-skeleton="1" data-superimg-poster="1" role="img" ` +
    `aria-label="${aria}" aria-busy="true" ` +
    `style="position:absolute;inset:0;width:100%;height:100%;box-sizing:border-box;` +
    `background:${bg};background-size:200% 100%;pointer-events:none;` +
    (isShimmer ? "" : "animation:superimg-skeleton-in .38s cubic-bezier(.22,1,.36,1) both;") +
    `"></div>`
  );
}

/**
 * Build a {@link MediaPoster}-shaped object whose `html` is a ratio-correct skeleton.
 * Drop-in for `payload.poster` when you only need a loading shell.
 */
export function createSkeletonPoster(
  size: MediaSize,
  options?: Omit<MediaSkeletonOptions, "width" | "height">,
): {
  width: number;
  height: number;
  html: string;
  alt?: string;
} {
  const alt = options?.alt ?? "Loading media";
  return {
    width: size.width,
    height: size.height,
    html: createSkeletonMarkup({
      width: size.width,
      height: size.height,
      ...options,
      alt,
    }),
    alt,
  };
}

/**
 * SSR stage shell: reserves canvas aspect ratio and hosts poster/skeleton HTML.
 *
 * ```html
 * <section data-superimg-stage aspect-ratio…>
 *   <div data-superimg-stage-fill>…poster or skeleton…</div>
 * </section>
 * ```
 */
export function renderMediaStage(options: MediaStageOptions): string {
  const { width, height, content, sourceId, className, label } = options;
  const style = mediaStageStyleAttr(width, height);
  const cls = ["superimg-shell", className].filter(Boolean).join(" ");
  const sid = sourceId ? ` data-source-id="${escapeAttr(sourceId)}"` : "";
  const lab = label ? ` aria-label="${escapeAttr(label)}"` : "";

  return (
    `<section class="${escapeAttr(cls)}" data-superimg-stage="1"` +
    ` data-superimg-width="${width}" data-superimg-height="${height}"` +
    `${sid}${lab} style="${style}">` +
    `<div data-superimg-stage-fill="1" style="position:absolute;inset:0;width:100%;height:100%;overflow:hidden">` +
    `${content}` +
    `</div></section>`
  );
}

/**
 * Stage whose content is a skeleton (convenience for docs/embeds before hydrate).
 */
export function renderSkeletonStage(
  size: MediaSize & {
    sourceId?: string;
    className?: string;
    alt?: string;
    variant?: MediaSkeletonVariant;
  },
): string {
  const { width, height, sourceId, className, alt, variant } = size;
  return renderMediaStage({
    width,
    height,
    label: alt ?? "Loading media",
    ...(sourceId !== undefined ? { sourceId } : {}),
    ...(className !== undefined ? { className } : {}),
    content: createSkeletonMarkup({
      width,
      height,
      alt: alt ?? "Loading media",
      ...(variant !== undefined ? { variant } : {}),
    }),
  });
}

function styleObjectToAttr(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([k, v]) => `${camelToKebab(k)}:${v}`)
    .join(";");
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
