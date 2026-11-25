#!/usr/bin/env node

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const scratch = mkdtempSync(join(tmpdir(), "superimg-attw-"));
let verified = false;

const foundationPackages = Object.freeze(["@foxworth/boundary"]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    encoding: options.capture ? "utf8" : undefined,
    env: options.env ?? process.env,
    stdio: options.capture ? "pipe" : "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = options.capture
      ? `\n${result.stdout ?? ""}${result.stderr ?? ""}`
      : "";
    throw new Error(
      `${command} ${args.join(" ")} exited with ${result.status}${output}`,
    );
  }
  return result;
}

function filesWithin(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...filesWithin(path));
    else files.push(path);
  }
  return files;
}

try {
  run(
    "pnpm",
    ["pack", "--pack-destination", scratch],
    {
      capture: true,
      env: { ...process.env, npm_config_ignore_scripts: "true", npm_config_cache: join(scratch, "npm-cache") },
    },
  );
  const tarballs = readdirSync(scratch).filter((file) => file.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    throw new Error(`Expected one package tarball, found ${tarballs.length}`);
  }
  const tarball = join(scratch, tarballs[0]);
  run("tar", ["-xzf", tarball, "-C", scratch]);

  const packedRoot = join(scratch, "package");
  const packedPackage = JSON.parse(
    readFileSync(join(packedRoot, "package.json"), "utf8"),
  );
  if (packedPackage.bin) {
    throw new Error("Packed superimg package must not expose a bin");
  }
  for (const peer of ["playwright", "node-av", "mediabunny", "@mediabunny/server", "@mediabunny/dts"]) {
    if (packedPackage.dependencies?.[peer]) {
      throw new Error(`Packed package must not depend on optional peer ${peer}`);
    }
    if (!packedPackage.peerDependencies?.[peer]) {
      throw new Error(`Packed package must declare optional peer ${peer}`);
    }
    if (packedPackage.peerDependenciesMeta?.[peer]?.optional !== true) {
      throw new Error(`Packed package must mark ${peer} as an optional peer`);
    }
  }
  for (const name of foundationPackages) {
    if (packedPackage.peerDependencies?.[name] !== "^0.2.0" || packedPackage.peerDependenciesMeta?.[name]?.optional !== true) {
      throw new Error(`Packed optional inspection adapter must declare optional peer ${name}`);
    }
  }
  if (packedPackage.peerDependencies?.["@ops-first/manifold"]) {
    throw new Error("Packed interactions must not require the retired Manifold application facade");
  }
  if (packedPackage.peerDependencies?.["@foxworth/boundary/handoff"]) {
    throw new Error("Packed interactions must not require the retired Handoff port layer");
  }
  const runtimeExport = packedPackage.exports?.["./runtime"];
  if (
    runtimeExport?.types !== "./dist/runtime.d.ts" ||
    runtimeExport?.node !== "./dist/runtime.node.js" ||
    runtimeExport?.browser !== "./dist/runtime.browser.js" ||
    runtimeExport?.workerd !== "./dist/runtime.edge.js"
  ) {
    throw new Error("Packed package does not expose the conditional runtime surface");
  }
  const htmlRuntimeExport = packedPackage.exports?.["./runtime/html"];
  if (
    htmlRuntimeExport?.types !== "./dist/runtime/html.d.ts" ||
    htmlRuntimeExport?.workerd !== "./dist/runtime/html.js" ||
    htmlRuntimeExport?.node !== "./dist/runtime/html.js"
  ) {
    throw new Error("Packed package does not expose the pure HTML runtime surface");
  }
  for (const privateDeclaration of [
    "runtime.node.d.ts",
    "runtime.browser.d.ts",
    "runtime.edge.d.ts",
  ]) {
    if (statSync(join(packedRoot, "dist", privateDeclaration), { throwIfNoEntry: false })) {
      throw new Error(`Packed package leaked private runtime declaration ${privateDeclaration}`);
    }
  }
  const disposableReference = '/// <reference lib="esnext.disposable" />';
  for (const declarationPath of filesWithin(join(packedRoot, "dist")).filter((path) =>
    path.endsWith(".d.ts")
  )) {
    const declaration = readFileSync(declarationPath, "utf8");
    if (declaration.includes("AsyncDisposable") && !declaration.startsWith(disposableReference)) {
      throw new Error(
        `Packed declaration using AsyncDisposable must provide the disposable lib reference: ${declarationPath}`,
      );
    }
  }
  if (packedPackage.exports?.["./interactions"] || packedPackage.exports?.["./operations"]) {
    throw new Error("Packed package must not expose ./interactions");
  }
  if (!packedPackage.exports?.["./player"]) {
    throw new Error("Packed package does not expose @foxworth/superimg/player");
  }
  const declarationText = filesWithin(join(packedRoot, "dist"))
    .filter((path) => path.endsWith(".d.ts"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  for (const removedType of [
    "RenderRequest",
    "AsyncRenderJob",
    "RenderServiceClient",
    "AsyncRenderJobService",
  ]) {
    if (new RegExp(`\\b${removedType}\\b`).test(declarationText)) {
      throw new Error(`Packed declarations still expose removed async job type ${removedType}`);
    }
  }
  for (const removed of [
    "./interactive",
    "./define",
    "./node",
    "./browser",
    "./edge",
    "./server",
    "./adapters",
    "./bundler",
  ]) {
    if (removed in packedPackage.exports) {
      throw new Error(`Packed package still exposes removed subpath ${removed}`);
    }
  }
  for (const runtimeFile of [
    "index.js",
    "index.d.ts",
    "player.js",
    "player.d.ts",
    "interactive/define.js",
    "interactive/define.d.ts",
    "interactive/player.js",
    "interactive/player.d.ts",
    "react/interactive.js",
    "react/interactive.d.ts",
    "player/dom.js",
    "player/dom.d.ts",
    "runtime.node.js",
    "runtime.browser.js",
    "runtime.edge.js",
    "runtime/html.js",
    "runtime/html.d.ts",
    "runtime.d.ts",
    "inspection.js",
    "inspection.d.ts",
  ]) {
    const source = readFileSync(join(packedRoot, "dist", runtimeFile), "utf8");
    if (/@(?:ops-first\/|foxworth\/boundary)/u.test(source)) {
      throw new Error(`Packed ${runtimeFile} leaked an interaction foundation import`);
    }
  }
  const packedEdgeRuntime = readFileSync(
    join(packedRoot, "dist", "runtime.edge.js"),
    "utf8",
  );
  for (const forbiddenEdgeRasterizerMarker of [
    "@resvg/resvg-wasm",
    "index_bg.wasm",
  ]) {
    if (packedEdgeRuntime.includes(forbiddenEdgeRasterizerMarker)) {
      throw new Error(
        `Packed document-only edge runtime leaked rasterizer code: ${forbiddenEdgeRasterizerMarker}`,
      );
    }
  }
  const privateDependencies = Object.keys({
    ...(packedPackage.dependencies ?? {}),
    ...(packedPackage.optionalDependencies ?? {}),
    ...(packedPackage.peerDependencies ?? {}),
  }).filter((name) => name.startsWith("@superimg/"));
  if (privateDependencies.length > 0) {
    throw new Error(
      `Packed package exposes private SuperImg dependencies: ${privateDependencies.join(", ")}`,
    );
  }
  if (statSync(join(packedRoot, "dist", "chunks", "node"), {
    throwIfNoEntry: false,
  })) {
    const nodeChunks = readdirSync(join(packedRoot, "dist", "chunks", "node"));
    if (nodeChunks.includes("playwright.js")) {
      throw new Error("Packed package must not inline Playwright's CommonJS runtime");
    }
  }

  const consumerRoot = join(scratch, "consumer");
  mkdirSync(consumerRoot);
  writeFileSync(
    join(consumerRoot, "package.json"),
    `${JSON.stringify({
      name: "superimg-packed-consumer",
      private: true,
      type: "module",
    }, null, 2)}\n`,
  );
  const consumerEnv = { ...process.env };
  consumerEnv.SUPERIMG_PACKAGE_EVIDENCE_DIR = resolve(packageRoot, "../../tests/integration/output/packed-runtime", String(Date.now()));
  delete consumerEnv.SUPERIMG_EXAMPLES_ROOT;
  consumerEnv.npm_config_cache = join(scratch, "npm-cache");
  // The animated consumer opts into the documented codec peers. Keep Playwright
  // at the workspace version whose Chromium registry was prepared for this run;
  // resolving the peer range again could select an unrelated browser revision.
  const playwrightVersion = JSON.parse(
    readFileSync(require.resolve("playwright/package.json"), "utf8"),
  ).version;
  const optionalPeers = ["playwright", "node-av", "mediabunny", "@mediabunny/server", "@mediabunny/dts"].map((name) => {
    if (name === "playwright") return `${name}@${playwrightVersion}`;
    const spec = packedPackage.peerDependencies?.[name];
    return typeof spec === "string" && !spec.includes(":") ? `${name}@${spec}` : name;
  });
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      tarball,
      ...optionalPeers,
    ],
    { cwd: consumerRoot, env: consumerEnv },
  );
  writeFileSync(
    join(consumerRoot, "authoring-facade.ts"),
    `export * from "@foxworth/superimg";
`,
  );
  writeFileSync(
    join(consumerRoot, "consumer-root-types.ts"),
    `import { Html, image } from "./authoring-facade.js";

export const media = image({
  render: () => Html({ html: "<main>typed consumer</main>" }),
});
`,
  );
  writeFileSync(
    join(consumerRoot, "consumer-runtime-types.ts"),
    `import { init, type Runtime } from "@foxworth/superimg/runtime";
import { renderToHtml, type NativeRenderOptions } from "@foxworth/superimg/runtime/html";

export const runtime: Promise<Runtime> = init();
export const renderHtml: (options: NativeRenderOptions) => string = renderToHtml;
`,
  );
  writeFileSync(
    join(consumerRoot, "consumer-playback-types.ts"),
    `import { defineInteractive, type SceneSnapshot } from "@foxworth/superimg/interactive/define";
import { createInteractivePlayer } from "@foxworth/superimg/interactive/player";
import { createDomPlayer, type DomPlayer } from "@foxworth/superimg/player/dom";
export { defineInteractive, createInteractivePlayer, createDomPlayer };
export type { SceneSnapshot, DomPlayer };
// @ts-expect-error pure authoring does not carry a runtime
import { createInteractivePlayer as badAuthoring } from "@foxworth/superimg/interactive/define";
// @ts-expect-error framework-neutral runtime does not carry React
import { InteractivePlayer as badRuntime } from "@foxworth/superimg/interactive/player";
// @ts-expect-error passive DOM entry does not carry the driven Player
import { Player as badPassive } from "@foxworth/superimg/player/dom";
void badAuthoring; void badRuntime; void badPassive;
`,
  );
  const consumerCompilerOptions = {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    lib: ["ES2022", "DOM"],
    strict: true,
    noEmit: true,
    skipLibCheck: false,
  };
  writeFileSync(
    join(consumerRoot, "tsconfig.root.json"),
    `${JSON.stringify({
      compilerOptions: consumerCompilerOptions,
      files: ["authoring-facade.ts", "consumer-root-types.ts"],
    }, null, 2)}\n`,
  );
  writeFileSync(
    join(consumerRoot, "tsconfig.runtime.json"),
    `${JSON.stringify({
      compilerOptions: consumerCompilerOptions,
      files: ["consumer-runtime-types.ts"],
    }, null, 2)}\n`,
  );
  writeFileSync(join(consumerRoot, "tsconfig.playback.json"), `${JSON.stringify({
    compilerOptions: consumerCompilerOptions,
    files: ["consumer-playback-types.ts"],
  }, null, 2)}\n`);
  run(process.execPath, [join(packageRoot, "scripts/check-player-bundle-size.mjs")], {
    cwd: consumerRoot,
    env: { ...consumerEnv, SUPERIMG_PLAYER_PACKAGE_ROOT: join(consumerRoot, "node_modules/@foxworth/superimg") },
  });
  for (const consumerConfig of ["tsconfig.root.json", "tsconfig.runtime.json", "tsconfig.playback.json"]) {
    run(
      process.execPath,
      [resolve(packageRoot, "../../scripts/typecheck-native.mjs"), "-p", consumerConfig],
      { cwd: consumerRoot, env: consumerEnv },
    );
  }
  writeFileSync(
    join(consumerRoot, "verify-edge-html.mjs"),
    `import { googleFont, Html, image } from "@foxworth/superimg";
import { init, render } from "@foxworth/superimg/runtime";
import { renderToHtml } from "@foxworth/superimg/runtime/html";

const runtime = await init();
if (runtime.capabilities.documents.join(",") !== "html,svg") {
  throw new Error("packed edge runtime lost document rendering capabilities");
}
if (runtime.capabilities.rasters.length !== 0) {
  throw new Error("packed edge runtime advertised an unconfigured raster capability");
}
const pureMedia = image({
  size: { width: 64, height: 32 },
  fonts: [googleFont("Inter:wght@400")],
  render: () => Html({ html: "<main>edge html</main>" }),
});
const synchronous = renderToHtml({ media: pureMedia });
if (!synchronous.includes("edge html")) {
  throw new Error("packed pure HTML runtime did not render synchronously");
}
const media = image({
  size: { width: 64, height: 32 },
  render: () => Html({ html: "<main>edge html</main>" }),
});
const result = await render(media, { runtime, as: "html", providers: "skip" });
if (!(await result.text()).includes("edge html")) {
  throw new Error("packed edge runtime did not render HTML");
}
await runtime.dispose();
`,
  );
  run(process.execPath, ["--conditions=workerd", "verify-edge-html.mjs"], {
    cwd: consumerRoot,
    env: consumerEnv,
  });
  writeFileSync(
    join(consumerRoot, "runtime-fixture.media.js"),
    `import { Html, image } from "@foxworth/superimg";

export default image({
  size: { width: 64, height: 32 },
  sample: { theme: "light" },
  variants: {
    light: { theme: "light" },
    dark: { theme: "dark" },
  },
  render(ctx) {
    return Html({ width: "fill", height: "fill", html: \`<div>\${ctx.data.theme}</div>\` });
  },
});
`,
  );
  writeFileSync(
    join(consumerRoot, "block-video-native.cjs"),
    `const Module = require("node:module");
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    request === "node-av" ||
    request === "@mediabunny/server" ||
    request === "sharp" ||
    request.startsWith("@img/") ||
    request.startsWith("@seydx/")
  ) {
    throw new Error("still render loaded native video dependency: " + request);
  }
  return load.call(this, request, parent, isMain);
};
`,
  );
  writeFileSync(
    join(consumerRoot, "verify-runtime.mjs"),
    `import media from "./runtime-fixture.media.js";
import { init, check, inspect, render, exportMedia } from "@foxworth/superimg/runtime";

for (const removed of [
  "@foxworth/superimg/define",
  "@foxworth/superimg/node",
  "@foxworth/superimg/browser",
  "@foxworth/superimg/edge",
  "@foxworth/superimg/server",
  "@foxworth/superimg/adapters",
  "@foxworth/superimg/bundler",
  "@foxworth/superimg/compile",
]) {
  let rejected = false;
  try {
    await import(removed);
  } catch (error) {
    rejected = error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED";
  }
  if (!rejected) throw new Error("removed public subpath still resolves: " + removed);
}

const runtime = await init();
if (!runtime.abi || !runtime.capabilities.documents.includes("html")) {
  throw new Error("unexpected Node runtime capabilities");
}
const checked = await check(media, { runtime });
if (!checked.ok || !/^[a-f0-9]{64}$/.test(checked.programDigest)) {
  throw new Error("packed runtime check failed");
}
const inspection = await inspect(media, { runtime });
if (inspection.kind !== "image" || inspection.config?.medium !== "html") {
  throw new Error("packed runtime inspection failed");
}
const rendered = await render(media, {
  runtime,
  as: "html",
  variantId: "dark",
});
if (rendered.mimeType !== "text/html;charset=utf-8" || !(await rendered.text()).includes("dark")) {
  throw new Error("packed runtime exact HTML render failed");
}
const bundle = await exportMedia(media, {
  runtime,
  for: [{ id: "portable-html", format: "html", width: 64, height: 32 }],
  variantIds: ["dark"],
});
await runtime.dispose();
const artifact = bundle.artifacts[0];
if (!artifact || artifact.path.startsWith("/") || artifact.path.includes("://")) {
  throw new Error("packed runtime returned a non-portable artifact path");
}
const bytes = new Uint8Array(await new Response(artifact.stream()).arrayBuffer());
if (bytes.byteLength !== artifact.byteLength || artifact.sha256 !== bundle.manifest.artifacts[0]?.sha256) {
  throw new Error("packed runtime artifact metadata disagrees");
}
await Promise.all([bundle.dispose(), bundle.dispose(), runtime.dispose()]);
let disposedReadFailed = false;
try { artifact.stream(); } catch { disposedReadFailed = true; }
if (!disposedReadFailed) throw new Error("disposed bundle still exposes artifact bytes");
`,
  );
  run(process.execPath, ["--require", "./block-video-native.cjs", "verify-runtime.mjs"], {
    cwd: consumerRoot,
    env: consumerEnv,
  });
  writeFileSync(
    join(consumerRoot, "animated-runtime-fixture.media.mjs"),
    `import { Html, video } from "@foxworth/superimg";

export default video({
  size: { width: 16, height: 16 },
  duration: "100ms",
  fps: 10,
  render() {
    return Html({
      width: "fill",
      height: "fill",
      html: '<div style="width:16px;height:16px;background:#e11d48"></div>',
    });
  },
});
`,
  );
  writeFileSync(
    join(consumerRoot, "verify-animated-runtime.mjs"),
    `import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import media from "./animated-runtime-fixture.media.mjs";
import { init, exportMedia, inspectFile, startConversion } from "@foxworth/superimg/runtime";

const runtime = await init();
try {
  const bundle = await exportMedia(media, {
    runtime,
    for: [{ id: "tiny-video", format: "mp4", width: 16, height: 16 }],
  });
  try {
    const artifact = bundle.artifacts[0];
    if (!artifact || artifact.mimeType !== "video/mp4" || artifact.byteLength === 0) {
      throw new Error("packed runtime did not encode the advertised MP4 artifact");
    }
    const bytes = new Uint8Array(await new Response(artifact.stream()).arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(4, 8)) !== "ftyp") {
      throw new Error("packed runtime MP4 artifact is missing its ftyp box");
    }
    const evidence = process.env.SUPERIMG_PACKAGE_EVIDENCE_DIR;
    mkdirSync(evidence, { recursive: true });
    writeFileSync(join(evidence, "tiny-video.mp4"), bytes);
    const input = { kind: "bytes", bytes };
    const inspection = await inspectFile(input, { runtime });
    const videoTrack = inspection.tracks.find((track) => track.kind === "video");
    if (!videoTrack) throw new Error("packed inspection lost the encoded video track");
    const job = startConversion({
      sources: [{ id: "encoded", input }],
      video: { sourceId: "encoded", trackId: videoTrack.id },
      audio: [], format: "mkv",
    }, { runtime });
    try {
      const converted = await job.result;
      const convertedBytes = new Uint8Array(await new Response(converted.open()).arrayBuffer());
      writeFileSync(join(evidence, "tiny-video.mkv"), convertedBytes);
      const inspected = await inspectFile({ kind: "bytes", bytes: convertedBytes }, { runtime });
      if (!inspected.mimeType.startsWith("video/x-matroska") || Math.abs(inspected.durationSeconds - 0.1) > 0.02) {
        throw new Error("packed conversion lost its container or single-frame duration");
      }
    } finally { await job.dispose(); }
  } finally {
    await bundle.dispose();
  }
} finally {
  await runtime.dispose();
}
`,
  );
  run(process.execPath, ["verify-animated-runtime.mjs"], {
    cwd: consumerRoot,
    env: consumerEnv,
  });
  if (statSync(join(consumerRoot, "node_modules", "@superimg"), {
    throwIfNoEntry: false,
  })) {
    throw new Error("Packed consumer installed private @superimg packages");
  }

  run("attw", [tarball, "--profile", "esm-only"]);
  verified = true;
} finally {
  if (verified) rmSync(scratch, { recursive: true, force: true });
  else console.error(`Package verification failed; retained consumer and artifacts at ${scratch}`);
}
