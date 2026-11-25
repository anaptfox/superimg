import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadNodeMediaValue } from "./source.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Node media value loading", () => {
  it("compiles once, freezes assets, and reuses one collection snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-node-source-"));
    roots.push(root);
    const counterPath = join(root, "provider-count.txt");
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "assets", "logo.svg"), "<svg>logo</svg>");
    await writeFile(
      join(root, "entries.server.ts"),
      [
        'import { appendFileSync } from "node:fs";',
        "export function loadCards() {",
        `  appendFileSync(${JSON.stringify(counterPath)}, "x");`,
        '  return [{ id: "one", title: "One" }];',
        "}",
      ].join("\n"),
    );
    await writeFile(
      join(root, "cards.media.ts"),
      [
        'import { collection, image, Html } from "@foxworth/superimg";',
        'import { loadCards } from "./entries.server";',
        "export default collection({",
        "  entries: loadCards,",
        "  media: image({",
        '    render: (ctx) => Html({ html: `<img src="${ctx.asset("logo.svg")}">${ctx.data.title}` }),',
        "  }),",
        "});",
      ].join("\n"),
    );

    const first = await loadNodeMediaValue(root, "cards");
    expect(first.descriptor.kind).toBe("collection");
    expect(first.snapshot?.entries.map((entry) => entry.id)).toEqual(["one"]);
    expect(await readFile(counterPath, "utf8")).toBe("x");
    expect(first.value.kind).toBe("collection");
    if (first.value.kind !== "collection") throw new Error("expected collection");
    if (!Array.isArray(first.value.entries)) throw new Error("expected frozen entries");
    expect(Object.isFrozen(first.value.entries)).toBe(true);
    expect(Object.isFrozen(first.value.entries[0])).toBe(true);
    const asset = first.value.media.config?.assets?.["logo.svg"];
    expect(asset && "bytes" in asset ? new TextDecoder().decode(asset.bytes) : undefined)
      .toBe("<svg>logo</svg>");

    if (first.snapshot === undefined) throw new Error("expected snapshot");
    const replay = await loadNodeMediaValue(root, "cards", {
      snapshot: first.snapshot,
    });
    expect(replay.snapshot?.snapshotDigest).toBe(first.snapshot?.snapshotDigest);
    expect(await readFile(counterPath, "utf8")).toBe("x");
  }, 20_000);
});
