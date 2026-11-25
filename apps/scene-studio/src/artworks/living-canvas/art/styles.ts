/**
 * Inline CSS for "The Weight of a Choice".
 *
 * The composition is a "moral geography": the frame splits between the
 * streetlight/doorway warmth (right) and deep shadow (left), with the wallet
 * sitting on the boundary. Every color routes through `--art-*` variables so
 * the surface profiles in `art-renderer.ts` restyle one drawing.
 */

export const livingCanvasCss = String.raw`
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
  body {
    background: var(--art-bg, #09090d);
    color: var(--art-ink, #fff8e8);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  .scene-root {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    background: var(--art-bg, #09090d);
    color: var(--art-ink, #fff8e8);
  }

  /* ---------- environment ---------- */
  .art-environment {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background:
      radial-gradient(circle at 74% 12%, color-mix(in srgb, var(--art-accent) 20%, transparent) 0, transparent 24%),
      radial-gradient(circle at 16% 74%, color-mix(in srgb, var(--art-accent-3) 12%, transparent) 0, transparent 30%),
      linear-gradient(145deg, var(--art-bg-2, #171126), var(--art-bg, #09090d) 62%);
  }
  .art-grain {
    position: absolute;
    inset: -30%;
    opacity: .12;
    mix-blend-mode: soft-light;
    background-image:
      repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,.2) 0 1px, transparent 1px 4px),
      repeating-linear-gradient(91deg, transparent 0 9px, rgba(255,255,255,.04) 10px 11px);
    transform: rotate(4deg);
  }
  .art-shadow-side {
    position: absolute;
    inset: 0;
    background: linear-gradient(94deg, color-mix(in srgb, var(--art-bg) 62%, #000) 0%, transparent 46%);
    mix-blend-mode: multiply;
    opacity: .6;
  }
  .art-vignette {
    position: absolute;
    inset: -2%;
    background: radial-gradient(ellipse at 52% 44%, transparent 58%, color-mix(in srgb, var(--art-bg) 40%, #000) 128%);
    mix-blend-mode: multiply;
    opacity: .72;
    pointer-events: none;
  }
  .art-rain { position: absolute; inset: 0; }
  .art-rain-far,
  .art-rain-near {
    position: absolute;
    inset: -20%;
    mix-blend-mode: screen;
  }
  .art-rain-far {
    opacity: .16;
    background-image: repeating-linear-gradient(
      112deg,
      transparent 0 34px,
      var(--art-line, rgba(255,255,255,.25)) 34px 35px,
      transparent 36px 62px
    );
    background-size: 120px 160px;
  }
  .art-rain-near {
    opacity: .1;
    filter: blur(1px);
    background-image: repeating-linear-gradient(
      108deg,
      transparent 0 74px,
      color-mix(in srgb, var(--art-ink) 60%, transparent) 74px 77px,
      transparent 78px 130px
    );
    background-size: 200px 220px;
  }
  .art-pavement {
    position: absolute;
    inset: 46% -10% -16%;
    background:
      repeating-linear-gradient(0deg, transparent 0 92px, var(--art-grid) 93px 95px),
      linear-gradient(180deg, color-mix(in srgb, var(--art-bg-2) 84%, black), var(--art-bg));
    transform: perspective(560px) rotateX(58deg) scale(1.4);
    transform-origin: center top;
  }
  .art-pavement::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, transparent 42%, var(--art-glow) 62%, transparent 80%);
    filter: blur(26px);
  }
  .art-puddle {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--art-glow) 60%, transparent), transparent 70%);
  }
  .art-puddle-a { left: 40%; top: 34%; width: 90px; height: 90px; }
  .art-puddle-b { right: 16%; top: 50%; width: 140px; height: 140px; }
  .art-ripple {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 100%;
    height: 100%;
    border: 1.5px solid color-mix(in srgb, var(--art-ink) 34%, transparent);
    border-radius: 50%;
  }
  .art-wallet-reflection {
    position: absolute;
    left: 47%;
    top: 60%;
    width: 320px;
    height: 140px;
    translate: -50% 0;
    background: radial-gradient(ellipse, var(--art-glow), transparent 70%);
    filter: blur(18px);
    mix-blend-mode: screen;
  }

  /* ---------- streetlight ---------- */
  .art-streetlight {
    position: absolute;
    right: 9%;
    top: 2%;
    width: 240px;
    height: 700px;
  }
  .lc-lamp-pole { fill: none; stroke: var(--art-ink); stroke-width: 7; stroke-linecap: round; opacity: .5; }
  .lc-lamp-arm { fill: none; stroke: var(--art-ink); stroke-width: 6; stroke-linecap: round; opacity: .62; }
  .lc-lamp-head { fill: var(--art-ink); opacity: .8; }
  .lc-lamp-glass { fill: var(--art-accent); filter: drop-shadow(0 0 16px var(--art-glow)); }
  .art-streetlight-glow {
    position: absolute;
    left: -198px;
    top: 58px;
    width: 660px;
    height: 800px;
    clip-path: polygon(46% 0, 54% 0, 100% 100%, 0 100%);
    background: linear-gradient(180deg, var(--art-glow), transparent 76%);
    filter: blur(22px);
    mix-blend-mode: screen;
  }

  /* ---------- shared line-art ---------- */
  .lc { display: block; width: 100%; height: 100%; overflow: visible; }
  .art-story, .art-wallet-world, .art-decision, .art-owner {
    position: absolute;
    inset: 0;
  }

  /* ---------- wallet ---------- */
  .art-wallet-shell {
    position: absolute;
    left: 47%;
    top: 57%;
    width: min(35vw, 480px);
    aspect-ratio: 1.6;
    translate: -50% -50%;
    filter: drop-shadow(0 36px 44px rgba(0, 0, 0, .42));
  }
  .lc-leather { fill: color-mix(in srgb, var(--art-accent-3) 30%, var(--art-bg-2)); }
  .lc-wallet-body { stroke: color-mix(in srgb, var(--art-ink) 72%, transparent); stroke-width: 3.5; }
  .lc-wallet-fold { fill: none; stroke: color-mix(in srgb, var(--art-ink) 24%, transparent); stroke-width: 2; }
  .lc-stitch {
    fill: none;
    stroke: color-mix(in srgb, var(--art-ink) 34%, transparent);
    stroke-width: 2;
    stroke-dasharray: 2 10;
    stroke-linecap: round;
  }
  .lc-snap { fill: var(--art-accent); filter: drop-shadow(0 0 14px var(--art-glow)); }
  .lc-sheen { fill: none; stroke: color-mix(in srgb, var(--art-ink) 13%, transparent); stroke-width: 10; stroke-linecap: round; }
  .lc-note-peek { fill: color-mix(in srgb, var(--art-accent-2) 20%, var(--art-bg-2)); stroke: color-mix(in srgb, var(--art-accent-2) 70%, var(--art-ink)); stroke-width: 2; }
  .lc-note-peek-frame { fill: none; stroke: var(--art-accent-2); stroke-width: 1.4; opacity: .7; }

  /* ---------- wallet contents ---------- */
  .art-contents { position: absolute; inset: 0; }
  .art-object {
    position: absolute;
    left: 47%;
    top: 56%;
    transform-origin: center center;
  }
  .art-banknote { width: 250px; height: 118px; margin: -59px 0 0 -125px; filter: drop-shadow(0 22px 30px rgba(0,0,0,.3)); }
  .lc-note-bg { fill: color-mix(in srgb, var(--art-accent-2) 14%, var(--art-bg-2)); stroke: color-mix(in srgb, var(--art-accent-2) 70%, var(--art-ink)); stroke-width: 2.5; }
  .lc-note-frame { fill: none; stroke: var(--art-accent-2); stroke-width: 1.4; opacity: .85; }
  .lc-guilloche { fill: none; stroke: var(--art-accent-2); stroke-width: 1; opacity: .35; }
  .lc-rosette circle { fill: none; stroke: var(--art-accent-2); stroke-width: 1.4; opacity: .6; }
  .lc-note-hatch { fill: none; stroke: var(--art-accent-2); stroke-width: 1; opacity: .5; }
  .lc-note-num {
    font: 700 44px ui-monospace, SFMono-Regular, monospace;
    letter-spacing: -.06em;
    fill: var(--art-accent-2);
    text-anchor: middle;
  }
  .art-photo { width: 190px; height: 154px; margin: -77px 0 0 -95px; filter: drop-shadow(0 22px 32px rgba(0,0,0,.34)); }
  .lc-photo-frame { fill: color-mix(in srgb, var(--art-ink) 92%, var(--art-bg)); stroke: color-mix(in srgb, var(--art-ink) 30%, transparent); stroke-width: 1; }
  .lc-photo-sun { fill: color-mix(in srgb, var(--art-ink) 80%, var(--art-accent)); }
  .lc-photo-ground { fill: color-mix(in srgb, var(--art-bg-2) 60%, var(--art-bg)); }
  .lc-photo-figures circle,
  .lc-photo-figures path { fill: color-mix(in srgb, var(--art-bg) 82%, var(--art-accent-3)); }
  .lc-photo-figures .lc-photo-arm { fill: none; stroke: color-mix(in srgb, var(--art-bg) 82%, var(--art-accent-3)); stroke-width: 3; stroke-linecap: round; }
  .lc-photo-birds { fill: none; stroke: color-mix(in srgb, var(--art-bg) 70%, var(--art-accent-3)); stroke-width: 1.6; }
  .lc-photo-scrawl { fill: none; stroke: color-mix(in srgb, var(--art-bg) 55%, var(--art-accent-3)); stroke-width: 1.6; opacity: .6; }
  .art-address-card {
    width: 260px;
    height: 132px;
    margin: -66px 0 0 -130px;
    padding: 25px 28px;
    position: relative;
    border: 2px solid var(--art-line);
    border-radius: 8px;
    color: var(--art-ink);
    background:
      repeating-linear-gradient(0deg, transparent 0 25px, color-mix(in srgb, var(--art-ink) 10%, transparent) 25px 26px),
      color-mix(in srgb, var(--art-bg-2) 84%, var(--art-ink));
    box-shadow: 0 24px 46px rgba(0,0,0,.3);
    font: 500 16px/1.65 ui-monospace, SFMono-Regular, monospace;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .art-address-card strong { color: var(--art-accent); font-weight: 700; }
  .art-address-stamp {
    position: absolute;
    right: 14px;
    top: 12px;
    width: 34px;
    height: 34px;
    border: 1.5px dashed color-mix(in srgb, var(--art-accent) 70%, transparent);
    border-radius: 6px;
    rotate: 8deg;
    opacity: .7;
  }
  .art-address-stamp::after {
    content: "";
    position: absolute;
    inset: 7px;
    border: 1.5px solid color-mix(in srgb, var(--art-accent) 55%, transparent);
    border-radius: 50%;
  }

  /* ---------- owner & doorway ---------- */
  .art-owner-silhouette {
    position: absolute;
    right: 8.5%;
    bottom: 6%;
    width: 150px;
    height: 320px;
  }
  .lc-owner-fill { fill: var(--art-ink); stroke: var(--art-ink); stroke-width: 3; stroke-linecap: round; opacity: .78; }
  .lc-owner-fill path:first-child { fill: none; }
  .lc-owner-canopy { stroke-linejoin: round; }
  .lc-owner-pole { fill: none; stroke-width: 3.5; }
  .lc-owner-arm { fill: none; stroke-width: 8; }
  .lc-owner-shadow { fill: var(--art-ink); opacity: .14; }
  .art-doorway-wrap {
    position: absolute;
    right: 4%;
    bottom: 0;
    width: 280px;
    height: 570px;
  }
  .lc-door-frame { fill: none; stroke: var(--art-line); stroke-width: 4; }
  .lc-door-molding { fill: none; stroke: var(--art-line); stroke-width: 1.5; opacity: .55; }
  .lc-door-mullions { fill: none; stroke: var(--art-line); stroke-width: 2; opacity: .8; }
  .lc-door-light { fill: var(--art-accent); opacity: .34; }
  .lc-door-panel { fill: color-mix(in srgb, var(--art-bg-2) 70%, var(--art-bg)); stroke: var(--art-line); stroke-width: 1.5; }
  .lc-door-gap { fill: var(--art-accent); opacity: .55; }
  .lc-door-handle { fill: none; stroke: var(--art-ink); stroke-width: 2; opacity: .7; }
  .lc-door-step { fill: none; stroke: var(--art-line); stroke-width: 3; }
  .art-door-spill {
    position: absolute;
    right: 40px;
    bottom: -30px;
    width: 640px;
    height: 190px;
    transform: skewX(-52deg);
    transform-origin: bottom right;
    background: linear-gradient(268deg, var(--art-glow) 6%, transparent 72%);
    filter: blur(16px);
    mix-blend-mode: screen;
    opacity: .95;
  }

  /* ---------- decision trails ---------- */
  .art-trail-node { position: absolute; top: 58%; height: 28%; }
  .art-trail-keep { left: 7%; width: 40%; }
  .art-trail-return { left: 47.5%; width: 40%; }
  .art-trail-plane {
    position: absolute;
    inset: 0;
    transform: perspective(640px) rotateX(48deg);
    transform-origin: 50% 0;
  }
  .lc-trail-line {
    fill: none;
    stroke: var(--art-accent);
    stroke-width: 5;
    stroke-linecap: round;
    stroke-dasharray: 26 22;
  }
  .lc-trail-chevron { fill: none; stroke: var(--art-accent); stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
  .art-trail-keep .lc-trail-line,
  .art-trail-keep .lc-trail-chevron { stroke: color-mix(in srgb, var(--art-ink) 66%, var(--art-accent)); }
  .art-trail-label {
    position: absolute;
    color: var(--art-accent);
    font: 700 15px/1 ui-monospace, monospace;
    letter-spacing: .18em;
    text-transform: uppercase;
  }
  .art-trail-label-keep { left: 2%; bottom: 2%; color: var(--art-muted); }
  .art-trail-label-return { right: 1%; bottom: 0; }

  /* ---------- narration & marginalia ---------- */
  .art-caption-stack {
    position: absolute;
    left: 6.5%;
    right: 6.5%;
    bottom: 7%;
    min-height: 168px;
    pointer-events: none;
  }
  .art-caption {
    position: absolute;
    left: 0;
    bottom: 0;
    max-width: 720px;
    font-family: Iowan Old Style, Baskerville, Georgia, serif;
    font-size: clamp(58px, 6.3vw, 96px);
    font-weight: 500;
    line-height: .92;
    letter-spacing: -.055em;
    text-wrap: balance;
    text-shadow: 0 6px 30px rgba(0,0,0,.28);
  }
  .art-caption em {
    color: var(--art-accent);
    font-style: italic;
    font-weight: 400;
  }
  .art-coordinate {
    position: absolute;
    right: 5.5%;
    top: 6%;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--art-muted);
    font: 600 13px/1 ui-monospace, SFMono-Regular, monospace;
    letter-spacing: .14em;
    text-transform: uppercase;
  }
  .art-coordinate-mark {
    width: 12px;
    height: 12px;
    border: 1px solid var(--art-accent);
    border-radius: 50%;
    box-shadow: 0 0 18px var(--art-glow);
  }
  .art-edition {
    position: absolute;
    left: 6.5%;
    top: 6%;
    color: var(--art-muted);
    font: 600 13px/1 ui-monospace, SFMono-Regular, monospace;
    letter-spacing: .16em;
    text-transform: uppercase;
  }

  /* ---------- portrait restaging ---------- */
  .scene-root.is-portrait .art-streetlight { right: -30px; top: 1%; }
  .scene-root.is-portrait .art-wallet-shell {
    width: min(72vw, 520px);
    left: 50%;
    top: 52%;
  }
  .scene-root.is-portrait .art-object { left: 50%; top: 51%; }
  .scene-root.is-portrait .art-wallet-reflection { left: 50%; top: 56%; }
  .scene-root.is-portrait .art-caption-stack { bottom: 11%; min-height: 250px; }
  .scene-root.is-portrait .art-caption { font-size: clamp(70px, 11vw, 118px); max-width: 88%; }
  .scene-root.is-portrait .art-owner-silhouette { right: 7%; bottom: 15%; scale: .82; }
  .scene-root.is-portrait .art-doorway-wrap { right: -40px; bottom: 10%; scale: .82; }
  .scene-root.is-portrait .art-trail-node { top: 58%; height: 26%; }
  .scene-root.is-portrait .art-trail-keep { left: 0; width: 52%; }
  .scene-root.is-portrait .art-trail-return { left: 46%; width: 54%; }
  .scene-root.is-portrait .art-shadow-side { opacity: .4; }

  @media (prefers-reduced-motion: reduce) {
    .art-rain, .art-streetlight-glow { transition: none !important; }
  }
`;
