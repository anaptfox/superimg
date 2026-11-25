import { execFile as execFileCallback, spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { chromium } from "playwright";
import sharp from "sharp";

const execFile = promisify(execFileCallback);
const archiveDirectory = process.env.SUPERIMG_ONBOARDING_PACKED_DIR;
const installed = archiveDirectory ? it : it.skip;
const npmCache = join(tmpdir(), "superimg-installed-topology-npm-cache");

async function archives(): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const name of await readdir(archiveDirectory!)) {
    if (!name.endsWith(".tgz")) continue;
    const path = join(archiveDirectory!, name);
    const { stdout } = await execFile("tar", ["-xOf", path, "package/package.json"]);
    found[JSON.parse(stdout).name] = path;
  }
  for (const name of ["@foxworth/superimg", "@foxworth/superimg-cli", "@foxworth/boundary"]) {
    expect(found[name], `Missing packed ${name}`).toBeTruthy();
  }
  return found;
}

async function command(cli: string, args: string[], cwd: string): Promise<string> {
  const result = await execFile(process.execPath, [cli, ...args], {
    cwd, env: { ...process.env, CI: "1", NODE_PATH: "", NODE_OPTIONS: "" },
    timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
  });
  return result.stdout;
}

async function install(project: string, packed: Record<string, string>): Promise<void> {
  const path = join(project, "package.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  manifest.dependencies = { ...manifest.dependencies, "@foxworth/superimg": packed["@foxworth/superimg"], "@foxworth/boundary": packed["@foxworth/boundary"] };
  manifest.devDependencies = { ...manifest.devDependencies, "@foxworth/superimg-cli": packed["@foxworth/superimg-cli"] };
  await writeFile(path, JSON.stringify(manifest, null, 2));
  await execFile("npm", ["install", "--no-audit", "--no-fund", "--prefer-offline", "--cache", npmCache], {
    cwd: project, timeout: 240_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, NODE_PATH: "", NODE_OPTIONS: "" },
  });
  for (const name of ["superimg", "superimg-cli"]) {
    expect((await lstat(join(project, "node_modules", "@foxworth", name))).isSymbolicLink()).toBe(false);
  }
}

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing loopback address");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function nativeAcceptance(project: string): Promise<void> {
  const cli = join(project, "node_modules", "@foxworth", "superimg-cli", "dist", "cli.js");
  const source = join(project, "media", "native-card.media.ts");
  const elsewhere = join(project, "unrelated-cwd");
  await mkdir(elsewhere);
  await command(cli, ["new", "native-card", "--dir", "media", "--example", "og-card", "--yes"], project);
  await writeFile(join(project, "_config.ts"), "export default { outputs: { image: ['320x180.png'] } };\n");
  expect(JSON.parse(await command(cli, ["check", source, "--json"], elsewhere))).toBeTruthy();

  const port = await unusedPort();
  const child = spawn(process.execPath, [cli, "dev", source, "--no-open", "--port", String(port)], {
    cwd: elsewhere, env: { ...process.env, CI: "1", NODE_PATH: "", NODE_OPTIONS: "" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let previewOutput = "";
  child.stdout.on("data", (data) => { previewOutput += String(data); });
  child.stderr.on("data", (data) => { previewOutput += String(data); });
  const browser = await chromium.launch({ headless: true });
  try {
    const origin = `http://127.0.0.1:${port}`;
    await expect.poll(async () => {
      if (child.exitCode !== null) throw new Error(`Installed preview exited: ${previewOutput}`);
      return fetch(`${origin}/api/config`).then((response) => response.status).catch(() => 0);
    }, { timeout: 30_000 }).toBe(200);
    const config = await fetch(`${origin}/api/config`).then((response) => response.json());
    expect(config).toMatchObject({ previewKind: "media", mediaKind: "image", width: 1200, height: 630 });
    const url = previewOutput.match(/running at (https?:\/\/\S+)/i)?.[1];
    expect(url, previewOutput).toBeTruthy();
    const page = await browser.newPage();
    await page.goto(`${origin}${new URL(url!).search}`);
    await expect.poll(async () => page.evaluate(async () => {
      if (!window.superimgInspection) return undefined;
      return (await window.superimgInspection.inspect({ surfaceId: "dev-preview" })).compilation?.status;
    }), { timeout: 30_000 }).toBe("succeeded");
    await expect.poll(async () => page.locator("iframe").count()).toBeGreaterThan(0);
  } finally {
    await browser.close();
    if (child.exitCode === null) {
      const closed = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      child.kill("SIGTERM");
      await Promise.race([closed, new Promise<void>((resolve) => setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 5_000))]);
    }
  }

  await command(cli, ["export", source, "--for", "320x180.png", "--json"], elsewhere);
  const output = join(project, "output", "media", "native-card.export");
  const paths = await readdir(output, { recursive: true });
  const png = paths.find((path) => path.endsWith(".png"));
  expect(png).toBeTruthy();
  expect(await sharp(await readFile(join(output, png!))).metadata()).toMatchObject({ width: 320, height: 180, format: "png" });
  await expect(lstat(join(elsewhere, "output"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(lstat(join(project, "media", "package.json"))).rejects.toMatchObject({ code: "ENOENT" });
}

installed("qualifies native preview and output ownership in installed root and standalone packages", { timeout: 600_000 }, async () => {
  const scratch = await mkdtemp(join(tmpdir(), "superimg-installed-topology-"));
  try {
    const packed = await archives();
    const root = join(scratch, "existing-app");
    await mkdir(root);
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "existing-app", private: true, type: "module", scripts: { dev: "app-dev", build: "app-build" } }));
    await install(root, packed);
    const cli = join(root, "node_modules", "@foxworth", "superimg-cli", "dist", "cli.js");
    await command(cli, ["init", ".", "--skip-install", "--skip-skill", "--yes"], root);
    expect(JSON.parse(await readFile(join(root, "package.json"), "utf8")).scripts).toMatchObject({ dev: "app-dev", build: "app-build", "media:dev": "superimg dev" });
    await nativeAcceptance(root);

    await command(cli, ["init", "standalone", "--skip-install", "--skip-skill", "--yes"], scratch);
    const standalone = join(scratch, "standalone");
    await install(standalone, packed);
    await nativeAcceptance(standalone);
    await expect(lstat(join(scratch, "package.json"))).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
