import { execFile as execFileCb, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFile = promisify(execFileCb);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const superimgPackage = join(repoRoot, "packages", "superimg");
const cliPackage = join(repoRoot, "packages", "superimg-cli");
const nodePackage = join(repoRoot, "packages", "superimg-node-public");
const interactionsPackage = join(repoRoot, "packages", "superimg-interactions-public");
const monorepoCli = join(cliPackage, "dist", "cli.js");

const REMOVED_ROOT_EXPORTS = [
  "lower",
  "walkMediaTree",
  "planNarration",
  "MEDIA_ELEMENT",
  "TemplateCompilationError",
  "ValidationError",
  "RenderError",
] as const;

// @types/d3-force and @types/d3-scale stay: the public .d.ts references d3 types (follow-up: stop leaking them).
const BANNED_DEPENDENCIES = [
  "rolldown",
  "oxc-parser",
  "acorn",
  "source-map-js",
] as const;

const TIMEOUT_MS = 120_000;

type PackageManifest = {
  bin?: string | Record<string, string>;
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  devDependencies?: Record<string, string>;
  files?: string[];
};

type Packed = {
  tarball: string;
  listing: string[];
  packageDir: string;
  manifest: PackageManifest;
};

type CommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

const dirs: string[] = [];
const report: Record<string, unknown> = {};

let scratch = "";
let packedSuperimg: Packed;
let packedCli: Packed;
let packedNode: Packed;
let packedInteractions: Packed;

function run(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function dependencyBags(manifest: PackageManifest): Record<string, string>[] {
  return [
    manifest.dependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
    manifest.devDependencies,
  ].filter((bag): bag is Record<string, string> => bag !== undefined);
}

function hasUnresolvedProtocol(manifest: PackageManifest): boolean {
  return dependencyBags(manifest).some((bag) =>
      Object.values(bag).some((spec) => /^(workspace|catalog):/.test(spec)),
  );
}

async function readPacked(dest: string): Promise<Packed> {
  const tarballs = (await readdir(dest)).filter((name) => name.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    throw new Error(`Expected one tarball in ${dest}, found ${tarballs.join(", ") || "none"}`);
  }
  const tarball = join(dest, tarballs[0]!);
  const listed = await execFile("tar", ["-tzf", tarball], { maxBuffer: 64 * 1024 * 1024 });
  const listing = listed.stdout.split("\n").filter(Boolean);
  const extract = join(dest, "extract");
  await mkdir(extract, { recursive: true });
  await execFile("tar", ["-xzf", tarball, "-C", extract]);
  const manifest = JSON.parse(
    await readFile(join(extract, "package", "package.json"), "utf8"),
  ) as PackageManifest;
  return { tarball, listing, packageDir: join(extract, "package"), manifest };
}

async function bundledSuperimgResolution(project: string): Promise<string> {
  const cliDist = join(cliPackage, "dist");
  const candidates = [
    join(cliDist, "../template-runtime.js"),
    join(cliDist, "template-runtime.js"),
    join(cliDist, "../template-runtime.ts"),
    join(cliDist, "../../src/template-runtime.ts"),
    join(cliDist, "../../superimg-core/dist/template-runtime.js"),
    join(cliDist, "../superimg-core/dist/template-runtime.js"),
    join(cliDist, "../../../../superimg-core/dist/template-runtime.js"),
    join(cliDist, "../../../superimg-core/dist/template-runtime.js"),
    join(project, "packages/superimg-core/dist/template-runtime.js"),
    join(project, "../packages/superimg-core/dist/template-runtime.js"),
    join(project, "../../packages/superimg-core/dist/template-runtime.js"),
  ];
  const existing: string[] = [];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) existing.push(candidate);
    } catch {
      // Candidate is absent. The bundler uses the first file that exists.
    }
  }
  const resolver = join(project, "resolve-superimg.mjs");
  await writeFile(
    resolver,
    `import { createRequire } from "node:module";
console.log(createRequire(import.meta.url).resolve("@foxworth/superimg"));
`,
  );
  const nodeResolved = await run("node", [resolver], project);
  let lowerExport = "no candidate";
  const chosen = existing[0];
  if (chosen) {
    const probe = join(project, "probe-runtime.mjs");
    await writeFile(
      probe,
      `const runtime = await import(${JSON.stringify(pathToFileURL(chosen).href)});
console.log("lower" in runtime ? "exports lower" : "does not export lower");
`,
    );
    const probed = await run("node", [probe], project);
    lowerExport = `${probed.stdout.trim()} ${probed.stderr.trim()}`.trim();
  }
  return [
    `node resolved "superimg" to ${nodeResolved.stdout.trim() || nodeResolved.stderr.trim()}`,
    `CLI bundler (packages/superimg-cli/dist/bundler2.js) first existing template runtime: ${chosen ?? "none"}`,
    `that module ${lowerExport}`,
    existing.length > 1 ? `later candidates also on disk: ${existing.slice(1).join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

async function packPackage(cwd: string, label: string): Promise<Packed> {
  const dest = join(scratch, `${label}-pack`);
  await mkdir(dest, { recursive: true });
  const env = {
    ...process.env,
    npm_config_ignore_scripts: "true",
    npm_config_audit: "false",
    npm_config_fund: "false",
  };
  let tool: "npm" | "pnpm" = "npm";
  try {
    await execFile("npm", ["pack", "--pack-destination", dest], {
      cwd,
      env,
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    tool = "pnpm";
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    await execFile("pnpm", ["pack", "--pack-destination", dest], {
      cwd,
      env,
      maxBuffer: 20 * 1024 * 1024,
    });
    const packed = await readPacked(dest);
    report[`${label}PackTool`] = `pnpm after npm failed: ${error instanceof Error ? error.message : String(error)}`;
    return packed;
  }
  let packed = await readPacked(dest);
  if (hasUnresolvedProtocol(packed.manifest)) {
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    await execFile("pnpm", ["pack", "--pack-destination", dest], {
      cwd,
      env,
      maxBuffer: 20 * 1024 * 1024,
    });
    packed = await readPacked(dest);
    tool = "pnpm";
  }
  report[`${label}PackTool`] = tool;
  if (hasUnresolvedProtocol(packed.manifest)) {
    throw new Error(`${label} packed manifest still contains workspace: or catalog: after ${tool} pack`);
  }
  return packed;
}

async function provisionPackedPackages(projectNodeModules: string): Promise<string[]> {
  const packages = [
    { name: "@foxworth/superimg", source: superimgPackage, packed: packedSuperimg },
    { name: "@foxworth/superimg-cli", source: cliPackage, packed: packedCli },
    { name: "@foxworth/superimg-node", source: nodePackage, packed: packedNode },
    { name: "@foxworth/superimg-interactions", source: interactionsPackage, packed: packedInteractions },
  ];
  const provided = new Set(packages.map(({ name }) => name));
  for (const { name, source, packed } of packages) {
    const destination = join(projectNodeModules, ...name.split("/"));
    await mkdir(dirname(destination), { recursive: true });
    await cp(packed.packageDir, destination, { recursive: true, dereference: true });
  }
  const linked: string[] = [];
  for (const { source, packed } of packages) {
    const manifest = packed.manifest;
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      if (provided.has(name)) continue;
      const dependency = join(source, "node_modules", ...name.split("/"));
      const destination = join(projectNodeModules, ...name.split("/"));
      await mkdir(dirname(destination), { recursive: true });
      await symlink(await realpath(dependency), destination);
      provided.add(name);
      linked.push(name);
    }
  }
  return linked;
}

describe("package surface", { timeout: TIMEOUT_MS, hookTimeout: TIMEOUT_MS }, () => {
  beforeAll(async () => {
    scratch = await mkdtemp(join(tmpdir(), "superimg-package-surface-"));
    dirs.push(scratch);
    packedSuperimg = await packPackage(superimgPackage, "superimg");
    packedCli = await packPackage(cliPackage, "cli");
    packedNode = await packPackage(nodePackage, "node");
    packedInteractions = await packPackage(interactionsPackage, "interactions");
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (process.env.SUPERIMG_KEEP_CONSUMER === "1") {
      await writeFile(join(scratch, "report.json"), JSON.stringify(report, null, 2));
      console.log(`Package consumer evidence: ${scratch}`);
      return;
    }
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  // Explicit network/native integration gate. The ordinary suite keeps its fast,
  // linked dependency fixtures; this path installs the actual published closure.
  it.runIf(process.env.SUPERIMG_INDEPENDENT_INSTALL === "1")(
    "runs the server library journey from independently installed tarballs",
    async () => {
      const project = await mkdtemp(join(scratch, "independent-"));
      const typescript = JSON.parse(await readFile(join(repoRoot, "node_modules/typescript/package.json"), "utf8"));
      const nodeTypes = JSON.parse(await readFile(join(repoRoot, "node_modules/@types/node/package.json"), "utf8"));
      await writeFile(join(project, "package.json"), JSON.stringify({
        name: "superimg-independent-consumer", private: true, type: "module",
        dependencies: {
          "@foxworth/superimg": `file:${packedSuperimg.tarball}`,
          "@foxworth/superimg-node": `file:${packedNode.tarball}`,
          typescript: typescript.version,
          "@types/node": nodeTypes.version,
        },
      }, null, 2));
      const installed = await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], project);
      report.independentInstall = { ...installed, project };
      expect(installed.code, installed.stderr).toBe(0);
      // No repo package or external dependency may secretly resolve through a
      // workspace symlink. Symlinks within this independent install are fine.
      const modules = join(project, "node_modules");
      for (const name of ["@foxworth/superimg", "@foxworth/superimg-node", "mediabunny", "playwright", "typescript"]) {
        expect((await realpath(join(modules, name))).startsWith(`${await realpath(project)}/`)).toBe(true);
      }
      for (const name of ["@superimg", "@foxworth/boundary", "@foxworth/superimg-cli"]) {
        await expect(stat(join(modules, name))).rejects.toMatchObject({ code: "ENOENT" });
      }
      for (const name of ["server-library-consumer.mjs", "server-library-consumer.ts"]) {
        await cp(join(here, "../fixtures", name), join(project, name));
      }
      const typed = await run(process.execPath, [
        "node_modules/typescript/bin/tsc", "--noEmit", "--strict",
        "--module", "nodenext", "--target", "es2022", "server-library-consumer.ts",
      ], project);
      report.independentTypes = typed;
      expect(typed.code, `${typed.stdout}\n${typed.stderr}`).toBe(0);
      const result = await run(process.execPath, ["server-library-consumer.mjs"], project);
      report.independentJourney = result;
      report.tarballs = await Promise.all([packedSuperimg, packedNode].map(async (packed) => ({
        path: packed.tarball,
        sha256: createHash("sha256").update(await readFile(packed.tarball)).digest("hex"),
      })));
      expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    },
    600_000,
  );

  it("packs @foxworth/superimg with an optional Boundary inspection peer and no CLI host", () => {
    const manifest = packedSuperimg.manifest;
    expect(manifest.name).toBe("@foxworth/superimg");
    expect(packedSuperimg.tarball.split("/").at(-1)).toMatch(/^foxworth-superimg-/);
    report.superimgManifest = {
      bin: manifest.bin ?? null,
      interactionsExport: manifest.exports?.["./interactions"] ?? null,
      dependencies: manifest.dependencies ?? {},
      peerDependencies: manifest.peerDependencies ?? {},
      peerDependenciesMeta: manifest.peerDependenciesMeta ?? {},
      bannedPresent: BANNED_DEPENDENCIES.filter((name) => name in (manifest.dependencies ?? {})),
      boundaryPeers: Object.keys(manifest.peerDependencies ?? {}).filter((name) => (name === "@foxworth/boundary" || name.startsWith("@ops-first/"))),
      hasCliJs: packedSuperimg.listing.includes("package/dist/cli.js"),
      hasInteractionsJs: packedSuperimg.listing.includes("package/dist/interactions.js"),
    };

    expect(manifest.bin).toBeUndefined();
    expect(manifest.exports?.["./interactions"]).toBeUndefined();
    for (const name of BANNED_DEPENDENCIES) {
      expect(manifest.dependencies ?? {}).not.toHaveProperty(name);
    }
    for (const name of Object.keys(manifest.peerDependencies ?? {})) {
      expect(name.startsWith("@ops-first/")).toBe(false);
    }
    expect(manifest.peerDependencies?.["@foxworth/boundary"]).toBe("^0.2.0");
    expect(manifest.peerDependenciesMeta?.["@foxworth/boundary"]?.optional).toBe(true);
    expect(manifest.exports?.["./inspection"]).toBeTruthy();
    expect(manifest.exports?.["./inspection/boundary"]).toBeTruthy();
    expect(manifest.peerDependencies).toHaveProperty("playwright");
    expect(manifest.peerDependencies).toHaveProperty("node-av");
    expect(manifest.peerDependenciesMeta?.playwright?.optional).toBe(true);
    expect(manifest.peerDependenciesMeta?.["node-av"]?.optional).toBe(true);
    expect(packedSuperimg.listing).not.toContain("package/dist/cli.js");
    expect(packedSuperimg.listing).not.toContain("package/dist/interactions.js");
  });

  it("packs @foxworth/superimg-cli with the CLI bin and an interactions dependency", async () => {
    const manifest = packedCli.manifest;
    const bin = manifest.bin;
    const binPath = bin !== undefined && typeof bin !== "string" ? bin.superimg : undefined;
    const cliEntry = await readFile(join(packedCli.packageDir, "dist", "cli.js"), "utf8");
    const shebang = cliEntry.split("\n")[0];
    const dependencyKeys = Object.keys(manifest.dependencies ?? {});
    report.cliManifest = {
      bin,
      interactionsExport: manifest.exports?.["./interactions"] ?? null,
      superimgPeer: manifest.peerDependencies?.["@foxworth/superimg"] ?? null,
      superimgDependencies: dependencyKeys.filter((name) => name.startsWith("@superimg/")),
      shebang,
      files: manifest.files ?? [],
      scaffoldInTarball: packedCli.listing.some(
        (entry) => entry === "package/scaffold-examples" || entry.startsWith("package/scaffold-examples/"),
      ),
    };

    expect(binPath).toBe("./dist/cli.js");
    expect(manifest.exports?.["./interactions"]).toBeUndefined();
    expect(manifest.dependencies?.["@foxworth/superimg-interactions"]).toBeTruthy();
    expect(packedCli.listing).not.toContain("package/dist/interactions.js");
    expect(manifest.exports?.["./operations"]).toBeUndefined();
    expect(manifest.dependencies?.["@foxworth/boundary"]).toBe("^0.2.0");
    expect(manifest.name).toBe("@foxworth/superimg-cli");
    expect(packedCli.tarball.split("/").at(-1)).toMatch(/^foxworth-superimg-cli-/);
    expect(manifest.peerDependencies?.["@foxworth/superimg"]).toBeTruthy();
    expect(dependencyKeys.filter((name) => name.startsWith("@superimg/"))).toEqual([]);
    expect(shebang).toBe("#!/usr/bin/env node");
    expect(manifest.files).toContain("scaffold-examples");
    expect(
      packedCli.listing.some(
        (entry) => entry === "package/scaffold-examples" || entry.startsWith("package/scaffold-examples/"),
      ),
    ).toBe(true);
  });

  it("exposes the workspace module surface without removed root names", async () => {
    const project = await mkdtemp(join(scratch, "workspace-"));
    const nodeModules = join(project, "node_modules");
    await mkdir(join(nodeModules, "@foxworth"), { recursive: true });
    await symlink(superimgPackage, join(nodeModules, "@foxworth", "superimg"));
    await symlink(cliPackage, join(nodeModules, "@foxworth", "superimg-cli"));
    await symlink(interactionsPackage, join(nodeModules, "@foxworth", "superimg-interactions"));
    await writeFile(join(project, "package.json"), JSON.stringify({ private: true, type: "module" }));
    const probe = join(project, "probe.mjs");
    await writeFile(
      probe,
      `
        const removed = ${JSON.stringify(REMOVED_ROOT_EXPORTS)};
        const root = await import("@foxworth/superimg");
        const present = removed.filter((name) => name in root);
        const kept = {};
        for (const name of ["compose", "preparedNarrationAudio", "h", "video", "isMediaElement"]) {
          kept[name] = typeof root[name];
        }
        let interactionsCode = null;
        try {
          await import("@foxworth/superimg/interactions");
          interactionsCode = "resolved";
        } catch (error) {
          interactionsCode = error && error.code ? error.code : String(error);
        }
        let oldCli;
        try { await import("@foxworth/superimg-cli/operations"); oldCli = "resolved"; }
        catch (error) { oldCli = error.code; }
        if (oldCli !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw new Error("old CLI entry is present");
        let oldForwarder;
        try { await import("@foxworth/superimg-cli/interactions"); oldForwarder = "resolved"; }
        catch (error) { oldForwarder = error.code; }
        if (oldForwarder !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw new Error("CLI interactions forwarder is present");
        const interactions = await import("@foxworth/superimg-interactions");
        if (Object.keys(interactions).some((name) => /Operation/.test(name))) throw new Error("old operation API is present");
        console.log(JSON.stringify({
          present,
          kept,
          interactionsCode,
          mount: typeof interactions.createNodeMediaInteractionMount,
        }));
      `,
    );
    const result = await run("node", [probe], project);
    report.workspaceSurface = { code: result.code, stdout: result.stdout, stderr: result.stderr };
    expect(result.code, result.stderr).toBe(0);
    const observed = JSON.parse(result.stdout) as {
      present: string[];
      kept: Record<string, string>;
      interactionsCode: string;
      mount: string;
    };
    expect(observed.present).toEqual([]);
    expect(observed.kept).toEqual({
      compose: "function",
      preparedNarrationAudio: "function",
      h: "function",
      video: "function",
      isMediaElement: "function",
    });
    expect(observed.interactionsCode).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");
    expect(observed.mount).toBe("function");
  });

  it("rejects a removed-symbol template the way a packed install does", async () => {
    const project = await mkdtemp(join(scratch, "template-"));
    await mkdir(join(project, "node_modules"), { recursive: true });
    await mkdir(join(project, "node_modules", "@foxworth"), { recursive: true });
    await cp(packedSuperimg.packageDir, join(project, "node_modules", "@foxworth", "superimg"), {
      recursive: true,
      dereference: true,
    });
    await writeFile(join(project, "package.json"), JSON.stringify({ private: true, type: "module" }));
    const bad = join(project, "bad.media.ts");
    const good = join(project, "good.media.ts");
    await writeFile(
      bad,
      `import { video, lower } from "@foxworth/superimg";
export default video({ duration: "1s", render: () => (lower as unknown as () => never)() });
`,
    );
    await writeFile(
      good,
      `import { video, Text } from "@foxworth/superimg";
export default video({
  duration: "1s",
  render: () => Text({ variant: "body", fill: "#f4f1ea", width: "fill", height: "fill" }, "ok"),
});
`,
    );

    const goodResult = await run("node", [monorepoCli, "check", good, "--json"], project);
    const badResult = await run("node", [monorepoCli, "check", bad, "--json"], project);
    const badOutput = `${badResult.stdout}\n${badResult.stderr}`;
    const missingExport =
      /does not provide an export named ['"]lower['"]/i.test(badOutput) ||
      /missing export[^\n]*\blower\b/i.test(badOutput) ||
      /\blower\b[^\n]*not exported/i.test(badOutput) ||
      /export named ['"]lower['"]/i.test(badOutput);
    await writeFile(
      "/tmp/package-surface-check.json",
      JSON.stringify({
        good: { code: goodResult.code, stdout: goodResult.stdout, stderr: goodResult.stderr },
        bad: { code: badResult.code, stdout: badResult.stdout, stderr: badResult.stderr },
      }),
    );

    expect(goodResult.code, `good stdout:\n${goodResult.stdout}\ngood stderr:\n${goodResult.stderr}`).toBe(0);
    if (badResult.code === 0 || !missingExport) {
      const resolved = await bundledSuperimgResolution(project);
      expect.fail(
        `bad template did not fail as a missing \`lower\` export (exit ${badResult.code}).\n` +
          `${resolved}\n` +
          `stdout:\n${badResult.stdout}\nstderr:\n${badResult.stderr}`,
      );
    }
  });

  it("imports the packed interactions package without a network install", async () => {
    const project = await mkdtemp(join(scratch, "host-"));
    const nodeModules = join(project, "node_modules");
    await mkdir(join(nodeModules, "@foxworth"), { recursive: true });
    const linked = await provisionPackedPackages(nodeModules);
    await writeFile(join(project, "package.json"), JSON.stringify({ private: true, type: "module" }));
    const bin = join(nodeModules, "@foxworth", "superimg-cli", "dist", "cli.js");
    const importResult = await run(
      "node",
      [
        "-e",
        `import("@foxworth/superimg-interactions").then((mod) => {
          if (typeof mod.createNodeMediaInteractionMount !== "function") {
            console.error("typeof=" + typeof mod.createNodeMediaInteractionMount);
            process.exit(1);
          }
          console.log("function");
        }).catch((error) => {
          console.error(error);
          process.exit(1);
        });`,
      ],
      project,
    );
    const version = await run("node", [bin, "--version"], project);
    report.interactionsHost = {
      linked,
      binIsFile: (await stat(bin)).isFile(),
      importCode: importResult.code,
      importStdout: importResult.stdout,
      importStderr: importResult.stderr,
      versionCode: version.code,
      versionStdout: version.stdout,
      versionStderr: version.stderr,
    };

    expect(importResult.code, importResult.stderr).toBe(0);
    expect(importResult.stdout.trim()).toBe("function");
    expect((await stat(bin)).isFile()).toBe(true);
    expect(version.code, version.stderr).toBe(0);
  });
});
