import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";
import { cliAlwaysBundle, cliNeverBundle } from "@superimg/build-config/bundle-deps";
import { libraryDefaults } from "@superimg/build-config/tsdown";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf8"),
);
if (typeof cliPkg.version !== "string" || !cliPkg.version) {
  throw new Error(
    "tsdown.config.ts: could not read version from package.json",
  );
}

export default defineConfig({
  ...libraryDefaults,
  platform: "node",
  entry: {
    cli: "src/cli/index.ts",
    server: "src/server.ts",
    container: "src/container/handler.ts",
    "container-worker": "src/container/render-worker.ts",
    integration: "src/integration/index.ts",
  },
  clean: true,
  define: {
    __SUPERIMG_VERSION__: JSON.stringify(cliPkg.version),
  },
  deps: {
    alwaysBundle: cliAlwaysBundle,
    neverBundle: cliNeverBundle,
  },
});
