import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCliEditInteractionMount } from "./edit-source.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("CLI edit source", () => {
  it("plans and applies a retained still hold through the real override compiler", async () => {
    const root = await mkdtemp(join(packageRoot, ".edit-source-"));
    try {
      const source = `
        import { image, sequence, time, Html } from "@foxworth/superimg";
        const card = image({
          size: { width: 320, height: 180 },
          render: () => Html({ width: "fill", height: "fill", html: "Hello" }),
        });
        export default time(sequence([
          { id: "title", content: card, hold: "1s" },
        ]), { size: { width: 320, height: 180 }, fps: 10 });
      `;
      await writeFile(join(root, "title.media.ts"), source, "utf8");
      const mount = createCliEditInteractionMount(root);
      const bindings = await mount.dispatch({
        interactionId: "media.edit.bindings",
        input: { source: "title.media.ts" },
      }, {});
      const result = await mount.dispatch({
        interactionId: "media.edit.set-composition-hold",
        input: {
          schemaVersion: 0,
          source: "title.media.ts",
          kind: "set-composition-hold",
          target: { occurrencePath: "title", holdBindingId: "title#hold" },
          value: { hold: "2s" },
          expected: {
            intentHash: bindings.manifest.intentHash,
            sourceHashes: { ...bindings.sourceHashes },
          },
        },
      }, {});

      expect(result.transaction.inverse).toMatchObject({
        kind: "set-composition-hold",
        value: { hold: "1s" },
      });
      expect(result.media.clock.totalFrames).toBe(20);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
