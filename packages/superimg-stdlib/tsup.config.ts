import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/easing.ts",
    "src/math.ts",
    "src/color.ts",
    "src/date.ts",
    "src/text.ts",
    "src/timing.ts",

    "src/responsive.ts",
    "src/alea.ts",
    "src/subtitle.ts",
    "src/presets.ts",
    "src/index.ts",
  ],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  clean: true,
  // Each entry becomes a standalone bundle (no shared chunks)
  splitting: false,
  // Bundle everything into each file (including dependencies)
  bundle: true,
  // Don't mark dependencies as external - we want them bundled
  noExternal: ["date-fns", "colord", "simplex-noise"],
});
