import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";
import { cliAlwaysBundle, cliNeverBundle } from "@superimg/build-config/bundle-deps";
import { libraryDefaults } from "@superimg/build-config/tsdown";
import { readOciRelease } from "./src/deploy/oci-release.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const renderJob = resolve(__dirname, "src/utils/build-render-job.ts");
const projectTools = "@foxworth/superimg-node/project-tools";
const isRenderJobProjectTools = (source: string, importer?: string) =>
  source === projectTools && importer === renderJob;
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
    "dev-server": "src/dev-server.ts",
    container: "src/container/handler.ts",
    "container-worker": "src/container/render-worker.ts",
    "assemble-oci-runtime": "src/deploy/assemble-oci-runtime.ts",
  },
  clean: true,
  define: {
    __SUPERIMG_VERSION__: JSON.stringify(cliPkg.version),
    __SUPERIMG_OCI_RELEASE__: JSON.stringify(readOciRelease(new URL("./", import.meta.url))),
  },
  plugins: [
    {
      name: "superimg-shared-runtime-kernel",
      resolveId: {
        order: "pre",
        handler(source) {
          if (source === "@superimg/core/runtime") return { id: "@foxworth/superimg/internal/runtime-kernel", external: true };
        },
      },
    },
    {
      name: "superimg-standalone-render-job",
      resolveId: {
        order: "pre",
        handler(source, importer) {
          // The assembled container ships the render job's configuration code
          // with its JS closure. Other CLI callers keep the public package external.
          if (isRenderJobProjectTools(source, importer)) {
            return fileURLToPath(import.meta.resolve(projectTools));
          }
        },
      },
    },
  ],
  deps: {
    alwaysBundle: cliAlwaysBundle,
    neverBundle: (source, importer) =>
      !isRenderJobProjectTools(source, importer) &&
      cliNeverBundle.some((rule) => typeof rule === "string" ? source === rule : rule.test(source)),
  },
});
