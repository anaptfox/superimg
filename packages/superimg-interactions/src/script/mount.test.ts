import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateProgram } from "@foxworth/boundary/program";
import { createRuntime } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter } from "@superimg/node";
import { SCRIPT_COMPILED_INTERACTIONS } from "./compiled.js";
import { SCRIPT_INTERACTION_IDS } from "./contracts.js";
import { createScriptInteractionMount } from "./mount.js";
import { createNodeScriptInteractionMount } from "./node-mount.js";
import { projectScriptInteractions } from "./projection.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function project(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "superimg-script-mount-")));
  roots.push(root);
  mkdirSync(join(root, "film"));
  writeFileSync(join(root, "reel.script.md"), [
    "```speech id=hello", "who: chick", "", "Hi there.", "```", "",
    "```speech id=later", "who: goose", "", "Not yet.", "```", "",
  ].join("\n"));
  writeFileSync(join(root, "film", "reel.media.ts"), `import { video, Html } from "@foxworth/superimg";
    import script from "../reel.script.md";
    export default video({
      duration: "4s",
      resolve: () => ({ cues: [{ id: script.blocks[0].id, start: 0.5, end: 2 }] }),
      render: () => Html({ id: "stage", width: 100, height: 100, html: script.blocks[0].lines[0] }),
    });`);
  return root;
}

describe("Script compiled interactions", () => {
  it("is an independent exact Program of three reads", async () => {
    expect(await validateProgram(SCRIPT_COMPILED_INTERACTIONS.program)).toEqual(SCRIPT_COMPILED_INTERACTIONS.program);
    expect(SCRIPT_COMPILED_INTERACTIONS.program.interactions.map((entry) => entry.contract.id)).toEqual([
      SCRIPT_INTERACTION_IDS.cues,
      SCRIPT_INTERACTION_IDS.sources,
      SCRIPT_INTERACTION_IDS.still,
    ]);
    for (const entry of SCRIPT_COMPILED_INTERACTIONS.program.interactions) {
      expect(entry.contract.changes).toEqual([]);
    }
  });

  it("lets a caller select only the reads it needs", async () => {
    const projection = await projectScriptInteractions({ sources: "direct", cues: "direct" });
    expect(JSON.stringify(projection)).toContain(SCRIPT_INTERACTION_IDS.sources);
    expect(JSON.stringify(projection)).not.toContain(SCRIPT_INTERACTION_IDS.still);
  });

  it("rejects input and output that do not match the contract", async () => {
    const mount = createScriptInteractionMount<object>({
      handlers: {
        sources: () => ({ schemaVersion: 0, kind: "media-script-sources", scriptPath: "a.script.md", sources: [] }),
        cues: () => ({ nope: true }) as never,
        still: () => { throw new Error("not called"); },
      },
    });
    await expect(mount.dispatch({ interactionId: SCRIPT_INTERACTION_IDS.sources, input: {} as never }, {}))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(mount.dispatch({ interactionId: SCRIPT_INTERACTION_IDS.cues, input: { source: "x" } }, {}))
      .rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    await expect(mount.dispatch({ interactionId: SCRIPT_INTERACTION_IDS.still, input: { source: "x", blockId: "not valid!" } }, {}))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("Node script mount", () => {
  it("answers sources and cues from a real project", async () => {
    const root = project();
    const mount = createNodeScriptInteractionMount<object>({ projectRoot: root });
    const sources = await mount.dispatch({ interactionId: SCRIPT_INTERACTION_IDS.sources, input: { script: "reel.script.md" } }, {});
    expect(sources.sources).toEqual([{ sourceId: "film/reel", relativePath: "film/reel.media.ts" }]);
    const cues = await mount.dispatch({ interactionId: SCRIPT_INTERACTION_IDS.cues, input: { source: "film/reel.media.ts" } }, {});
    expect(cues.cues).toEqual([
      { blockId: "hello", startSeconds: 0.5, endSeconds: 2, stillSeconds: 1.25, costSeconds: 3.5 },
    ]);
    expect(cues.unplaced).toEqual(["later"]);
  });

  it("keeps a library refusal's code and refuses a still without a runtime", async () => {
    const root = project();
    const mount = createNodeScriptInteractionMount<object>({ projectRoot: root });
    await expect(mount.dispatch({ interactionId: SCRIPT_INTERACTION_IDS.sources, input: { script: "missing.script.md" } }, {}))
      .rejects.toMatchObject({ name: "ScriptInteractionError", code: "SCRIPT_NOT_FOUND", certainty: "completed" });
    await expect(mount.dispatch({ interactionId: SCRIPT_INTERACTION_IDS.still, input: { source: "film/reel.media.ts", blockId: "hello" } }, {}))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("renders the frame the film shows for one block", async () => {
    const root = project();
    const runtime = createRuntime(createNodeRuntimeAdapter());
    try {
      const mount = createNodeScriptInteractionMount<object>({ projectRoot: root, runtime });
      const still = await mount.dispatch({
        interactionId: SCRIPT_INTERACTION_IDS.still,
        input: { source: "film/reel.media.ts", blockId: "hello", maxWidth: 48 },
      }, {});
      expect(still).toMatchObject({ kind: "media-script-still", blockId: "hello", frame: 38, atSeconds: 1.266667, mimeType: "image/png", width: 48 });
      expect(Buffer.from(still.bytes, "base64").subarray(1, 4).toString()).toBe("PNG");
      await expect(mount.dispatch({
        interactionId: SCRIPT_INTERACTION_IDS.still,
        input: { source: "film/reel.media.ts", blockId: "later" },
      }, {})).rejects.toMatchObject({ code: "BLOCK_NOT_PLACED" });
    } finally {
      await runtime.dispose();
    }
  }, 60_000);
});
