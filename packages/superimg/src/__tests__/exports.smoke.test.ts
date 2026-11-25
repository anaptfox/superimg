// @vitest-environment node

// These built Node entrypoints resolve colocated assets with file: URLs.
// Keep their imports outside happy-dom's browser URL environment.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectSourceImports } from "@superimg/build-config/scan-imports";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, "..", "..", "dist");
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"),
);

/** Built artifacts that must be importable in Node after `pnpm run build`. */
const distEntrypoints = [
  ["charts", "charts.js"],
  ["index", "index.js"],
  ["runtime.node", "runtime.node.js"],
  ["runtime.browser", "runtime.browser.js"],
  ["browser-export", "browser-export.js"],
  ["runtime.edge", "runtime.edge.js"],
  ["runtime/html", "runtime/html.js"],
  ["player", "player.js"],
  ["player/program", "player/program.js"],
  ["composition/prepare", "composition/prepare.js"],
  ["destinations", "destinations.js"],
  ["interactive/define", "interactive/define.js"],
  ["interactive/player", "interactive/player.js"],
  ["react/interactive", "react/interactive.js"],
  ["player/dom", "player/dom.js"],
  ["ir", "ir.js"],
  ["bundler-browser", "bundler-browser.js"],
  ["react/index", "react/index.js"],
  ["react/react-server", "react/react-server.js"],
  ["react/player", "react/player.js"],
  ["react/compile", "react/compile.js"],
  ["react/session", "react/session.js"],
  ["stdlib/code", "stdlib/code.js"],
  ["stdlib/easing", "stdlib/easing.js"],
  ["stdlib/math", "stdlib/math.js"],
  ["stdlib/text", "stdlib/text.js"],
  ["transcript", "transcript.js"],
] as const;

function walkRelativeGraph(entryRel: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entryRel)) return seen;
  const abs = join(distRoot, entryRel);
  seen.add(entryRel);
  const source = readFileSync(abs, "utf8");
  for (const specifier of collectSourceImports(source)) {
    if (!specifier.startsWith(".")) continue;
    const dependency = resolve(dirname(abs), specifier);
    if (!dependency.endsWith(".js")) continue;
    walkRelativeGraph(dependency.slice(distRoot.length + 1), seen);
  }
  return seen;
}

describe("built dist entrypoints load", () => {
  for (const [name, file] of distEntrypoints) {
    it(name, async () => {
      const mod = await import(pathToFileURL(join(distRoot, file)).href);
      expect(mod).toBeDefined();
    });
  }

  it("runtime.edge loads document-only without a WASM asset loader", async () => {
    const source = readFileSync(join(distRoot, "runtime.edge.js"), "utf8");
    expect(source).not.toContain("@resvg/resvg-wasm");
    expect(source).not.toContain("index_bg.wasm");
    const edge = await import(pathToFileURL(join(distRoot, "runtime.edge.js")).href);
    const runtime = await edge.init();
    expect(runtime.capabilities.documents).toEqual(["html", "svg"]);
    expect(runtime.capabilities.rasters).toEqual([]);
    await runtime.dispose();
  });

  it("runtime.html renders synchronously without ambient capability access", async () => {
    const graph = walkRelativeGraph("runtime/html.js");
    const policyHits: string[] = [];
    for (const file of graph) {
      const source = readFileSync(join(distRoot, file), "utf8");
      if (/\bfetch\s*\(/u.test(source)) policyHits.push(`${file}: direct-fetch`);
      if (/\benv\s*(?:\.|\[)/u.test(source)) policyHits.push(`${file}: ambient-env`);
      if (/from\s+["']node:/u.test(source)) policyHits.push(`${file}: node-import`);
    }
    expect(policyHits).toEqual([]);

    const [htmlRuntime, root] = await Promise.all([
      import(pathToFileURL(join(distRoot, "runtime/html.js")).href),
      import(pathToFileURL(join(distRoot, "index.js")).href),
    ]);
    expect(htmlRuntime.renderToHtml).toBeTypeOf("function");
    const media = root.image({
      size: { width: 64, height: 32 },
      fonts: [root.googleFont("Inter:wght@400")],
      render: () => root.Html({ html: "<main>pure html</main>" }),
    });
    const html = htmlRuntime.renderToHtml({ media });
    expect(html).toContain("pure html");
  });

  it("initializes the Node runtime without resolving the native video codec", () => {
    const entryUrl = pathToFileURL(join(distRoot, "runtime.node.js")).href;
    const script = `
      import Module from "node:module";
      const originalLoad = Module._load;
      Module._load = function (request, parent, isMain) {
        if (request === "node-av" || request.startsWith("@seydx/node-av-")) {
          throw new Error("native video codec must stay lazy: " + request);
        }
        return originalLoad.call(this, request, parent, isMain);
      };
      const api = await import(${JSON.stringify(entryUrl)});
      const runtime = await api.init();
      await runtime.dispose();
    `;

    expect(() =>
      execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

});

describe("clean-break public runtime surfaces", () => {
  it("publishes one semantic authoring surface from root", async () => {
    const root = await import(pathToFileURL(join(distRoot, "index.js")).href);
    for (const name of ["Frame", "Stack", "Text", "Vector", "vector", "Plate"] as const) {
      expect(root[name]).toBeDefined();
    }
    expect(root.isMediaElement(root.Frame({ width: 1, height: 1 }))).toBe(true);
    expect(root.isMediaElement({ type: "Frame" })).toBe(false);
    expect(root.isMediaElement(null)).toBe(false);
    for (const name of ["Card", "LowerThird", "Caption"] as const) {
      expect(name in root).toBe(false);
    }
  });

  it("destinations exposes the schema-0 organic catalog", async () => {
    const mod = await import(pathToFileURL(join(distRoot, "destinations.js")).href);
    expect(mod.ORGANIC_DESTINATIONS.youtube.schemaVersion).toBe(0);
    expect(mod.getDestination("youtube").id).toBe("youtube");
  });

  it("separates interactive authoring, framework-neutral playback and React", async () => {
    const [define, player, react, dom] = await Promise.all([
      import(pathToFileURL(join(distRoot, "interactive/define.js")).href),
      import(pathToFileURL(join(distRoot, "interactive/player.js")).href),
      import(pathToFileURL(join(distRoot, "react/interactive.js")).href),
      import(pathToFileURL(join(distRoot, "player/dom.js")).href),
    ]);
    expect(define.defineInteractive).toBeTypeOf("function");
    expect(define).not.toHaveProperty("createInteractivePlayer");
    expect(define).not.toHaveProperty("InteractivePlayer");
    expect(player.createInteractivePlayer).toBeTypeOf("function");
    expect(player).not.toHaveProperty("defineInteractive");
    expect(player).not.toHaveProperty("InteractivePlayer");
    expect(react.InteractivePlayer).toBeTypeOf("function");
    expect(dom.createDomPlayer).toBeTypeOf("function");
    expect(dom).not.toHaveProperty("Player");
    expect(pkg.exports).not.toHaveProperty("./interactive");
  });

  it("keeps authoring and framework-neutral entry graphs free of React", () => {
    for (const entry of ["interactive/define.js", "interactive/player.js", "player/dom.js"]) {
      const graph = walkRelativeGraph(entry);
      const imports = [...graph].flatMap((file) => collectSourceImports(readFileSync(join(distRoot, file), "utf8")));
      expect(imports.filter((specifier) => /^(?:react|react-dom)(?:\/|$)/.test(specifier))).toEqual([]);
    }
    const authoring = [...walkRelativeGraph("interactive/define.js")]
      .map((file) => readFileSync(join(distRoot, file), "utf8")).join("\n");
    expect(authoring).not.toMatch(/class (?:InteractivePlayerController|InteractiveSceneController|Player|MediaSession)\b/);
  });

  it("separates runtime values and passive playback", async () => {
    const [runtime, player] = await Promise.all([
      import(pathToFileURL(join(distRoot, "runtime.node.js")).href),
      import(pathToFileURL(join(distRoot, "player.js")).href),
    ]);
    expect(runtime.exportMedia).toBeTypeOf("function");
    expect(runtime.SuperImgError).toBeTypeOf("function");
    expect(player.Player).toBeTypeOf("function");
  });

  it("keeps React source compilation behind its opt-in subpath", async () => {
    const [react, player, compile] = await Promise.all([
      import(pathToFileURL(join(distRoot, "react/index.js")).href),
      import(pathToFileURL(join(distRoot, "react/player.js")).href),
      import(pathToFileURL(join(distRoot, "react/compile.js")).href),
    ]);

    expect("Player" in react).toBe(false);
    expect(player.Player).toBeTypeOf("function");
    expect("CompilingPlayer" in react).toBe(false);
    expect("useCompiler" in react).toBe(false);
    expect("useCompiledMedia" in react).toBe(false);
    expect(compile.CompilingPlayer).toBeTypeOf("function");
    expect(compile.useCompiler).toBeTypeOf("function");
    expect(compile.useCompiledMedia).toBeTypeOf("function");
  });
});

describe("package.json exports map", () => {
  it("declares primary subpaths", () => {
    const keys = Object.keys(pkg.exports);
    expect(keys).toContain(".");
    expect(keys).toContain("./runtime");
    expect(keys).toContain("./runtime/html");
    expect(keys).not.toContain("./operations");
    expect(keys).toContain("./player");
    expect(keys).not.toContain("./player/deck");
    expect(keys).toContain("./player/program");
    expect(keys).toContain("./composition/prepare");
    expect(keys).toContain("./destinations");
    expect(keys).not.toContain("./interactive");
    expect(keys).toContain("./interactive/define");
    expect(keys).toContain("./interactive/player");
    expect(keys).toContain("./react/interactive");
    expect(keys).toContain("./player/dom");
    expect(keys).toContain("./ir");
    expect(keys).toContain("./react");
    expect(keys).toContain("./react/player");
    expect(keys).toContain("./react/compile");
    expect(keys).toContain("./react/session");
    for (const removed of [
      "./define",
      "./node",
      "./browser",
      "./edge",
      "./server",
      "./adapters",
      "./bundler",
      "./compile",
      "./export",
      "./runtime-web",
      "./react/export",
      "./stdlib/cue",
    ]) {
      expect(keys).not.toContain(removed);
    }
  });

  it("maps one runtime declaration to conditional implementations", () => {
    expect(pkg.exports["./runtime"]).toMatchObject({
      types: "./dist/runtime.d.ts",
      node: "./dist/runtime.node.js",
      browser: "./dist/runtime.browser.js",
      workerd: "./dist/runtime.edge.js",
    });
    expect(pkg.exports["./operations"]).toBeUndefined();
    expect(pkg.exports["./runtime/html"]).toMatchObject({
      types: "./dist/runtime/html.d.ts",
      workerd: "./dist/runtime/html.js",
      node: "./dist/runtime/html.js",
    });
  });

  it("does not publish a CLI bin", () => {
    expect(pkg.bin).toBeUndefined();
  });
});
