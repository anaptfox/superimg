import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const repoRoot = join(appRoot, "..", "..");

const coreEnginePath = join(repoRoot, "packages", "superimg-core", "dist", "engine.js");
const cliPath = join(appRoot, "dist", "cli.js");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  assert(existsSync(coreEnginePath), `Missing built core engine at ${coreEnginePath}`);
  assert(existsSync(cliPath), `Missing built CLI entrypoint at ${cliPath}`);

  const coreEngine = readFileSync(coreEnginePath, "utf8");
  assert(
    !coreEngine.includes("@superimg/stdlib/timeline"),
    "packages/superimg-core/dist/engine.js still references @superimg/stdlib/timeline",
  );

  await import("@superimg/core/engine");
  await import("superimg/server");

  console.log("Verified render build artifacts:");
  console.log(`- ${coreEnginePath} has no @superimg/stdlib/timeline import`);
  console.log(`- ${cliPath} exists`);
  console.log("- built package imports resolve: @superimg/core/engine, superimg/server");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
