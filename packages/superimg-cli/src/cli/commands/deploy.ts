import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execa } from "execa";
import { bundleTemplateWithMap } from "@superimg/core/bundler";
import { parseTemplate } from "../utils/template-config.js";
import { discoverVideos } from "../utils/discover-videos.js";
import { loadTemplate, renderTemplate } from "../../deploy/template-utils.js";
import type { ManifestEntry } from "../../render-from-bundle.js";

export interface DeployOptions {
  worker?: string;
  dryRun?: boolean;
  verify?: boolean;
}

/** Snapshot persisted alongside generated artifacts. */
interface DeployState {
  workerUrl: string;
  image: string;
  deployedAt: string;
}

export async function deployCommand(templateArg: string | undefined, options: DeployOptions) {
  const cwd = process.cwd();
  const outDir = join(cwd, ".superimg-deploy");

  // ── Preflight ──────────────────────────────────────────────────────────────

  log("Checking prerequisites...");

  await exec("docker", ["info"], "Docker daemon not running — start Docker Desktop and retry.");
  await exec("wrangler", ["whoami"], "Not authenticated with Cloudflare — run `wrangler login` first.");

  // ── Bundle all templates → manifest ───────────────────────────────────────

  log("Discovering templates...");
  const discovered = discoverVideos(cwd);
  if (discovered.length === 0) {
    fatal("No .video.ts files found in the current directory.");
  }

  log(`Bundling ${discovered.length} template(s)...`);
  const manifest: Record<string, ManifestEntry> = {};

  for (const video of discovered) {
    const bundle = await bundleTemplateWithMap(video.entrypoint);
    const parsed = await parseTemplate(video.entrypoint);
    manifest[video.name] = { bundle, parsed };
  }

  // ── Resolve Playwright version for Dockerfile ──────────────────────────────

  const pkgJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
  const playwrightVersion = resolvePlaywrightVersion(pkgJson) ?? "1.57.0";

  const workerName = options.worker ?? pkgJson.name?.replace(/[^a-z0-9-]/g, "-") ?? "superimg";
  const image = `registry.cloudflare.com/${workerName}:latest`;
  const compatDate = new Date().toISOString().slice(0, 10);

  // ── Generate artifacts ─────────────────────────────────────────────────────

  mkdirSync(outDir, { recursive: true });

  const dockerfile = renderTemplate(loadTemplate("Dockerfile.template"), {
    PLAYWRIGHT_VERSION: playwrightVersion,
  });

  const workerSrc = renderTemplate(loadTemplate("worker.ts.template"), {});

  const wranglerToml = renderTemplate(loadTemplate("wrangler.toml.template"), {
    WORKER_NAME: workerName,
    COMPAT_DATE: compatDate,
    IMAGE: image,
  });

  writeFileSync(join(outDir, "Dockerfile"), dockerfile);
  writeFileSync(join(outDir, "worker.ts"), workerSrc);
  writeFileSync(join(outDir, "wrangler.toml"), wranglerToml);
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  if (options.dryRun) {
    log("Dry run — artifacts written to .superimg-deploy/. Skipping build and deploy.");
    log(`  Dockerfile    → ${join(outDir, "Dockerfile")}`);
    log(`  worker.ts     → ${join(outDir, "worker.ts")}`);
    log(`  wrangler.toml → ${join(outDir, "wrangler.toml")}`);
    log(`  manifest.json → ${join(outDir, "manifest.json")} (${Object.keys(manifest).length} templates)`);
    return;
  }

  // ── Docker build + push ────────────────────────────────────────────────────

  log(`[1/3] Building container image ${image}...`);
  await execStream("docker", ["build", "-t", image, "-f", join(outDir, "Dockerfile"), cwd]);

  log(`[2/3] Pushing image...`);
  await execStream("docker", ["push", image]);

  // ── Wrangler deploy ────────────────────────────────────────────────────────

  log(`[3/3] Deploying Worker...`);
  await execStream("wrangler", ["deploy", "--config", join(outDir, "wrangler.toml")]);

  // ── Persist state ──────────────────────────────────────────────────────────

  const workerUrl = `https://${workerName}.workers.dev`;
  const state: DeployState = { workerUrl, image, deployedAt: new Date().toISOString() };
  writeFileSync(join(cwd, "superimg.deploy.json"), JSON.stringify(state, null, 2));

  // ── Done ───────────────────────────────────────────────────────────────────

  log(`\nDeployed! Render endpoint:`);
  log(`  ${workerUrl}/render`);
  log(`\nTest it:`);
  log(`  curl -X POST ${workerUrl}/render \\`);
  log(`    -H 'Content-Type: application/json' \\`);
  log(`    -d '{"template":"${Object.keys(manifest)[0]}"}' \\`);
  log(`    -o output.mp4`);
  log(`\nTail logs:`);
  log(`  wrangler tail ${workerName}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string) {
  process.stdout.write(msg + "\n");
}

function fatal(msg: string): never {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

/** Run a command, fail fast with a human message on non-zero exit. */
async function exec(cmd: string, args: string[], failMessage: string) {
  try {
    await execa(cmd, args, { stdio: "pipe" });
  } catch {
    fatal(failMessage);
  }
}

/** Run a command streaming output to stdout. */
async function execStream(cmd: string, args: string[]) {
  const proc = execa(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
  const result = await proc;
  if (result.exitCode !== 0) {
    fatal(`${cmd} exited with code ${result.exitCode}`);
  }
}

/** Extract the pinned playwright version from package.json peerDependencies or dependencies. */
function resolvePlaywrightVersion(pkg: Record<string, unknown>): string | null {
  const peers = (pkg.peerDependencies ?? {}) as Record<string, string>;
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const raw = peers["playwright"] ?? peers["playwright-core"] ?? deps["playwright"] ?? deps["playwright-core"];
  if (!raw) return null;
  return raw.replace(/^[\^~>=]+/, "").split(".").slice(0, 2).join(".");
}
