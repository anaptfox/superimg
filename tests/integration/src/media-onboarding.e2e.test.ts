import { execFile as execFileCb, spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { chromium } from "playwright";

const execFile = promisify(execFileCb);
const here = new URL(".", import.meta.url);
const repoRoot = fileURLToPath(new URL("../../..", here));
const cli = join(repoRoot, "packages", "superimg-cli", "dist", "cli.js");
const timeout = 120_000;

type Result = { code: number | null; stdout: string; stderr: string };

async function run(args: string[], cwd: string): Promise<Result> {
  return runEntry(cli, args, cwd);
}

async function runEntry(entry: string, args: string[], cwd: string, cleanEnv = false): Promise<Result> {
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env, CI: "1", npm_config_user_agent: "npm/10.0.0" };
    if (cleanEnv) {
      delete env.NODE_PATH;
      delete env.NODE_OPTIONS;
      delete env.SUPERIMG_EXAMPLES_ROOT;
      env.npm_config_cache = join(cwd, "..", "npm-cache");
    }
    const child = spawn(process.execPath, [entry, ...args], {
      cwd,
      env,
      timeout: 60_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({
      code,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    }));
  });
}

async function findPackedPackages(directory: string): Promise<Record<string, string>> {
  const archives = (await readdir(directory)).filter((name) => name.endsWith(".tgz"));
  const packages: Record<string, string> = {};
  for (const archive of archives) {
    const path = join(directory, archive);
    const { stdout } = await execFile("tar", ["-xOf", path, "package/package.json"], { maxBuffer: 4 * 1024 * 1024 });
    const manifest = JSON.parse(stdout) as { name?: string };
    if (manifest.name) packages[manifest.name] = path;
  }
  return packages;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function copiedMedia(directory: string): Promise<{ path: string; source: string }> {
  const files = (await readdir(directory)).filter((name) => /^hello-world\.media\.(ts|js)$/.test(name));
  if (files.length !== 1) throw new Error(`Expected one copied hello-world module in ${directory}, found ${files.join(", ") || "none"}`);
  const path = join(directory, files[0]!);
  return { path, source: await readFile(path, "utf8") };
}

function expectHelloMedia(source: string): void {
  expect(source).toMatch(/\bvideo\s*\(/);
  expect(source).toMatch(/Hello, (?:world|SuperImg)/);
}

async function writeMedia(path: string, label: string): Promise<void> {
  await mkdir(join(path, "media"), { recursive: true });
  await writeFile(join(path, "media", `${label}.media.ts`), `// ${label}\n`);
}

function namesFromList(result: Result): string[] {
  if (result.code !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
  const parsed = JSON.parse(result.stdout) as { media?: Array<{ relativePath?: string; name?: string; path?: string }> } | Array<string | { relativePath?: string; name?: string; path?: string }>;
  const entries = Array.isArray(parsed) ? parsed : parsed.media ?? [];
  return entries.map((entry) => typeof entry === "string" ? entry : entry.relativePath ?? entry.name ?? entry.path ?? "").filter(Boolean);
}

describe("media onboarding CLI", { timeout, hookTimeout: timeout }, () => {
  let scratch = "";

  beforeAll(async () => {
    scratch = await mkdtemp(join(tmpdir(), "superimg-media-onboarding-"));
  }, timeout);

  afterAll(async () => {
    if (scratch) await rm(scratch, { recursive: true, force: true });
  }, timeout);

  it("integrates an existing root package, preserves app ownership, and is repeat safe", async () => {
    const root = join(scratch, "existing-root");
    await mkdir(root, { recursive: true });
    await writeJson(join(root, "package.json"), {
      name: "existing-app",
      private: true,
      scripts: { dev: "vite --host", build: "vite build", version: "changeset version", "media:dev": "custom-preview" },
      dependencies: { vite: "6.0.0", "@foxworth/superimg": "0.9.0" },
      devDependencies: { typescript: "5.7.0" },
    });
    const lock = "lockfileVersion: '9.0'\nimporters:\n  .:\n    name: existing-app\n";
    await writeFile(join(root, "pnpm-lock.yaml"), lock);
    const first = await run(["init", ".", "--dir", "media/brand", "--yes", "--pm", "pnpm", "--skip-install", "--skip-skill"], root);
    expect(first.code, `${first.stdout}\n${first.stderr}`).toBe(0);

    const manifest = await readJson<{ scripts: Record<string, string>; dependencies: Record<string, string>; devDependencies: Record<string, string> }>(join(root, "package.json"));
    expect(manifest.scripts).toMatchObject({ dev: "vite --host", build: "vite build", version: "changeset version", "media:dev": "custom-preview", "media:list": "superimg list" });
    expect(manifest.dependencies).toMatchObject({ vite: "6.0.0", "@foxworth/superimg": "0.9.0" });
    expect(manifest.devDependencies).toMatchObject({ typescript: "5.7.0", "@foxworth/superimg-cli": "0.9.0" });
    expect(await readFile(join(root, "pnpm-lock.yaml"), "utf8")).toBe(lock);
    const initialCopy = await copiedMedia(join(root, "media", "brand"));
    expectHelloMedia(initialCopy.source);
    const userEdit = "// user edit survives repeat init\n";
    await writeFile(initialCopy.path, userEdit);
    await expect(readFile(join(root, "media", "brand", "package.json"))).rejects.toMatchObject({ code: "ENOENT" });

    const second = await run(["init", ".", "--dir", "media/brand", "--yes", "--pm", "pnpm", "--skip-install", "--skip-skill"], join(root, "media/brand"));
    expect(second.code, `${second.stdout}\n${second.stderr}`).toBe(0);
    expect(await readFile(initialCopy.path, "utf8")).toBe(userEdit);
    expect(await readFile(join(root, "pnpm-lock.yaml"), "utf8")).toBe(lock);
    const repeated = await readJson<{ scripts: Record<string, string>; dependencies: Record<string, string> }>(join(root, "package.json"));
    expect(repeated.scripts["media:dev"]).toBe("custom-preview");
    expect(repeated.scripts["media:list"]).toBe("superimg list");
  });

  it("keeps an intentional standalone project as its own package", async () => {
    const parent = join(scratch, "standalone-parent");
    await mkdir(parent, { recursive: true });
    await writeJson(join(parent, "package.json"), { name: "host", private: true, scripts: { dev: "host-dev" } });
    const result = await run(["init", "independent-media", "--yes", "--pm", "npm", "--skip-install", "--skip-skill"], parent);
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    const project = join(parent, "independent-media");
    const manifest = await readJson<{ name: string; scripts: Record<string, string>; dependencies: Record<string, string> }>(join(project, "package.json"));
    expect(manifest.name).toBe("independent-media");
    expect(manifest.scripts).toMatchObject({ "media:dev": "superimg dev", "media:list": "superimg list" });
    expect(manifest.scripts).not.toHaveProperty("check");
    expect(manifest.scripts).not.toHaveProperty("export");
    expect(manifest.dependencies).toHaveProperty("@foxworth/superimg");
    expectHelloMedia((await copiedMedia(join(project, "media"))).source);
    expect(await readFile(join(parent, "package.json"), "utf8")).toContain("host-dev");
  });

  it("defaults to media/ even when videos/ already exists", async () => {
    const root = join(scratch, "existing-videos");
    await mkdir(join(root, "videos"), { recursive: true });
    await writeJson(join(root, "package.json"), { name: "video-app", private: true, scripts: { dev: "app-dev" } });
    await writeFile(join(root, "videos", "existing.media.ts"), "// keep existing source\n");
    const result = await run(["init", ".", "--yes", "--pm", "npm", "--skip-install", "--skip-skill"], root);
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expectHelloMedia((await copiedMedia(join(root, "media"))).source);
    expect(await readdir(join(root, "videos"))).toEqual(["existing.media.ts"]);
    expect(await readFile(join(root, "videos", "existing.media.ts"), "utf8")).toBe("// keep existing source\n");
  });

  it("uses the selected workspace media package and leaves workspace manager files intact", async () => {
    const workspace = join(scratch, "workspace");
    const media = join(workspace, "packages", "media");
    await mkdir(media, { recursive: true });
    await writeJson(join(workspace, "package.json"), { name: "team", private: true, packageManager: "pnpm@10.0.0", scripts: { dev: "turbo dev" } });
    await writeFile(join(workspace, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    await writeFile(join(workspace, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  packages/media: {}\n");
    const lockBefore = await readFile(join(workspace, "pnpm-lock.yaml"));
    await writeJson(join(media, "package.json"), { name: "@team/media", private: true, type: "module", scripts: { check: "tsc --noEmit" }, dependencies: { "@team/design": "workspace:*" } });
    const result = await run(["init", ".", "--dir", ".", "--yes", "--skip-install", "--skip-skill"], media);
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("pnpm exec superimg");
    const manifest = await readJson<{ scripts: Record<string, string>; dependencies: Record<string, string>; devDependencies: Record<string, string> }>(join(media, "package.json"));
    expect(manifest.scripts).toMatchObject({ check: "tsc --noEmit", "media:dev": "superimg dev", "media:list": "superimg list" });
    expect(manifest.dependencies).toMatchObject({ "@team/design": "workspace:*", "@foxworth/superimg": expect.any(String) });
    expect(manifest.devDependencies).toHaveProperty("@foxworth/superimg-cli");
    expect(await readFile(join(workspace, "pnpm-lock.yaml"))).toEqual(lockBefore);
    expectHelloMedia((await copiedMedia(media)).source);
    await expect(readFile(join(media, "package.json"))).resolves.toBeTruthy();
    await expect(readFile(join(media, "media", "package.json"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(workspace, "packages", "media", "package.json"))).resolves.toBeTruthy();
  });

  it("discovers from the nearest package and stops at nested package boundaries", async () => {
    const root = join(scratch, "discovery-root");
    const child = join(root, "packages", "media");
    const nested = join(child, "studies", "standalone");
    await mkdir(nested, { recursive: true });
    await writeJson(join(root, "package.json"), { name: "workspace", private: true, workspaces: ["packages/*"] });
    await writeJson(join(child, "package.json"), { name: "@team/media", private: true });
    await writeJson(join(nested, "package.json"), { name: "standalone", private: true });
    await writeMedia(root, "root-campaign");
    await writeMedia(child, "shared-library");
    await mkdir(join(child, "campaigns"), { recursive: true });
    await writeFile(join(child, "campaigns", "spring.media.ts"), "// spring\n");
    await writeMedia(nested, "private-study");

    const fromRoot = namesFromList(await run(["list", "--shallow", "--json"], root));
    const fromPackage = namesFromList(await run(["list", "--shallow", "--json"], child));
    const fromPackageSubdir = namesFromList(await run(["list", "--shallow", "--json"], join(child, "campaigns")));
    const fromNested = namesFromList(await run(["list", "--shallow", "--json"], nested));
    expect(fromRoot).toEqual(["media/root-campaign.media.ts"]);
    expect(fromPackage).toEqual(["campaigns/spring.media.ts", "media/shared-library.media.ts"]);
    expect(fromPackageSubdir).toEqual(fromPackage);
    expect(fromNested).toEqual(["media/private-study.media.ts"]);
  });

  const packedLane = process.env.SUPERIMG_ONBOARDING_PACKED_DIR ? it : it.skip;
  packedLane("installs packed packages in a clean consumer and onboards with the installed CLI", async () => {
    const artifactDir = process.env.SUPERIMG_ONBOARDING_PACKED_DIR!;
    const packed = await findPackedPackages(artifactDir);
    for (const name of ["@foxworth/superimg", "@foxworth/superimg-cli", "@foxworth/superimg-interactions", "@foxworth/superimg-node", "@foxworth/boundary"]) {
      expect(packed[name], `Missing ${name} tarball in ${artifactDir}`).toBeTruthy();
    }

    const project = join(scratch, "packed-consumer");
    await mkdir(project, { recursive: true });
    await writeJson(join(project, "package.json"), {
      name: "packed-consumer",
      private: true,
      scripts: { dev: "consumer-dev", build: "consumer-build", version: "consumer-version" },
      dependencies: { "@foxworth/superimg": packed["@foxworth/superimg"], "@foxworth/boundary": packed["@foxworth/boundary"] },
      devDependencies: {
        "@foxworth/superimg-cli": packed["@foxworth/superimg-cli"],
        "@foxworth/superimg-interactions": packed["@foxworth/superimg-interactions"],
        "@foxworth/superimg-node": packed["@foxworth/superimg-node"],
      },
    });
    const cache = join(scratch, "npm-cache");
    await execFile("npm", ["install", "--prefix", project, "--no-audit", "--no-fund", "--cache", cache], {
      env: { ...process.env, NODE_PATH: "", npm_config_audit: "false", npm_config_fund: "false" },
      maxBuffer: 20 * 1024 * 1024,
      timeout: 240_000,
    });
    const installedManifest = await readJson<{
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    }>(join(project, "package.json"));

    const installedCli = join(project, "node_modules", "@foxworth", "superimg-cli", "dist", "cli.js");
    expect((await lstat(join(project, "node_modules", "@foxworth", "superimg"))).isSymbolicLink()).toBe(false);
    expect((await lstat(join(project, "node_modules", "@foxworth", "superimg-cli"))).isSymbolicLink()).toBe(false);
    const init = await runEntry(installedCli, ["init", ".", "--yes", "--skip-browser", "--skip-skill"], project, true);
    expect(init.code, `${init.stdout}\n${init.stderr}`).toBe(0);
    const manifest = await readJson<{
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    }>(join(project, "package.json"));
    expect(manifest.scripts).toMatchObject({ dev: "consumer-dev", build: "consumer-build", version: "consumer-version", "media:dev": "superimg dev", "media:list": "superimg list" });
    expect(manifest.dependencies).toEqual(installedManifest.dependencies);
    expect(manifest.devDependencies).toEqual(installedManifest.devDependencies);
    expect(manifest.dependencies).toHaveProperty("@foxworth/superimg");
    expect(manifest.dependencies).toHaveProperty("@foxworth/boundary");
    expect(manifest.devDependencies).toHaveProperty("@foxworth/superimg-cli");
    const copied = await copiedMedia(join(project, "media"));
    expectHelloMedia(copied.source);
    await expect(readFile(join(project, "media", "package.json"))).rejects.toMatchObject({ code: "ENOENT" });

    const checked = await runEntry(installedCli, ["check", copied.path, "--json"], project, true);
    expect(checked.code, `${checked.stdout}\n${checked.stderr}`).toBe(0);
    const still = await runEntry(installedCli, ["new", "card", "--dir", "media/brand", "--example", "og-card", "--yes"], project, true);
    expect(still.code, `${still.stdout}\n${still.stderr}`).toBe(0);
    const stillCheck = await runEntry(installedCli, ["check", "media/brand/card.media.ts", "--json"], project, true);
    expect(stillCheck.code, `${stillCheck.stdout}\n${stillCheck.stderr}`).toBe(0);

    const sessionSmokePath = join(project, ".interaction-session-smoke.mjs");
    await writeFile(sessionSmokePath, `
      import { createNodeMediaInteractionSession, MEDIA_INTERACTION_IDS } from "@foxworth/superimg-interactions";

      const session = await createNodeMediaInteractionSession({ projectRoot: process.cwd() });
      try {
        const checked = await session.mount.dispatch({
          interactionId: MEDIA_INTERACTION_IDS.check,
          input: { source: "media/hello-world" },
        }, {});
        const inspected = await session.mount.dispatch({
          interactionId: MEDIA_INTERACTION_IDS.inspect,
          input: { source: "media/hello-world" },
        }, {});
        await session.dispose();
        let disposed = false;
        try {
          await session.mount.dispatch({
            interactionId: MEDIA_INTERACTION_IDS.check,
            input: { source: "media/hello-world" },
          }, {});
        } catch (error) {
          disposed = /disposed/i.test(error instanceof Error ? error.message : String(error));
        }
        if (!disposed) throw new Error("Session runtime remained usable after disposal");
        console.log(JSON.stringify({ checked, inspected, disposed }));
      } finally {
        await session.dispose();
      }
    `);
    const sessionSmoke = await runEntry(sessionSmokePath, [], project, true);
    expect(sessionSmoke.code, `${sessionSmoke.stdout}\n${sessionSmoke.stderr}`).toBe(0);
    const sessionResult = JSON.parse(sessionSmoke.stdout) as {
      checked: { sourceId: string; relativePath: string; report: { ok: boolean; kind: string } };
      inspected: { sourceId: string; relativePath: string; report: { kind: string } };
      disposed: boolean;
    };
    expect(sessionResult.checked).toMatchObject({
      sourceId: "media/hello-world",
      relativePath: "media/hello-world.media.js",
      report: { ok: true, kind: "video" },
    });
    expect(sessionResult.inspected).toMatchObject({
      sourceId: "media/hello-world",
      relativePath: "media/hello-world.media.js",
      report: { kind: "video" },
    });
    expect(sessionResult.disposed).toBe(true);
  }, 300_000);

  const pnpmExecutable = process.env.SUPERIMG_ONBOARDING_PNPM_EXECUTABLE;
  const packedWorkspaceLane = process.env.SUPERIMG_ONBOARDING_PACKED_DIR && pnpmExecutable ? it : it.skip;
  packedWorkspaceLane("onboards a selected package in a packed pnpm workspace without hoisting assumptions", async () => {
    const artifactDir = process.env.SUPERIMG_ONBOARDING_PACKED_DIR!;
    const pnpm = pnpmExecutable!;
    const packed = await findPackedPackages(artifactDir);
    for (const name of ["@foxworth/superimg", "@foxworth/superimg-cli", "@foxworth/boundary"]) {
      expect(packed[name], `Missing ${name} tarball in ${artifactDir}`).toBeTruthy();
    }
    const { stdout: pnpmVersion } = await execFile(pnpm, ["--version"], { timeout: 60_000 });
    const version = pnpmVersion.trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);

    const workspace = join(scratch, "packed-pnpm-workspace");
    const media = join(workspace, "packages", "media");
    const app = join(workspace, "apps", "consumer");
    const store = join(scratch, "pnpm-store");
    await mkdir(media, { recursive: true });
    await mkdir(app, { recursive: true });
    await writeJson(join(workspace, "package.json"), {
      name: "packed-team",
      private: true,
      packageManager: `pnpm@${version}`,
      scripts: { dev: "team-dev", build: "team-build", version: "team-version" },
    });
    await writeFile(join(workspace, "pnpm-workspace.yaml"),
      "packages:\n  - apps/*\n  - packages/*\nhoist: false\n" +
      `storeDir: ${JSON.stringify(store)}\ncacheDir: ${JSON.stringify(join(scratch, "pnpm-cache"))}\noverrides:\n` +
      `  "@foxworth/boundary": ${JSON.stringify(`file:${packed["@foxworth/boundary"]}`)}\n`);
    await writeJson(join(media, "package.json"), {
      name: "@team/media",
      version: "1.0.0",
      private: true,
      type: "module",
      exports: { ".": "./hello-world.media.js" },
      scripts: { check: "superimg check hello-world.media.js" },
      dependencies: {
        "@foxworth/superimg": packed["@foxworth/superimg"],
        "@foxworth/boundary": packed["@foxworth/boundary"],
      },
      devDependencies: { "@foxworth/superimg-cli": packed["@foxworth/superimg-cli"] },
    });
    await writeJson(join(app, "package.json"), {
      name: "@team/consumer",
      private: true,
      type: "module",
      dependencies: { "@team/media": "workspace:*" },
    });
    const env: NodeJS.ProcessEnv = { ...process.env, npm_config_cache: join(scratch, "pnpm-cache") };
    env.PATH = `${dirname(pnpm)}${delimiter}${env.PATH ?? ""}`;
    delete env.NODE_PATH;
    delete env.NODE_OPTIONS;
    delete env.SUPERIMG_EXAMPLES_ROOT;

    await execFile(pnpm, ["install", "--store-dir", store, "--ignore-scripts", "--reporter", "append-only"], {
      cwd: workspace,
      env,
      maxBuffer: 20 * 1024 * 1024,
      timeout: 240_000,
    }).catch((error: Error & { stdout?: string; stderr?: string }) => {
      throw new Error(`${error.message}\n${error.stdout ?? ""}\n${error.stderr ?? ""}`);
    });
    const lockPath = join(workspace, "pnpm-lock.yaml");
    const lockAfterInstall = await readFile(lockPath);
    const rootManifestBeforeInit = await readFile(join(workspace, "package.json"));
    const installedMediaManifest = await readJson<{
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      exports: Record<string, string>;
    }>(join(media, "package.json"));

    // Both the first install and the initializer's manifest-driven install use
    // this exact executable and the workspace's shared lockfile.
    const init = await execFile(pnpm, ["--dir", media, "exec", "superimg", "init", ".", "--dir", ".", "--yes", "--skip-browser", "--skip-skill"], {
      cwd: workspace,
      env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 120_000,
    }).catch((error: Error & { stdout?: string; stderr?: string }) => {
      throw new Error(`${error.message}\n${error.stdout ?? ""}\n${error.stderr ?? ""}`);
    });
    expect(init.stdout).toContain("pnpm exec superimg");
    expect(await readFile(join(workspace, "package.json"))).toEqual(rootManifestBeforeInit);
    expect(await readFile(lockPath)).toEqual(lockAfterInstall);
    await expect(readFile(join(media, "pnpm-lock.yaml"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(app, "pnpm-lock.yaml"))).rejects.toMatchObject({ code: "ENOENT" });
    const mediaManifest = await readJson<{
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      exports: Record<string, string>;
    }>(join(media, "package.json"));
    expect(mediaManifest.scripts).toMatchObject({ check: "superimg check hello-world.media.js", "media:dev": "superimg dev", "media:list": "superimg list" });
    expect(mediaManifest.dependencies).toEqual(installedMediaManifest.dependencies);
    expect(mediaManifest.devDependencies).toEqual(installedMediaManifest.devDependencies);
    expect(mediaManifest.exports).toEqual(installedMediaManifest.exports);
    expect(mediaManifest.exports["."]).toBe("./hello-world.media.js");
    expectHelloMedia((await copiedMedia(media)).source);
    await expect(lstat(join(app, "node_modules", "@foxworth", "superimg"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(lstat(join(workspace, "node_modules", "@foxworth", "superimg"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(lstat(join(workspace, "node_modules", ".pnpm", "node_modules", "@foxworth", "superimg"))).rejects.toMatchObject({ code: "ENOENT" });

    const probe = join(app, "resolve-media.mjs");
    await writeFile(probe, `import media from "@team/media";\nif (media?.kind !== "media" || media.media !== "video" || typeof media.render !== "function") throw new Error("authored video export missing");\nconsole.log("workspace-media-resolved");\n`);
    const importResult = await execFile(pnpm, ["--dir", app, "exec", "node", probe], {
      cwd: workspace,
      env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 60_000,
    });
    expect(importResult.stdout.trim()).toBe("workspace-media-resolved");

    const checked = await execFile(pnpm, ["--filter", "@team/media", "exec", "superimg", "check", "hello-world.media.js", "--json"], {
      cwd: workspace,
      env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 120_000,
    });
    const report = JSON.parse(checked.stdout) as { ok: boolean; template: string; issues: { severity: string }[] };
    expect(report.ok).toBe(true);
    expect(report.template).toBe(await realpath(join(media, "hello-world.media.js")));
    expect(report.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);

    const { createServer } = await import("node:net");
    const portServer = createServer();
    await new Promise<void>((resolve, reject) => { portServer.once("error", reject); portServer.listen(0, "127.0.0.1", resolve); });
    const address = portServer.address();
    if (!address || typeof address === "string") throw new Error("Expected a loopback port");
    await new Promise<void>((resolve, reject) => portServer.close((error) => error ? reject(error) : resolve()));
    const port = address.port;
    const dev = spawn(process.execPath, [pnpm, "--filter", "@team/media", "exec", "superimg", "dev", "hello-world.media.js", "--no-open", "--port", String(port)], {
      cwd: app,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let devOutput = "";
    dev.stdout?.on("data", (chunk) => { devOutput += String(chunk); });
    dev.stderr?.on("data", (chunk) => { devOutput += String(chunk); });
    const origin = `http://127.0.0.1:${port}`;
    let config: { previewKind?: string; mediaKind?: string } | undefined;
    const deadline = Date.now() + 45_000;
    try {
      while (Date.now() < deadline) {
        if (dev.exitCode !== null) throw new Error(`Workspace installed preview exited: ${devOutput}`);
        let response: Response;
        try { response = await fetch(`${origin}/api/config`); }
        catch { await new Promise((resolve) => setTimeout(resolve, 200)); continue; }
        if (response.status >= 500) throw new Error(`Workspace preview /api/config returned ${response.status}: ${await response.text()}\n${devOutput}`);
        if (response.ok) { config = await response.json() as typeof config; break; }
      }
      expect(config).toMatchObject({ previewKind: "media", mediaKind: "video" });
      const selectedPreviewUrl = devOutput.match(/running at (https?:\/\/\S+)/i)?.[1];
      expect(selectedPreviewUrl, devOutput).toBeTruthy();
      const page = await (await chromium.launch({ headless: true })).newPage({ viewport: { width: 1280, height: 900 } });
      const browserErrors: string[] = [];
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("requestfailed", (request) => browserErrors.push(`${request.url()}: ${request.failure()?.errorText ?? "request failed"}`));
      try {
        await page.goto(`${origin}${new URL(selectedPreviewUrl!).search}`);
        await expect.poll(async () => page.locator(".si-deck").count(), { timeout: 30_000 }).toBeGreaterThan(0);
        await expect.poll(async () => page.evaluate(() => Boolean(window.superimgInspection)), { timeout: 30_000, message: JSON.stringify({ browserErrors, devOutput, html: await page.locator("body").innerHTML() }) }).toBe(true);
        const inspection = await page.evaluate(async () => await window.superimgInspection.inspect({ surfaceId: "dev-preview" }));
        expect(inspection.compilation?.status, JSON.stringify({ inspection, browserErrors, devOutput })).toBe("succeeded");
      } finally {
        await page.context().browser()?.close();
      }
    } finally {
      dev.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        if (dev.exitCode !== null) return resolve();
        const timer = setTimeout(() => { dev.kill("SIGKILL"); resolve(); }, 5_000);
        dev.once("exit", () => { clearTimeout(timer); resolve(); });
      });
    }

    const exported = await execFile(pnpm, ["--filter", "@team/media", "exec", "superimg", "export", "hello-world.media.js", "--for", "320x180.png", "--at", "0.5s", "--json"], {
      cwd: app,
      env,
      maxBuffer: 12 * 1024 * 1024,
      timeout: 180_000,
    }).catch((error: Error & { stdout?: string; stderr?: string }) => {
      throw new Error(`${error.message}\n${error.stdout ?? ""}\n${error.stderr ?? ""}`);
    });
    expect(exported.stdout).toContain("320x180.png");
    const workspaceArtifacts = await readdir(join(media, "output"), { recursive: true });
    const exportedPng = workspaceArtifacts.find((name) => String(name).endsWith(".png"));
    expect(exportedPng, `No workspace-owned PNG artifact found under ${join(media, "output")}`).toBeTruthy();
    const decoded = await sharp(await readFile(join(media, "output", String(exportedPng)))).metadata();
    expect(decoded).toMatchObject({ width: 320, height: 180, format: "png" });
    await expect(readdir(join(workspace, "output"))).rejects.toMatchObject({ code: "ENOENT" });
  }, 360_000);
});
