import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(
  import.meta.resolve("@superimg/dev-ui/package.json"),
);
const source = join(dirname(packageJsonPath), "dist");
const destination = fileURLToPath(new URL("../dist/dev-ui", import.meta.url));

try {
  const sourceStat = await stat(source);
  if (!sourceStat.isDirectory()) throw new Error("build output is not a directory");
  await stat(join(source, "index.html"));
} catch (error) {
  throw new Error(
    `@superimg/dev-ui has not been built; expected ${join(source, "index.html")}`,
    { cause: error },
  );
}

await rm(destination, { recursive: true, force: true });
await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });

// Ship scaffold-examples next to dist so published CLI can init without monorepo.
const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const examplesSrc = join(pkgRoot, "scaffold-examples");
const examplesDest = join(pkgRoot, "dist", "scaffold-examples");
try {
  await stat(examplesSrc);
  await rm(examplesDest, { recursive: true, force: true });
  await cp(examplesSrc, examplesDest, { recursive: true });
} catch {
  // Optional if examples not present in some workspaces
}

// Bundled Inter and the resvg wasm ship in dist/assets so the published CLI (and
// apps that bundle it) can rasterize SVG stills without the monorepo.
{
  const { createRequire } = await import("node:module");
  const coreRoot = join(pkgRoot, "..", "superimg-core");
  const assetsDest = join(pkgRoot, "dist", "assets");
  await cp(join(coreRoot, "assets", "fonts"), join(assetsDest, "fonts"), { recursive: true });
  const wasm = createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm");
  await mkdir(join(assetsDest, "resvg"), { recursive: true });
  await cp(wasm, join(assetsDest, "resvg", "index_bg.wasm"));
}
