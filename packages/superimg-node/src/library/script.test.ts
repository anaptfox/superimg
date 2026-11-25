import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseScript, scriptHash } from "@foxworth/superimg-script";
import { findScriptSources, readScriptCues } from "./script.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const SCRIPT = `# Reel

\`\`\`speech id=hello
who: chick
pace: say

Hi there.
\`\`\`

\`\`\`speech id=bye
who: goose
pace: beat

Not yet.
\`\`\`

\`\`\`speech id=new-line
who: pig

Is this mud?
\`\`\`

\`\`\`speech
who: fox

Default id from heading.
\`\`\`

\`\`\`card
No id card.
\`\`\`
`;

function project(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "superimg-script-node-")));
  roots.push(root);
  mkdirSync(join(root, "writer"));
  mkdirSync(join(root, "other"));
  writeFileSync(join(root, "reel.script.md"), SCRIPT);
  writeFileSync(join(root, "old.script.md"), SCRIPT);
  // Reads the script through a local module, the way a film with a clock helper would.
  writeFileSync(join(root, "writer", "clock.ts"), `import script from "../reel.script.md";
    export const lines = script.blocks.filter((block) => block.id && block.id !== "new-line")
      .map((block, index) => ({ id: block.id, start: 1 + index * 2, end: 2.5 + index * 2 }));`);
  writeFileSync(join(root, "writer", "reel.media.ts"), `import { video, Html } from "@foxworth/superimg";
    import { lines } from "./clock";
    export default video({
      duration: "8s",
      resolve: () => ({
        cues: [...lines.map((line) => ({ id: line.id, start: line.start, end: line.end })), { id: "gone", start: "7s", end: "7.5s", still: "7.2s" }],
        cueFindings: [{ id: "bye", message: "too long for the bubble" }],
      }),
      render: () => Html({ id: "stage", width: 100, height: 100, html: String(lines.length) }),
    });`);
  writeFileSync(join(root, "other", "old.media.ts"), `import { video, Html } from "@foxworth/superimg";
    import script from "../old.script.md";
    export default video({ duration: "2s", render: () => Html({ id: "stage", width: 10, height: 10, html: script.hash }) });`);
  writeFileSync(join(root, "plain.media.ts"), `import { image, Html } from "@foxworth/superimg";
    // import script from "./reel.script.md";
    export default image({ render: () => Html({ id: "stage", width: 10, height: 10, html: "x" }) });`);
  return root;
}

describe("findScriptSources", () => {
  it("lists only the films that import the script, without running them", () => {
    const root = project();
    expect(findScriptSources(root, "reel.script.md")).toEqual({
      schemaVersion: 0,
      kind: "media-script-sources",
      scriptPath: "reel.script.md",
      sources: [{ sourceId: "writer/reel", relativePath: "writer/reel.media.ts" }],
    });
    expect(findScriptSources(root, join(root, "old.script.md")).sources.map((source) => source.relativePath))
      .toEqual(["other/old.media.ts"]);
  });

  it("refuses a script outside the root or with another name", () => {
    const root = project();
    writeFileSync(join(root, "notes.md"), "# notes");
    expect(() => findScriptSources(join(root, "writer"), join(root, "reel.script.md"))).toThrow(/inside the project root/);
    expect(() => findScriptSources(root, "notes.md")).toThrow(/\.script\.md/);
    expect(() => findScriptSources(root, "missing.script.md")).toThrow(/does not exist/);
  });
});

describe("readScriptCues", () => {
  it("reports the film's clock for each block the script has", async () => {
    const root = project();
    const result = await readScriptCues(root, "writer/reel.media.ts");
    expect(result).toMatchObject({
      kind: "media-script-cues",
      sourceId: "writer/reel",
      relativePath: "writer/reel.media.ts",
      scriptPath: "reel.script.md",
      scriptHash: scriptHash(parseScript(SCRIPT)!),
      fps: 30,
      durationSeconds: 8,
      cues: [
        { blockId: "hello", startSeconds: 1, endSeconds: 2.5, stillSeconds: 1.75, costSeconds: 2 },
        { blockId: "bye", startSeconds: 3, endSeconds: 4.5, stillSeconds: 3.75, costSeconds: 2 },
        { blockId: "reel-4", startSeconds: 5, endSeconds: 6.5, stillSeconds: 5.75, costSeconds: 2 },
      ],
      unplaced: ["new-line"],
      unknownCues: ["gone"],
      findings: [{ blockId: "bye", code: "FILM_FINDING", message: "too long for the bubble" }],
    });
    expect(result.programHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("says so when a film reads no script", async () => {
    const root = project();
    await expect(readScriptCues(root, "plain.media.ts")).rejects.toMatchObject({ code: "NO_SCRIPT" });
  });

  it("reads script cues for static collection() sources by entryId and defers provider collections", async () => {
    const root = project();
    writeFileSync(
      join(root, "writer", "multi.media.ts"),
      `import { collection, video, Html } from "@foxworth/superimg";
      import { lines } from "./clock";
      export default collection({
        entries: [
          { id: "en", extra: 0 },
          { id: "es", extra: 2 },
        ],
        media: video<{ id: string; extra: number }>({
          duration: "8s",
          resolve: ({ data }) => ({
            duration: \`\${8 + (data.extra ?? 0)}s\`,
            cues: lines.map((line) => ({ id: line.id, start: line.start, end: line.end + (data.extra ?? 0) })),
          }),
          render: () => Html({ id: "stage", width: 100, height: 100, html: "ok" }),
        }),
      });`,
    );
    writeFileSync(join(root, "writer", "load.server.ts"), `export async function load() { return [{ id: "a" }]; }`);
    writeFileSync(
      join(root, "writer", "provider.media.ts"),
      `import { collection, video, Html } from "@foxworth/superimg";
      import { load } from "./load.server";
      import script from "../reel.script.md";
      export default collection({
        entries: load,
        media: video<{ id: string }>({
          duration: "4s",
          render: () => Html({ id: "stage", width: 100, height: 100, html: script.hash }),
        }),
      });`,
    );

    const first = await readScriptCues(root, "writer/multi.media.ts");
    expect(first.entryId).toBe("en");
    expect(first.durationSeconds).toBe(8);

    const second = await readScriptCues(root, "writer/multi.media.ts", { entryId: "es" });
    expect(second.entryId).toBe("es");
    expect(second.durationSeconds).toBe(10);

    await expect(readScriptCues(root, "writer/multi.media.ts", { entryId: "fr" })).rejects.toMatchObject({
      code: "UNKNOWN_ENTRY",
    });
    await expect(readScriptCues(root, "writer/provider.media.ts")).rejects.toMatchObject({
      code: "COLLECTION_PROVIDER_DEFERRED",
    });
  });
});
