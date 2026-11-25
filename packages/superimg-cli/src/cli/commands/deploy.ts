//! Provider-neutral OCI deploy: package → assemble runtime → image build → optional push.
//! No Wrangler, Cloudflare registry, or provider resource creation.

import { join, dirname, resolve as pathResolve } from "node:path";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import {
  materializeDeployPlan,
  planDeploy,
} from "@superimg/adapters/providers";
import type { DeployRuntimeProfile } from "@superimg/types";
import { discoverVideos } from "../utils/discover-videos.js";
import { packageTemplates } from "../../package/package-templates.js";
import { assembleOciRuntime } from "../../deploy/assemble-oci-runtime.js";

export interface DeployOptions {
  /** Image reference, e.g. ghcr.io/org/superimg-render:latest */
  image?: string;
  dryRun?: boolean;
  push?: boolean;
  profile?: DeployRuntimeProfile;
  withFfmpeg?: boolean;
}
export async function deployCommand(
  _templateArg: string | undefined,
  options: DeployOptions,
) {
  const cwd = process.cwd();
  const outDir = join(cwd, ".superimg-deploy");
  const profile: DeployRuntimeProfile =
    options.profile ?? (options.withFfmpeg ? "node-media" : "node");

  log("Checking prerequisites...");
  if (!options.dryRun) {
    await exec(
      "docker",
      ["info"],
      "Docker daemon not running — start Docker and retry.",
    );
  }

  log("Discovering templates...");
  const discovered = discoverVideos(cwd);
  if (discovered.length === 0) {
    fatal("No *.media.ts files found in the current directory.");
  }

  // Fresh context
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // 1) Package templates into content-addressed store (inside build context)
  log(`Packaging ${discovered.length} template(s)...`);
  const packagesDir = join(outDir, "packages");
  const packaged = await packageTemplates({
    cwd,
    outRoot: packagesDir,
    entries: discovered.map((d) => ({
      name: d.name,
      entrypoint: d.entrypoint,
    })),
  });

  // 2) Assemble container runtime (dist/container.js + package.json for npm install)
  log("Assembling container runtime into deploy context...");
  const cliDist = resolveCliDistDir();
  const assembled = assembleOciRuntime({
    outDir,
    cliDistDir: cliDist,
  });
  log(
    `  runtime: ${assembled.files.length} dist modules → ${join(outDir, "dist")}`,
  );

  // 3) Generate Dockerfile + runtime-manifest
  const imageRef = options.image ?? `superimg-render:${profile}`;
  const slash = imageRef.lastIndexOf(":");
  const imageName =
    slash > 0 && !imageRef.slice(slash + 1).includes("/")
      ? imageRef.slice(0, slash)
      : imageRef;
  const tag =
    slash > 0 && !imageRef.slice(slash + 1).includes("/")
      ? imageRef.slice(slash + 1)
      : "latest";

  const plan = planDeploy({
    profile,
    imageName,
    tag,
    nodeVersion: assembled.nodeVersion,
    playwrightVersion: assembled.playwrightVersion,
    withFfmpeg: options.withFfmpeg ?? profile === "node-media",
  });
  const files = materializeDeployPlan(plan);

  for (const [rel, contents] of Object.entries(files)) {
    writeFileSync(join(outDir, rel), contents);
  }

  // Package catalog for operators
  writeFileSync(
    join(outDir, "packages-index.json"),
    JSON.stringify(
      {
        schemaVersion: 0,
        packages: packaged.map((p) => ({
          sourceId: p.sourceId,
          packageHash: p.packageHash,
          path: p.relativePath,
        })),
      },
      null,
      2,
    ),
  );

  if (options.dryRun) {
    log(
      `Dry run — OCI build context written to .superimg-deploy/ (profile=${profile}).`,
    );
    log(`  package.json + dist/ (${assembled.files.length} modules)`);
    log(`  packages/ (${packaged.length} packages)`);
    for (const rel of Object.keys(files)) {
      log(`  ${rel.padEnd(24)} → ${join(outDir, rel)}`);
    }
    for (const note of plan.notes) log(`  note: ${note}`);
    return;
  }

  // 4) Build image from outDir context (includes runtime + packages)
  const fullImage = `${imageName}:${tag}`;
  log(`[1/2] Building container image ${fullImage}...`);
  await execStream("docker", [
    "build",
    "-t",
    fullImage,
    "-f",
    join(outDir, "Dockerfile"),
    outDir,
  ]);

  // 5) Optional push
  if (options.push) {
    log(`[2/2] Pushing ${fullImage}...`);
    await execStream("docker", ["push", fullImage]);
  } else {
    log(`[2/2] Skipping push (pass --push to publish ${fullImage}).`);
  }

  const state = {
    image: fullImage,
    profile,
    packaged: packaged.map((p) => ({
      sourceId: p.sourceId,
      packageHash: p.packageHash,
    })),
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(join(cwd, "superimg.deploy.json"), JSON.stringify(state, null, 2));

  log(`\nOCI image ready: ${fullImage} (profile=${profile})`);
  log(`Packages: ${packaged.map((p) => p.sourceId).join(", ")}`);
  log(`Run: docker run --rm -p 8080:8080 ${fullImage}`);
}

function resolveCliDistDir(): string {
  // Prefer built dist next to this package
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/cli/commands/deploy.js → dist/  OR  src/cli/commands → ../../dist
  const candidates = [
    pathResolve(here, "../.."),
    pathResolve(here, "../../../dist"),
    join(cwdMonorepoRoot(), "packages/superimg-cli/dist"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "container.js"))) return dir;
  }
  fatal(
    "Could not find packages/superimg-cli/dist/container.js — run: pnpm --filter @foxworth/superimg-cli build",
  );
}

function cwdMonorepoRoot(): string {
  // Walk up from process.cwd() looking for packages/superimg-cli
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "packages/superimg-cli/package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function log(msg: string) {
  process.stdout.write(msg + "\n");
}

function fatal(msg: string): never {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

async function exec(cmd: string, args: string[], failMessage: string) {
  try {
    await execa(cmd, args, { stdio: "pipe" });
  } catch {
    fatal(failMessage);
  }
}

async function execStream(cmd: string, args: string[]) {
  const proc = execa(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
  const result = await proc;
  if (result.exitCode !== 0) {
    fatal(`${cmd} exited with code ${result.exitCode}`);
  }
}
