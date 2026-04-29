import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const repoRoot = join(packageRoot, "..", "..");

const coreEnginePath = join(repoRoot, "packages", "superimg-core", "dist", "engine.js");
const distRoot = join(packageRoot, "dist");
const cliPath = join(distRoot, "cli.js");
const privateImportPattern = /(?:from\s+|import\s*\(|require\s*\()\s*["']@superimg\//;

const stdlibSubpaths = [
  "backgrounds",
  "code",
  "color",
  "css",
  "date",
  "easing",
  "interpolate",
  "layout",
  "math",
  "montage",
  "path",
  "presets",
  "responsive",
  "score",
  "spring",
  "stagger",
  "subtitle",
  "svg",
  "text",
  "cue",
];

const expectedArtifacts = [
  "index.js",
  "index.d.ts",
  "index.browser.js",
  "index.browser.d.ts",
  "index.server.js",
  "index.server.d.ts",
  "index.player.js",
  "index.player.d.ts",
  "index.bundler.js",
  "index.bundler.d.ts",
  "stdlib.js",
  "stdlib.d.ts",
  "react/index.js",
  "react/index.d.ts",
  "react/player.js",
  "react/player.d.ts",
  "cli.js",
  ...stdlibSubpaths.flatMap((subpath) => [
    `stdlib/${subpath}.js`,
    `stdlib/${subpath}.d.ts`,
  ]),
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function listBuiltFiles(dir) {
  const files = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listBuiltFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  assert(existsSync(coreEnginePath), `Missing built core engine at ${coreEnginePath}`);
  assert(existsSync(cliPath), `Missing built CLI entrypoint at ${cliPath}`);

  for (const artifact of expectedArtifacts) {
    const artifactPath = join(distRoot, artifact);
    assert(existsSync(artifactPath), `Missing public build artifact at ${artifactPath}`);
  }

  const coreEngine = readFileSync(coreEnginePath, "utf8");
  assert(
    !coreEngine.includes("@superimg/stdlib/timeline"),
    "packages/superimg-core/dist/engine.js still references @superimg/stdlib/timeline",
  );

  for (const builtFile of listBuiltFiles(distRoot)) {
    if (!/\.(?:js|cjs|mjs|d\.ts|d\.cts|d\.mts)$/.test(builtFile)) {
      continue;
    }

    const contents = readFileSync(builtFile, "utf8");
    assert(
      !privateImportPattern.test(contents),
      `Public build artifact references a private @superimg/* package: ${builtFile}`,
    );
  }

  await Promise.all([
    import("superimg"),
    import("superimg/browser"),
    import("superimg/server"),
    import("superimg/player"),
    import("superimg/react"),
    import("superimg/react/player"),
    import("superimg/stdlib"),
    import("superimg/bundler"),
    ...stdlibSubpaths.map((subpath) => import(`superimg/stdlib/${subpath}`)),
  ]);

  console.log("Verified superimg build artifacts:");
  console.log(`- ${coreEnginePath} has no @superimg/stdlib/timeline import`);
  console.log(`- ${cliPath} exists`);
  console.log("- all public subpath artifacts exist");
  console.log("- public JS and declarations do not import private @superimg/* packages");
  console.log("- built package imports resolve: superimg, browser, server, player, react, react/player, stdlib, bundler");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
