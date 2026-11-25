import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cortexCommand } from "./cortex.js";

describe("cortexCommand", () => {
  it("rejects a bundle without brief and atoms", async () => {
    const dir = mkdtempSync(join(tmpdir(), "superimg-cortex-"));
    const path = join(dir, "bad.json");
    writeFileSync(path, JSON.stringify({ hello: true }));
    await expect(cortexCommand(path, { for: ["1080x1080.png"] })).rejects.toThrow(
      /Unknown field 'hello'/,
    );
  });

  it("requires --for", async () => {
    await expect(cortexCommand("missing.json", { for: [] })).rejects.toThrow(/--for/);
  });

  it("rejects an unknown editorial intent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "superimg-cortex-"));
    const path = join(dir, "bad-intent.json");
    writeFileSync(path, JSON.stringify({
      brief: { question: "ok?", intent: "vibes", audience: "owner" },
      atoms: [],
    }));
    await expect(cortexCommand(path, { for: ["1080x1080.png"] })).rejects.toThrow(
      /brief.intent/,
    );
  });
});
