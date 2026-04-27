import { defineConfig } from "tsup";

const noExternal = ["@superimg/skill"];

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      server: "src/server.ts",
    },
    format: ["esm"],
    dts: true,
    outDir: "dist",
    splitting: false,
    clean: true,
    noExternal,
  },
  {
    entry: {
      "bin/superimg-mcp": "bin/superimg-mcp.ts",
    },
    format: ["esm"],
    outDir: "dist",
    splitting: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
    noExternal,
  },
]);
