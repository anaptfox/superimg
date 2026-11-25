import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { editHash, parseScript, scriptHash } from "@foxworth/superimg-script";
import { bundleMediaProgram } from "./bundler.js";
import { scriptModuleCode } from "./script-module.js";
import { compileTemplate } from "../rendering/compiler.js";
import { applyTemplateResolve } from "../rendering/resolve-template.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

const SCRIPT = `# Reel

\`\`\`shot id=opening hold=4 still=1.5
Chick on the night ledge.
\`\`\`

\`\`\`storyboard
The film must never see this sketch.
\`\`\`

\`\`\`speech at=0.2..1.7
who: chick
do: hop

Hi there.
\`\`\`

\`\`\`speech id=bye at=2
who: goose
pace: beat

Not yet.
\`\`\`
`;

describe("script files in a media program", () => {
  it("gives the film version 2, hash, editHash, timing attrs, defaults, and cues", async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "superimg-script-")));
    directories.push(root);
    await mkdir(join(root, "film"));
    const script = join(root, "reel.script.md");
    const entry = join(root, "film", "reel.media.ts");
    await writeFile(script, SCRIPT);
    await writeFile(entry, `import { video, Html } from "@foxworth/superimg";
      import script from "../reel.script.md";
      const speeches = script.blocks.filter((block) => block.kind === "speech");
      const shot = script.blocks.find((block) => block.kind === "shot");
      const lines = speeches.map((block, index) => ({
        ...block,
        start: block.at?.start ?? index * 2,
        end: block.at?.end ?? (block.at?.start ?? index * 2) + 1.5,
      }));
      export default video({
        duration: \`\${shot?.hold ?? 4}s\`,
        resolve: () => ({
          cues: lines.map((line) => ({ id: line.id, start: line.start, end: line.end, still: line.start + 1 })),
          cueFindings: [{ id: "bye", code: "TOO_LONG", message: "too long for the bubble" }],
        }),
        render: () => Html({
          id: "stage",
          width: 100,
          height: 100,
          html: [script.version, script.hash, script.editHash, speeches.map((l) => \`\${l.id}:\${l.pace}\`).join(",")].join("|"),
        }),
      });`);

    const bundle = await bundleMediaProgram(entry);
    const parsed = parseScript(SCRIPT)!;
    expect(bundle.dependencies).toEqual(expect.arrayContaining([entry, script]));
    expect(bundle.code).toContain(scriptHash(parsed));
    expect(bundle.code).toContain(editHash(parsed));
    expect(bundle.code).not.toContain("must never see this sketch");

    const compiled = compileTemplate(bundle);
    expect(compiled.error).toBeUndefined();
    const applied = await applyTemplateResolve(compiled.media!);
    expect(applied.resolved?.cues).toEqual([
      { id: "opening-1", start: 0.2, end: 1.7, still: 1.2 },
      { id: "bye", start: 2, end: 3.5, still: 3 },
    ]);
    expect(applied.resolved?.markers).toEqual([
      { id: "opening-1", at: 0.2 },
      { id: "bye", at: 2 },
    ]);
    expect(applied.resolved?.cueFindings).toEqual([
      { id: "bye", code: "TOO_LONG", message: "too long for the bubble" },
    ]);

    // Retiming updates editHash in the compiled module without changing hash.
    const retimed = SCRIPT.replace("hold=4", "hold=5");
    await writeFile(script, retimed);
    const bundle2 = await bundleMediaProgram(entry);
    const parsed2 = parseScript(retimed)!;
    expect(scriptHash(parsed2)).toBe(scriptHash(parsed));
    expect(editHash(parsed2)).not.toBe(editHash(parsed));
    expect(bundle2.code).toContain(scriptHash(parsed));
    expect(bundle2.code).toContain(editHash(parsed2));
  });

  it("provides the first level-1 heading as the film's title", () => {
    const module = (text: string) => JSON.parse(scriptModuleCode(text, "x.script.md").replace(/^export default /, "").replace(/;\s*$/, ""));
    expect(module(SCRIPT).title).toBe("Reel");
    expect(module(SCRIPT.replace("# Reel", "## Reel")).title).toBeNull();
  });

  it("rejects a script file with no script block", async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "superimg-script-")));
    directories.push(root);
    await writeFile(join(root, "notes.script.md"), "# Just notes\n");
    const entry = join(root, "notes.media.ts");
    await writeFile(entry, `import { image, Html } from "@foxworth/superimg";
      import script from "./notes.script.md";
      export default image({ render: () => Html({ id: "stage", width: 10, height: 10, html: String(script.blocks.length) }) });`);
    await expect(bundleMediaProgram(entry)).rejects.toThrow(/not a script/);
  });
});
