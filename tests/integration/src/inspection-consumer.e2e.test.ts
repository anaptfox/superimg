import { execFile as execFileCallback } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const publicPackage = join(repoRoot, "packages", "superimg");
const typecheck = join(repoRoot, "scripts", "typecheck-native.mjs");
const packageRequire = createRequire(join(publicPackage, "package.json"));
const integrationRequire = createRequire(join(repoRoot, "tests", "integration", "package.json"));
const timeout = 120_000;

interface Packed {
  directory: string;
  files: string[];
  manifest: {
    name: string;
    version: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  };
}

let scratch = "";
let pureConsumer = "";
let sdkConsumer = "";
let packed: Packed;
let packedSdk: Packed;

function commandEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env, npm_config_ignore_scripts: "true", npm_config_audit: "false", npm_config_fund: "false" };
  // The consumer must resolve its own installed package, without ambient loaders.
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  return env;
}

async function run(cwd: string, args: string[]): Promise<string> {
  try {
    const result = await execFile(process.execPath, args, { cwd, env: commandEnv(), timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
    return result.stdout.trim();
  } catch (cause) {
    const output = cause as Error & { stdout?: string; stderr?: string };
    throw new Error([`Consumer command failed: ${args.join(" ")}`, output.stdout, output.stderr || output.message].filter(Boolean).join("\n"), { cause });
  }
}

async function pack(cwd: string, label: string, tool: "pnpm" | "npm"): Promise<Packed> {
  const destination = join(scratch, `${label}-pack`);
  await mkdir(destination);
  await execFile(tool, ["pack", "--pack-destination", destination], { cwd, env: commandEnv(), timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  const names = (await readdir(destination)).filter((name) => name.endsWith(".tgz"));
  expect(names).toHaveLength(1);
  const tarball = join(destination, names[0]!);
  const listed = await execFile("tar", ["-tzf", tarball]);
  const extract = join(destination, "extract");
  await mkdir(extract);
  await execFile("tar", ["-xzf", tarball, "-C", extract]);
  const directory = join(extract, "package");
  return { directory, files: listed.stdout.trim().split("\n"), manifest: JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as Packed["manifest"] };
}

async function resolvedPackageRoot(name: string, require: NodeJS.Require): Promise<string> {
  let entry: string;
  try { entry = require.resolve(name); }
  catch { entry = require.resolve(`${name}/package.json`); }
  let directory = dirname(await realpath(entry));
  while (true) {
    try {
      const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as { name?: string };
      if (manifest.name === name) return directory;
    } catch { /* The resolved entry can live below its package root. */ }
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Could not locate the resolved ${name} package`);
    directory = parent;
  }
}

async function consumer(label: string): Promise<string> {
  const directory = join(scratch, label);
  const installedPackage = join(directory, "node_modules", "@foxworth", "superimg");
  await mkdir(dirname(installedPackage), { recursive: true });
  await cp(packed.directory, installedPackage, { recursive: true, dereference: true });
  await writeFile(join(directory, "package.json"), JSON.stringify({ private: true, type: "module" }));
  return directory;
}

async function installTypeDependency(name: string, require: NodeJS.Require, directory: string, installed: Set<string>): Promise<void> {
  if (installed.has(name)) return;
  installed.add(name);
  const root = await resolvedPackageRoot(name, require);
  const artifact = await pack(root, name.replace(/[^a-z0-9]/gi, "-"), "npm");
  const target = join(directory, "node_modules", name);
  await mkdir(dirname(target), { recursive: true });
  await cp(artifact.directory, target, { recursive: true, dereference: true });
  for (const dependency of Object.keys(artifact.manifest.dependencies ?? {})) {
    await installTypeDependency(dependency, createRequire(join(root, "package.json")), directory, installed);
  }
}

async function checkTypes(directory: string, source: string): Promise<void> {
  await writeFile(join(directory, "consumer.ts"), source);
  await writeFile(join(directory, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", lib: ["ES2022", "DOM", "DOM.Iterable"], types: [], strict: true, exactOptionalPropertyTypes: true, skipLibCheck: false, noEmit: true },
    include: ["consumer.ts"],
  }));
  await run(directory, [typecheck, "--project", join(directory, "tsconfig.json")]);
}

describe("packed inspection consumers", { timeout, hookTimeout: timeout }, () => {
  beforeAll(async () => {
    scratch = await mkdtemp(join(tmpdir(), "superimg-inspection-consumer-"));
    packed = await pack(publicPackage, "foxworth-superimg", "pnpm");
    expect(packed.manifest.name).toBe("@foxworth/superimg");
    pureConsumer = await consumer("pure");
    // These are declared production type dependencies of @foxworth/superimg/player.
    const installedTypes = new Set<string>();
    for (const name of ["@types/d3-force", "@types/d3-scale"]) {
      expect(packed.manifest.dependencies?.[name]).toBeDefined();
      await installTypeDependency(name, packageRequire, pureConsumer, installedTypes);
    }
    const sdkRoot = await resolvedPackageRoot("@foxworth/boundary", integrationRequire);
    packedSdk = await pack(sdkRoot, "boundary", "npm");
    sdkConsumer = await consumer("sdk");
    // Install the normal SDK tarball once, without workspace or compatibility links.
    const sdkDirectory = join(sdkConsumer, "node_modules", "@foxworth", "boundary");
    await mkdir(dirname(sdkDirectory), { recursive: true });
    await cp(packedSdk.directory, sdkDirectory, { recursive: true, dereference: true });
    expect((await lstat(sdkDirectory)).isSymbolicLink()).toBe(false);
    // The SDK program entry eagerly re-exports its Zod adapter. Install that
    // normal optional peer artifact too, without borrowing ambient resolution.
    const sdkRequire = createRequire(join(sdkRoot, "package.json"));
    const zod = await pack(await resolvedPackageRoot("zod", sdkRequire), "zod", "npm");
    await cp(zod.directory, join(sdkConsumer, "node_modules", "zod"), { recursive: true, dereference: true });
  }, timeout);

  afterAll(async () => { if (scratch) await rm(scratch, { recursive: true, force: true }); }, timeout);

  it("imports and typechecks pure inspection without the optional Boundary SDK", async () => {
    expect(packed.manifest.peerDependencies?.["@foxworth/boundary"]).toBe("^0.2.0");
    expect(packed.manifest.peerDependenciesMeta?.["@foxworth/boundary"]?.optional).toBe(true);
    const source = `
      import { createRequire } from "node:module";
      import { createPreviewInspection, PreviewInspectionError } from "@foxworth/superimg/inspection";
      const require = createRequire(import.meta.url);
      let sdk = "missing";
      try { sdk = require.resolve("@foxworth/boundary"); } catch (error) { if (error.code !== "MODULE_NOT_FOUND") throw error; }
      const inspection = createPreviewInspection();
      let failure;
      try { await inspection.inspect({ surfaceId: "absent" }); }
      catch (error) { failure = { code: error.code, publicClass: error instanceof PreviewInspectionError }; }
      console.log(JSON.stringify({ sdk, surfaces: inspection.list(), failure }));
      inspection.dispose();
    `;
    await writeFile(join(pureConsumer, "pure.mjs"), source);
    expect(JSON.parse(await run(pureConsumer, ["pure.mjs"]))).toEqual({ sdk: "missing", surfaces: [], failure: { code: "UNKNOWN_SURFACE", publicClass: true } });
    await checkTypes(pureConsumer, `
      import { Player, createDomPlayer } from "@foxworth/superimg/player";
      import { createPreviewInspection, type PreviewSnapshot } from "@foxworth/superimg/inspection";
      const inspection = createPreviewInspection();
      inspection.attach({ surfaceId: "player", player: new Player({ container: document.createElement("div") }), controls: ["set-mode", "seek-frame"] });
      inspection.attach({ surfaceId: "dom", player: createDomPlayer({ container: document.createElement("div") }) });
      const snapshot: Promise<PreviewSnapshot> = inspection.inspect({ surfaceId: "player" });
      void snapshot;
    `);
  });

  it("typechecks the optional helper with the real SDK WebMCP adapter", async () => {
    expect(packedSdk.manifest.name).toBe("@foxworth/boundary");
    await checkTypes(sdkConsumer, `
      import { createPreviewInspection } from "@foxworth/superimg/inspection";
      import { createPreviewInteractionMount, type PreviewInteractionAlias } from "@foxworth/superimg/inspection/boundary";
      import { admitWhen } from "@foxworth/boundary";
      import { registerWebMcpBinding, webMcpTools, type ModelContextPort } from "@foxworth/boundary/webmcp";
      type Context = { permitted: boolean };
      const expose: readonly PreviewInteractionAlias[] = ["list", "inspect", "setMode", "seekFrame"];
      const mount = await createPreviewInteractionMount<Context>({ inspection: createPreviewInspection(), installationId: "consumer:types:1", expose, admit: admitWhen<Context>((context) => context.permitted, "denied") });
      const modelContext: ModelContextPort = { registerTool: async () => undefined };
      const registration = await registerWebMcpBinding({ binding: mount.binding, tools: webMcpTools(mount.projection), context: () => ({ permitted: true }), modelContext });
      registration.dispose();
      mount.dispose();
    `);
  });

  it("validates direct outputs, declared errors, admission, and revocation through one packed SDK", async () => {
    const source = `
      import { createRequire } from "node:module";
      import { realpathSync } from "node:fs";
      import { createPreviewInspection } from "@foxworth/superimg/inspection";
      import { createPreviewInteractionMount } from "@foxworth/superimg/inspection/boundary";
      import { DeclaredInteractionError } from "@foxworth/boundary";
      import { registerWebMcpBinding, webMcpTools } from "@foxworth/boundary/webmcp";
      const require = createRequire(import.meta.url);
      const helperRequire = createRequire(import.meta.resolve("@foxworth/superimg/inspection/boundary"));
      const sdkIdentity = realpathSync(require.resolve("@foxworth/boundary"));
      if (sdkIdentity !== realpathSync(helperRequire.resolve("@foxworth/boundary"))) throw new Error("SDK identity split");
      const container = { querySelectorAll: () => [], getBoundingClientRect: () => ({ x: 0, y: 0, width: 320, height: 180 }), ownerDocument: { defaultView: { devicePixelRatio: 1 } } };
      const player = {
        container, getState: () => ({ width: 320, height: 180, fps: 25, totalFrames: 7, isPlaying: false, isReady: true }),
        getPresentation: () => ({ generation: 1, requestedFrame: 0, accepted: { frame: 0, revision: 1, html: "frame0", compositeHtml: "frame0" }, isReady: true, disposed: false }),
        getDriveKind: () => null, suspendDrive: () => () => undefined, play() {}, pause() {}, seek: async () => undefined, on: () => () => undefined,
      };
      const inspection = createPreviewInspection();
      inspection.attach({ surfaceId: "film", player, controls: ["set-mode", "seek-frame"],
        source: { id: "film-source", revision: "revision-1" },
        compilation: { status: "succeeded", source: { id: "film-source", revision: "revision-1" }, inputIdentity: "inputs-1", projectionIdentity: "projection-1", hostGeneration: 3 },
        coordinates: { entryId: null, variantId: "default", editionId: "square" },
      });
      const mount = await createPreviewInteractionMount({ inspection, installationId: "consumer:direct:1", expose: ["list", "inspect", "setMode", "seekFrame"], admit: ({ context }) => context.permitted ? { decision: "allow" } : { decision: "deny", reason: "consumer denied" } });
      const caller = mount.binding.connect();
      const handles = mount.projection.handles;
      const interactions = Object.fromEntries(Object.entries(handles).map(([alias, handle]) => [alias, mount.binding.resolve(handle.interactionId)]));
      const call = (alias, input, context) => caller.callRaw(interactions[alias], input, context);
      const allowed = { permitted: true };
      const returned = await call("inspect", { surfaceId: "film" }, allowed);
      const missing = await call("inspect", { surfaceId: "absent" }, allowed);
      const mode = await call("setMode", { surfaceId: "film", expectedGeneration: 1, mode: "inspection" }, allowed);
      const invalidFrame = await call("seekFrame", { surfaceId: "film", expectedGeneration: 1, frame: 7 }, allowed);
      const denied = await call("inspect", { surfaceId: "film" }, { permitted: false });
      const invalidInput = await call("inspect", { surfaceId: 7 }, allowed);
      let typedError;
      try { await caller.call(handles.inspect, { surfaceId: "absent" }, allowed); }
      catch (error) { typedError = { code: error.code, details: error.details, publicClass: error instanceof DeclaredInteractionError }; }
      const tools = [];
      const registration = await registerWebMcpBinding({ binding: mount.binding, tools: webMcpTools(mount.projection), context: () => allowed, modelContext: { registerTool: async (tool) => { tools.push({ name: tool.name, inputSchema: tool.inputSchema }); } } });
      mount.controller.revoke();
      const revoked = await call("inspect", { surfaceId: "film" }, allowed);
      console.log(JSON.stringify({ sdkIdentity, returned, missing, mode, invalidFrame, denied, invalidInput, typedError, revoked, tools }));
      registration.dispose(); inspection.dispose(); mount.dispose();
    `;
    await writeFile(join(sdkConsumer, "binding.mjs"), source);
    const observed = JSON.parse(await run(sdkConsumer, ["binding.mjs"])) as Record<string, unknown> & { tools: Array<{ name: string; inputSchema: unknown }>; sdkIdentity: string };
    expect(observed.sdkIdentity).toBe(await realpath(join(sdkConsumer, "node_modules", "@foxworth", "boundary", "index.js")));
    expect(observed.returned).toMatchObject({ certainty: "completed", result: { kind: "returned", value: {
      schemaVersion: 1, surfaceId: "film", generation: 1, presented: { frame: 0, revision: 1 },
      source: { id: "film-source", revision: "revision-1" },
      compilation: { status: "succeeded", source: { id: "film-source", revision: "revision-1" }, inputIdentity: "inputs-1", projectionIdentity: "projection-1", hostGeneration: 3 },
      coordinates: { entryId: null, variantId: "default", editionId: "square" }, observations: null, geometry: { content: null },
      semantic: null, currentPart: null, stepId: null,
    } } });
    expect(observed.missing).toMatchObject({ certainty: "completed", result: { kind: "declared-error", code: "PREVIEW_ERROR", details: { code: "UNKNOWN_SURFACE", surfaceId: "absent" } } });
    expect(observed.mode).toMatchObject({ certainty: "completed", result: { kind: "returned", value: { clock: { owner: "inspection", isPlaying: false } } } });
    expect(observed.invalidFrame).toMatchObject({ certainty: "completed", result: { kind: "declared-error", details: { code: "FRAME_OUT_OF_RANGE" } } });
    expect(observed.denied).toMatchObject({ certainty: "not-started", result: { kind: "denied" } });
    expect(observed.invalidInput).toMatchObject({ certainty: "not-started", result: { kind: "fault", cause: "invalid-input" } });
    expect(observed.typedError).toMatchObject({ code: "PREVIEW_ERROR", details: { code: "UNKNOWN_SURFACE" }, publicClass: true });
    expect(observed.revoked).toMatchObject({ certainty: "not-started", result: { kind: "fault", cause: "revoked" } });
    expect(observed.tools.map((tool) => tool.name).sort()).toEqual(["media.preview.inspect", "media.preview.list", "media.preview.seek-frame", "media.preview.set-mode"]);
    expect(observed.tools.find((tool) => tool.name === "media.preview.seek-frame")?.inputSchema).toMatchObject({ type: "object", required: ["surfaceId", "expectedGeneration", "frame"], additionalProperties: false });
  });

  it("bundles packed pure inspection for a browser with no Node or SDK dependency", async () => {
    const entry = join(pureConsumer, "browser-entry.js");
    await writeFile(entry, 'import { createPreviewInspection } from "@foxworth/superimg/inspection"; globalThis.previewInspection = createPreviewInspection();');
    const bundleScript = join(scratch, "bundle.mjs");
    const rolldown = pathToFileURL(packageRequire.resolve("rolldown")).href;
    await writeFile(bundleScript, `
      import { rolldown } from ${JSON.stringify(rolldown)};
      const bundle = await rolldown({ input: ${JSON.stringify(entry)}, platform: "browser" });
      const generated = await bundle.generate({ format: "esm", inlineDynamicImports: true });
      const chunks = generated.output.filter((item) => item.type === "chunk");
      console.log(JSON.stringify(chunks.map((chunk) => ({ code: chunk.code, imports: chunk.imports, dynamicImports: chunk.dynamicImports, moduleIds: chunk.moduleIds }))));
      await bundle.close();
    `);
    const chunks = JSON.parse(await run(pureConsumer, [bundleScript])) as Array<{ code: string; imports: string[]; dynamicImports: string[]; moduleIds: string[] }>;
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.imports).toEqual([]);
    expect(chunks[0]?.dynamicImports).toEqual([]);
    expect(chunks[0]?.moduleIds.join("\n")).not.toMatch(/(?:node:|\/node_modules\/(?:@foxworth\/boundary|@ops-first\/|@superimg\/))/);
    expect(chunks[0]?.code).not.toMatch(/(?:from\s*|import\s*\(|require\s*\()\s*["'](?:node:|@foxworth\/boundary|@ops-first\/|@superimg\/)/);
  });
});
