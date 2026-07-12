import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, "..", "..", "dist");
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"),
);

/** Built artifacts that must exist and be importable after `pnpm run build`. */
const distEntrypoints = [
  ["index", "index.js"],
  ["index.server", "index.server.js"],
  ["index.react-server", "index.react-server.js"],
  ["index.browser", "index.browser.js"],
  ["index.edge", "index.edge.js"],
  ["define", "define.js"],
  ["player", "player.js"],
  ["media", "media.js"],
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
  ["stdlib/cue", "stdlib/cue.js"],
] as const;

describe("built dist entrypoints load", () => {
  for (const [name, file] of distEntrypoints) {
    it(name, async () => {
      const mod = await import(pathToFileURL(join(distRoot, file)).href);
      expect(mod).toBeDefined();
    });
  }
});

describe("package.json exports map", () => {
  it("declares primary subpaths", () => {
    const keys = Object.keys(pkg.exports);
    expect(keys).toContain(".");
    expect(keys).toContain("./browser");
    expect(keys).toContain("./edge");
    expect(keys).toContain("./define");
    expect(keys).toContain("./player");
    expect(keys).toContain("./media");
    expect(keys).toContain("./bundler");
    expect(keys).toContain("./react");
    expect(keys).toContain("./react/player");
    expect(keys).toContain("./react/compile");
    expect(keys).toContain("./react/session");
    expect(keys).toContain("./server");
    expect(keys).not.toContain("./export");
    expect(keys).not.toContain("./runtime-web");
    expect(keys).not.toContain("./react/export");
  });
});
