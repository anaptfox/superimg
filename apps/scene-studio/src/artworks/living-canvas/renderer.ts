import { createSurfaceRenderer } from "../../kit/surface-renderer";

export const livingCanvasProfiles = {
  nocturne: `
    :root {
      --art-bg: #09090d;
      --art-bg-2: #171126;
      --art-ink: #fff8e8;
      --art-muted: rgba(255, 248, 232, .56);
      --art-accent: #ff7759;
      --art-accent-2: #65ead1;
      --art-accent-3: #8f7cff;
      --art-line: rgba(255, 248, 232, .28);
      --art-grid: rgba(255, 255, 255, .045);
      --art-glow: rgba(255, 119, 89, .34);
      --art-blend: screen;
    }
    .art-environment { filter: saturate(1.04) contrast(1.02); }
    .art-wallet-shell {
      filter: drop-shadow(0 36px 44px rgba(0, 0, 0, .5)) drop-shadow(0 0 56px var(--art-glow));
    }
    .art-streetlight-glow { filter: blur(24px) saturate(1.08); }
  `,
  letterpress: `
    :root {
      --art-bg: #e9e0ce;
      --art-bg-2: #f8f1e5;
      --art-ink: #1b1a18;
      --art-muted: rgba(27, 26, 24, .58);
      --art-accent: #e95432;
      --art-accent-2: #277b73;
      --art-accent-3: #7c5b94;
      --art-line: rgba(27, 26, 24, .3);
      --art-grid: rgba(27, 26, 24, .065);
      --art-glow: rgba(233, 84, 50, .13);
      --art-blend: multiply;
    }
    .art-environment { filter: saturate(.86) contrast(.98); }
    .art-grain { opacity: .22 !important; mix-blend-mode: multiply !important; }
    .art-rain-far { opacity: .07 !important; }
    .art-rain-near { opacity: .04 !important; }
    .art-shadow-side { opacity: .16 !important; }
    .art-vignette { opacity: .3 !important; }
    .art-wallet-shell {
      filter: drop-shadow(10px 14px 0 color-mix(in srgb, var(--art-ink) 12%, transparent));
    }
    .art-door-spill { opacity: .5; mix-blend-mode: multiply; }
    [data-si-role="evidence"] { filter: none !important; }
  `,
  blueprint: `
    :root {
      --art-bg: #061a35;
      --art-bg-2: #0a2c56;
      --art-ink: #e2f9ff;
      --art-muted: rgba(226, 249, 255, .55);
      --art-accent: #49dfff;
      --art-accent-2: #a9f4ff;
      --art-accent-3: #5e94ff;
      --art-line: rgba(168, 238, 255, .48);
      --art-grid: rgba(168, 238, 255, .12);
      --art-glow: rgba(73, 223, 255, .2);
      --art-blend: screen;
    }
    .art-environment { filter: contrast(1.08) saturate(.8); }
    .lc-leather, .lc-note-bg, .lc-photo-frame, .lc-photo-sky, .lc-photo-ground,
    .lc-door-panel, .lc-note-peek, .lc-lamp-head {
      fill: transparent !important;
      stroke: var(--art-accent);
      stroke-width: 2;
    }
    .lc-photo-sun,
    .lc-photo-figures circle,
    .lc-photo-figures path {
      fill: transparent !important;
      stroke: var(--art-accent-2);
      stroke-width: 2;
    }
    .lc-owner-fill { fill: transparent; stroke: var(--art-accent); stroke-width: 2; opacity: .9; }
    .art-wallet-shell { filter: none; }
    .art-address-card {
      background: transparent !important;
      border: 2px solid var(--art-accent) !important;
      box-shadow: none !important;
    }
    .art-banknote, .art-photo { filter: none; }
    .lc-trail-line { stroke-dasharray: 4 14 !important; }
    [data-si-role="evidence"] { filter: drop-shadow(0 0 10px var(--art-accent-2)); }
  `,
} as const;

export type LivingCanvasSurfaceId = keyof typeof livingCanvasProfiles;

export const livingCanvasRenderer = createSurfaceRenderer({
  id: "living-canvas-v1",
  profiles: livingCanvasProfiles,
  defaultProfile: "nocturne",
  delays: {
    "family-photo": 70,
    address: 140,
    owner: 120,
    "caption.": 160,
  },
  debugNodeLabels: true,
});
