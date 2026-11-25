import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";
import { platformAlias, platformDeps, sharedDefine } from "./tsdown.shared.ts";

export default defineConfig({
  name: "edge",
  ...libraryDefaults,
  outDir: ".build/edge",
  platform: "neutral",
  clean: true,
  entry: {
    "runtime.edge": "src/runtime.edge.ts",
    "runtime.edge-raster": "src/runtime.edge-raster.ts",
    "runtime/html": "src/runtime.html.ts",
  },
  define: sharedDefine,
  deps: platformDeps,
  alias: platformAlias,
  // Namespace shared chunks so this secondary build can't overwrite node entries.
  outputOptions: {
    chunkFileNames: "chunks/edge/[name].js",
    // Lazy capability chunks re-import bindings from the entry; keep those
    // internal names readable instead of minified (`n`, `t`).
    minifyInternalExports: false,
  },
});
