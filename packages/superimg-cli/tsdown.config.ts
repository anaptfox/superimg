import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";
import { cliAlwaysBundle, cliNeverBundle } from "../build-policy/bundle-deps.mjs";
import { libraryDefaults } from "../build-policy/tsdown.base.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const superimgPkg = JSON.parse(
  readFileSync(resolve(__dirname, "../superimg/package.json"), "utf8"),
);
if (typeof superimgPkg.version !== "string" || !superimgPkg.version) {
  throw new Error(
    "tsdown.config.ts: could not read version from ../superimg/package.json",
  );
}

export default defineConfig({
  ...libraryDefaults,
  platform: "node",
  entry: {
    cli: "src/cli/index.ts",
    server: "src/server.ts",
    container: "src/container/handler.ts",
    integration: "src/integration/index.ts",
  },
  clean: true,
  define: {
    __SUPERIMG_VERSION__: JSON.stringify(superimgPkg.version),
  },
  deps: {
    alwaysBundle: cliAlwaysBundle,
    neverBundle: cliNeverBundle,
  },
  onSuccess: "cd dev-ui && vite build",
});