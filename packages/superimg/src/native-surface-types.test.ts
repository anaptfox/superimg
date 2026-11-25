import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsc = resolve(packageRoot, "../../node_modules/.bin/tsc");

describe("native surface source types", () => {
  it("type-checks a source import and typed frame data from the packed package", () => {
    const root = mkdtempSync(join(tmpdir(), "superimg-native-types-"));
    try {
      const packed = execFileSync("npm", ["pack", "--ignore-scripts", "--pack-destination", root], { cwd: packageRoot, encoding: "utf8", env: { ...process.env, npm_config_cache: join(root, "cache") }, stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").at(-1)!;
      const installed = join(root, "node_modules", "@foxworth", "superimg");
      mkdirSync(installed, { recursive: true });
      execFileSync("tar", ["-xzf", join(root, packed), "--strip-components=1", "-C", installed]);
      const manifest = JSON.parse(readFileSync(join(installed, "package.json"), "utf8")) as { dependencies: Record<string, string> };
      expect(manifest.dependencies.saxes).toBe("6.0.0");
      expect(existsSync(join(installed, "dist", "internal", "native-surface-browser.js"))).toBe(true);
      writeFileSync(join(root, "package.json"), '{"type":"module"}');
      writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: true, target: "ES2022", module: "ESNext", moduleResolution: "Bundler", lib: ["ES2022", "DOM"] }, include: ["*.ts"] }));
      writeFileSync(join(root, "world.ts"), `import type { NativeSurfaceModule } from '@foxworth/superimg'; type State = { color: string }; export default { create({ canvas }) { const context = canvas.getContext('2d')!; return { sample({ data }) { context.fillStyle = data.color; }, dispose() {} }; } } satisfies NativeSurfaceModule<State>;`);
      writeFileSync(join(root, "scene.ts"), `import { NativeSurface, svgDocument } from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; import art from './art.svg?superimg-svg'; svgDocument(art); type State = { color: string }; NativeSurface<State>({ id: 'world', module: world, width: 64, height: 64, seconds: 0, data: { color: 'red' } });\n// @ts-expect-error missing required color\nNativeSurface<State>({ id: 'bad', module: world, width: 64, height: 64, seconds: 0, data: {} });`);
      const result = spawnSync(tsc, ["-p", root], { encoding: "utf8" });
      expect(result.stdout + result.stderr).toBe("");
      expect(result.status).toBe(0);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 30000);
});
