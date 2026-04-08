import { defineConfig } from "tsup";

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
  },
]);
