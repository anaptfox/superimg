import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";
import { platformDeps, sharedDefine } from "./tsdown.shared.ts";
export default defineConfig({
  name: "inspection", ...libraryDefaults, platform: "browser", shims: false,
  outDir: ".build/player", clean: false,
  entry: { inspection: "src/index.inspection.ts", "inspection/boundary": "src/inspection/boundary.ts" },
  define: sharedDefine,
  deps: { ...platformDeps, neverBundle: [...platformDeps.neverBundle, /^@foxworth\/boundary(?:\/|$)/] },
  outputOptions: { chunkFileNames: "chunks/inspection/[name].js" },
});
