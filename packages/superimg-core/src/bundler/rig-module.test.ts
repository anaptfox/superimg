import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  bundleMediaProgram,
  bundleTemplateESM,
  exportRig,
  prepareMediaProgram,
  preparedMediaInputIdentity,
  rigModuleCode,
  rigToPet,
  superimgRigVitePlugin,
  type FamiliarExportedRig,
  type RigPetEntry,
} from "./bundler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHICK_FIXTURE_PATH = join(__dirname, "__fixtures__", "chick.export.json");

/** Exact conversion code copied from sunday-companion-media prep.mjs for parity verification. */
function prepMjsConvertRig(rig: FamiliarExportedRig): RigPetEntry {
  function gridToPaths(grid: readonly string[], palette: Record<string, string>) {
    const by: Record<string, string> = {};
    grid.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === "." || !palette[ch]) return;
        by[palette[ch]!] = (by[palette[ch]!] ?? "") + `M${x} ${y}h1v1h-1z`;
      });
    });
    return Object.entries(by).map(([fill, d]) => ({ fill, d }));
  }

  const poses: Record<string, { fill: string; d: string }[]> = {};
  for (const [pose, grid] of Object.entries(rig.poses)) {
    poses[pose] = gridToPaths(grid, rig.palettes.light);
  }
  const moves: Record<string, { pose: string; ms: number; alt: number }[]> = {};
  for (const [name, frames] of Object.entries(rig.moves ?? {})) {
    moves[name] = frames.map(({ pose, ms, alt = 0 }) => ({ pose, ms, alt }));
  }
  return {
    w: rig.poses.rest![0]!.length,
    h: rig.poses.rest!.length,
    poses,
    moves,
  };
}

function evalDefaultExport<T = unknown>(esm: string): T {
  const body = esm.replace(/export\s*\{\s*([^}\s]+)\s+as\s+default\s*\}\s*;?/g, "return $1;");
  return new Function(body)() as T;
}

async function createFakeFamiliarBin(dir: string, fixtureJson: string, version = "familiar 0.1.0"): Promise<string> {
  const binPath = join(dir, "fake-familiar");
  const countPath = join(dir, "export-count.txt");
  const script = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "--version") {
  process.stdout.write(${JSON.stringify(version + "\napi_version: familiar/v1\n")});
  process.exit(0);
}
if (args[0] === "rig" && args[1] === "export") {
  const count = fs.existsSync(${JSON.stringify(countPath)})
    ? Number(fs.readFileSync(${JSON.stringify(countPath)}, "utf8"))
    : 0;
  fs.writeFileSync(${JSON.stringify(countPath)}, String(count + 1));
  process.stdout.write(fs.readFileSync(${JSON.stringify(CHICK_FIXTURE_PATH)}, "utf8"));
  process.exit(0);
}
process.stderr.write("unexpected args: " + args.join(" ") + "\\n");
process.exit(1);
`;
  await writeFile(binPath, script, "utf8");
  await chmod(binPath, 0o755);
  return binPath;
}

describe("rigModule", () => {
  it("converts the real chick familiar export JSON identically to prep.mjs (including talk and look-up)", async () => {
    const rawText = await readFile(CHICK_FIXTURE_PATH, "utf8");
    const rawRig = JSON.parse(rawText) as FamiliarExportedRig;

    const actual = rigToPet(rawRig);
    const expected = prepMjsConvertRig(rawRig);

    expect(actual).toEqual(expected);
    expect(actual.w).toBe(20);
    expect(actual.h).toBe(22);
    expect(actual.poses.rest?.length).toBeGreaterThan(0);
    expect(actual.poses.talk?.length).toBeGreaterThan(0);
    expect(actual.poses["look-up"]?.length).toBeGreaterThan(0);
    expect(actual.moves.walk).toEqual([
      { pose: "walk-a", ms: 140, alt: 0 },
      { pose: "walk-b", ms: 140, alt: 1 },
    ]);
  });

  it("bundles .rig.toml, rigs/*.toml, header .toml, and ?rig imports with caching and _*.toml dependency tracking", async () => {
    const dir = await mkdtemp(join(tmpdir(), "superimg-rig-"));
    const prevEnv = process.env.SUPERIMG_FAMILIAR;
    try {
      const fixtureText = await readFile(CHICK_FIXTURE_PATH, "utf8");
      const fakeBin = await createFakeFamiliarBin(dir, fixtureText);
      process.env.SUPERIMG_FAMILIAR = fakeBin;

      await writeFile(join(dir, "package.json"), JSON.stringify({ name: "rig-test", private: true }), "utf8");
      const rigsDir = join(dir, "rigs");
      await mkdir(rigsDir, { recursive: true });

      const sharedClips = join(rigsDir, "_sunday.clips.toml");
      const sharedContract = join(rigsDir, "_sunday.contract.toml");
      const chickToml = join(rigsDir, "chick.toml");
      await writeFile(sharedClips, '# shared clips\n[moves.walk]\nframes = []\n', "utf8");
      await writeFile(sharedContract, '# shared contract\nversion = 1\n', "utf8");
      await writeFile(
        chickToml,
        'id = "chick"\ncanvas = [20, 22]\n\n[palette]\ny = "#ffd166"\n',
        "utf8",
      );

      const mediaFile = join(dir, "film.media.ts");
      await writeFile(
        mediaFile,
        `import chick from "./rigs/chick.toml";\nimport chickQuery from "./rigs/chick.toml?rig";\nexport default { chick, same: chick.w === chickQuery.w };\n`,
        "utf8",
      );

      const observedFiles = new Set<string>();
      const bundle1 = await bundleMediaProgram(mediaFile, {
        onDependencies(inputs) {
          for (const f of inputs.files) observedFiles.add(f);
        },
      });

      // Dependencies must include chick.toml and both _*.toml sibling files for takes & dev watch.
      expect(bundle1.dependencies).toContain(chickToml);
      expect(bundle1.dependencies).toContain(sharedClips);
      expect(bundle1.dependencies).toContain(sharedContract);
      expect([...observedFiles]).toContain(chickToml);
      expect([...observedFiles]).toContain(sharedClips);
      expect([...observedFiles]).toContain(sharedContract);

      // Cache file exists under <project root>/.superimg/cache/rigs/<sha256>.json
      const cacheDir = join(dir, ".superimg", "cache", "rigs");
      expect(existsSync(cacheDir)).toBe(true);
      const exportCount1 = Number(await readFile(join(dir, "export-count.txt"), "utf8"));
      expect(exportCount1).toBe(1);

      // Second bundle uses the cached JSON without invoking `familiar rig export` again.
      const esm = await bundleTemplateESM(mediaFile, { minify: false });
      const exportCount2 = Number(await readFile(join(dir, "export-count.txt"), "utf8"));
      expect(exportCount2).toBe(1);

      const mod = evalDefaultExport<{ chick: RigPetEntry; same: boolean }>(esm);
      expect(mod.same).toBe(true);
      expect(mod.chick.w).toBe(20);
      expect(mod.chick.poses.talk?.length).toBeGreaterThan(0);

      // Mutating a shared _*.toml file invalidates the cache key and changes preparedMediaInputIdentity.
      const prepared1 = await prepareMediaProgram(mediaFile);
      await bundleMediaProgram(mediaFile, { prepared: prepared1 });
      const id1 = await preparedMediaInputIdentity(prepared1);

      await writeFile(sharedClips, '# updated shared clips\n[moves.walk]\nframes = ["walk-a"]\n', "utf8");
      const prepared2 = await prepareMediaProgram(mediaFile);
      await bundleMediaProgram(mediaFile, { prepared: prepared2 });
      const id2 = await preparedMediaInputIdentity(prepared2);

      expect(id2).not.toBe(id1);
      const exportCount3 = Number(await readFile(join(dir, "export-count.txt"), "utf8"));
      expect(exportCount3).toBe(2);
    } finally {
      if (prevEnv === undefined) delete process.env.SUPERIMG_FAMILIAR;
      else process.env.SUPERIMG_FAMILIAR = prevEnv;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects non-rig .toml files and direct _*.toml imports with a clear error", async () => {
    const dir = await mkdtemp(join(tmpdir(), "superimg-rig-err-"));
    try {
      const configToml = join(dir, "config.toml");
      await writeFile(configToml, 'title = "not a rig"\n', "utf8");
      await expect(exportRig(configToml)).rejects.toThrow(/Ambiguous \.toml import "config\.toml"/);

      const sharedToml = join(dir, "_sunday.clips.toml");
      await writeFile(sharedToml, 'id = "shared"\ncanvas = [20, 22]\n', "utf8");
      await expect(exportRig(sharedToml)).rejects.toThrow(
        /Cannot import shared Familiar include "_sunday\.clips\.toml" directly/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws a clear error naming SUPERIMG_FAMILIAR and familiar on PATH when the binary is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "superimg-rig-nobin-"));
    try {
      const rigToml = join(dir, "pig.rig.toml");
      await writeFile(rigToml, 'id = "pig"\ncanvas = [26, 22]\n', "utf8");
      await expect(
        exportRig(rigToml, { familiarBin: join(dir, "definitely-missing-familiar-bin") }),
      ).rejects.toThrow(/SUPERIMG_FAMILIAR.*familiar.*PATH/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("provides a Vite plugin that loads rigs and registers rig + shared _*.toml watch files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "superimg-rig-vite-"));
    try {
      const fixtureText = await readFile(CHICK_FIXTURE_PATH, "utf8");
      const fakeBin = await createFakeFamiliarBin(dir, fixtureText);
      await writeFile(join(dir, "package.json"), "{}", "utf8");
      const rigToml = join(dir, "chick.rig.toml");
      const sharedToml = join(dir, "_sunday.clips.toml");
      await writeFile(sharedToml, "# clips\n", "utf8");
      await writeFile(rigToml, 'id = "chick"\ncanvas = [20, 22]\n', "utf8");

      const plugin = superimgRigVitePlugin({ familiarBin: fakeBin, projectFrom: dir });
      const watched: string[] = [];
      const result = await plugin.load.call(
        { addWatchFile: (f: string) => watched.push(f) },
        rigToml,
      );
      expect(result).not.toBeNull();
      expect(watched).toContain(rigToml);
      expect(watched).toContain(sharedToml);
      expect(result?.code).toBe(rigModuleCode(JSON.parse(fixtureText) as FamiliarExportedRig));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
