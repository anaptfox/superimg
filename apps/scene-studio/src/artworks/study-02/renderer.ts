import { createSurfaceRenderer } from "../../kit/surface-renderer";

export const study_02Profiles = {
  default: `
    :root {
      --art-bg: #0b0d12;
      --art-bg-2: #171a24;
      --art-ink: #f5f0e6;
      --art-muted: rgba(245, 240, 230, .6);
      --art-accent: #ff7658;
      --art-accent-2: #70e8d0;
      --art-accent-3: #8f7cff;
      --art-line: rgba(245, 240, 230, .2);
      --art-grid: rgba(255,255,255,.04);
      --art-glow: rgba(255, 118, 88, .3);
      --art-blend: screen;
    }
  `,
} as const;

export const study_02Renderer = createSurfaceRenderer({
  id: "study-02-v1",
  profiles: study_02Profiles,
  defaultProfile: "default",
  debugNodeLabels: true,
});
