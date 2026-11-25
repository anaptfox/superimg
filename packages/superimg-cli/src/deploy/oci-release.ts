import { readFileSync } from "node:fs";
import { findPackageJSON } from "node:module";

/** Top-level packages used by the assembled container's JS closure. */
const runtimePackages = [
  "@hono/node-server",
  "@mediabunny/dts",
  "@mediabunny/server",
  "@resvg/resvg-wasm",
  "execa",
  "hono",
  "mediabunny",
  "oxc-parser",
  "playwright",
  "rolldown",
  "sharp",
  "three",
] as const;

export interface OciRelease {
  nodeVersion: string;
  dependencies: Record<(typeof runtimePackages)[number], string>;
}

/** Read from the CLI's resolved dependencies at build time, including unexported manifests. */
export function readOciRelease(cliDir: URL): OciRelease {
  const nodeVersion = readFileSync(new URL("../../.node-version", cliDir), "utf8").trim();
  const dependencies = {} as OciRelease["dependencies"];
  for (const name of runtimePackages) {
    const manifestPath = findPackageJSON(name, cliDir);
    if (!manifestPath) throw new Error(`OCI release: could not locate package.json for ${name}`);
    const { version } = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: unknown };
    if (typeof version !== "string" || !version) {
      throw new Error(`OCI release: missing version in ${manifestPath}`);
    }
    dependencies[name] = version;
  }
  return { nodeVersion, dependencies };
}
