#!/usr/bin/env node
/**
 * Real OCI smoke:
 *   1. Assemble the synchronous runtime into a build context
 *   2. docker build
 *   3. docker run
 *   4. Verify installed versions, render a tiny MP4, and prove /jobs is absent
 *
 * Prerequisites: docker daemon, built @foxworth/superimg-cli dist.
 */
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(__dirname, "../../..");
const cliDist = join(monorepoRoot, "packages/superimg-cli/dist");

const PORT = Number(process.env.SUPERIMG_SMOKE_PORT ?? 18090);
const IMAGE = process.env.SUPERIMG_SMOKE_IMAGE ?? "superimg-oci-smoke:local";

async function main() {
  if (!existsSync(join(cliDist, "container.js"))) {
    throw new Error("Build CLI first: pnpm --filter @foxworth/superimg-cli build");
  }
  await run("docker", ["info"]);

  const { assembleOciRuntime } = await import(
    join(cliDist, "assemble-oci-runtime.js")
  );

  const ctx = mkdtempSync(join(tmpdir(), "si-oci-ctx-"));
  console.log(`[oci-smoke] context ${ctx}`);

  // Assemble runtime into context root
  const assembled = assembleOciRuntime({
    outDir: ctx,
    cliDistDir: cliDist,
  });
  console.log(`[oci-smoke] assembled ${assembled.files.length} dist modules`);

  // Dockerfile + manifest from adapters plan
  const { planDeploy, materializeDeployPlan } = await import(
    "@superimg/adapters/providers"
  );
  const plan = planDeploy({
    imageName: IMAGE.split(":")[0],
    tag: IMAGE.includes(":") ? IMAGE.split(":").slice(1).join(":") : "local",
    profile: "node",
    nodeVersion: assembled.nodeVersion,
    playwrightVersion: assembled.playwrightVersion,
  });
  const files = materializeDeployPlan(plan);
  for (const [rel, body] of Object.entries(files)) {
    writeFileSync(join(ctx, rel), body);
  }

  console.log(`[oci-smoke] docker build -t ${IMAGE}`);
  await run("docker", ["build", "-t", IMAGE, "-f", join(ctx, "Dockerfile"), ctx]);

  const name = `superimg-oci-smoke-${process.pid}`;
  const fixture = join(ctx, "smoke-manifest.json");
  writeFileSync(fixture, JSON.stringify({ fixture: renderFixture() }));
  console.log(`[oci-smoke] docker create ${name}`);
  await run("docker", [
    "create",
    "--rm",
    "--name",
    name,
    "-p",
    `127.0.0.1:${PORT}:8080`,
    IMAGE,
  ]);

  const baseUrl = `http://127.0.0.1:${PORT}`;
  try {
    await run("docker", ["cp", fixture, `${name}:/app/manifest.json`]);
    await run("docker", ["start", name]);
    await waitHealth(baseUrl);
    console.log("[oci-smoke] healthz ok");
    await run("docker", ["exec", name, "node", "--input-type=module", "-e", `
      import { readFileSync } from "node:fs";
      import { findPackageJSON } from "node:module";
      import assert from "node:assert/strict";
      const manifest = new URL("file:///app/package.json");
      const { dependencies } = JSON.parse(readFileSync(manifest, "utf8"));
      assert.equal(process.versions.node, process.argv[1], "Node release pin");
      for (const [name, version] of Object.entries(dependencies)) {
        const installed = JSON.parse(readFileSync(findPackageJSON(name, manifest), "utf8"));
        assert.equal(installed.version, version, name);
      }
      console.log("[oci-smoke] Node and installed dependency versions match the assembled context");
    `, assembled.nodeVersion]);

    const render = await fetch(`${baseUrl}/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template: "fixture",
        encoding: {
          format: "mp4",
          video: { codec: "vp9", quality: "low", hardwareAcceleration: "prefer-software" },
        },
      }),
    });
    if (!render.ok || render.headers.get("content-type") !== "video/mp4") {
      throw new Error(`/render expected an MP4, got ${render.status}: ${await render.text()}`);
    }
    const bytes = Buffer.from(await render.arrayBuffer());
    if (bytes.toString("ascii", 4, 8) !== "ftyp") {
      throw new Error("/render did not return an MP4 file");
    }
    const jobs = await fetch(`${baseUrl}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (jobs.status !== 404) {
      throw new Error(`/jobs must be absent, got ${jobs.status}`);
    }

    console.log(`\n[oci-smoke] ALL PASSED (pins + healthz + ${bytes.length}-byte MP4 + no /jobs)`);
  } catch (error) {
    await run("docker", ["logs", name]).catch(() => {});
    throw error;
  } finally {
    await run("docker", ["rm", "-f", name]).catch(() => {});
    rmSync(ctx, { recursive: true, force: true });
  }
}

function renderFixture() {
  const config = { width: 64, height: 64, fps: 2, duration: 1 };
  // Pre-bundled Html forces the worker through Chromium and the lazy native encoder.
  const code = `const __template = { default: {
    kind: "media", media: "video", fallbackFormat: "mp4", medium: "html", animated: true,
    config: ${JSON.stringify(config)},
    render: () => ({
      $$typeof: "@foxworth/superimg/element", type: "Html", children: [],
      props: { width: 64, height: 64, html: '<div style="width:64px;height:64px;background:red"></div>' }
    })
  } };`;
  return {
    bundle: { code },
    parsed: {
      templateCode: "", medium: "html", animated: true,
      metasample: { hasRenderExport: true, hasDefaultExport: false },
      templateConfig: config, config, resolvedAssets: [],
    },
  };
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`)),
    );
  });
}

async function waitHealth(baseUrl, attempts = 90) {
  let last = "";
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/healthz`);
      if (res.ok) return await res.json();
      last = `status ${res.status}`;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  // dump docker logs
  try {
    await run("docker", ["ps", "-a"]);
  } catch {
    /* */
  }
  throw new Error(`healthz not ready: ${last}`);
}

main().catch((e) => {
  console.error("[oci-smoke] FAILED", e);
  process.exit(1);
});
