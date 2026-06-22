/**
 * Reusable layer "shots" — designer-authored building blocks.
 */

/** Lower-third overlay anchored bottom-left with broadcast safe area. */
export function lowerThirdOverlay(L, html, opts = {}) {
  return L.overlay(html, {
    anchor: "bottom-left",
    offset: opts.offset ?? { x: 0, y: 80 },
    motion: opts.motion,
    safe: true,
  });
}

/** Full-bleed hero: Ken Burns background + tinted headline. */
export function heroShot(L, std, data) {
  const t = std.score();
  const bg = std.backgrounds.kenBurns({
    src: data.backgroundImage,
    progress: t.progress,
    overlay: data.overlay ?? "rgba(0,0,0,0.55)",
  });
  const headline = t.motion({ y: 24 });

  return L.render(
    L.bg(bg.html),
    L.content(`<h1 style="${headline.style}">${data.headline}</h1>`, { safe: "broadcast" }),
  );
}