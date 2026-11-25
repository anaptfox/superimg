import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: {
    index: "src/index.ts",
    server: "src/server.ts",
    client: "src/client.ts",
    "client.react-server": "src/client.react-server.ts",
  },
  outDir: "dist",
  external: [
    "next",
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@foxworth/superimg",
    "@foxworth/superimg/react/player",
    "@superimg/adapters",
    "@superimg/types",
  ],
});
