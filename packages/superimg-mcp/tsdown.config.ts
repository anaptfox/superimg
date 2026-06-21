import { defineConfig } from "tsdown";

const alwaysBundle = ["@superimg/skill"];

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      server: "src/server.ts",
    },
    format: ["esm"],
    dts: true,
    outDir: "dist",
    clean: true,
    deps: { alwaysBundle },
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  },
  {
    entry: {
      "bin/superimg-mcp": "bin/superimg-mcp.ts",
    },
    format: ["esm"],
    outDir: "dist",
    banner: {
      js: "#!/usr/bin/env node",
    },
    deps: { alwaysBundle },
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  },
]);
