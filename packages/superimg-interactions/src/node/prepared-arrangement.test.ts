import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { arrangePhaseAt } from "@superimg/core/arrange";
import { parseDuration } from "@superimg/core";
import { prepareNodeArrangement, readNodeArrangement } from "./prepared-arrangement.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

it("freezes the arrangement snapshot and changes identity when its data changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-arrangement-source-"));
  try {
    const path = join(root, "board.arrange.json");
    const request = { pattern: "aligned-intervals", spec: { question: "Overlap?", workRemoved: "Compare intervals", evidence: "observation", timeRef: { unit: "s", origin: 0 }, tracks: [{ id: "a", label: "A", intervals: [{ start: 0, end: 2 }] }, { id: "b", label: "B", intervals: [{ start: 1, end: 3 }] }] } };
    await writeFile(path, JSON.stringify(request));
    const input = await readNodeArrangement(path);
    expect(input.failures).toEqual([]);
    const first = await prepareNodeArrangement(input);
    expect(Object.isFrozen(input.request.spec)).toBe(true);
    expect(Object.isFrozen(input.failures)).toBe(true);
    expect(Object.isFrozen(first.media.config)).toBe(true);
    expect(Reflect.set(input.request.spec, "question", "mutated")).toBe(false);
    expect(Reflect.set(first.request.spec, "question", "mutated")).toBe(false);
    const forged = structuredClone(input);
    if (forged.request.pattern !== "aligned-intervals") throw new Error("unexpected pattern");
    forged.request.spec.tracks = [];
    forged.failures = [];
    await expect(prepareNodeArrangement(forged)).rejects.toMatchObject({ code: "ARRANGEMENT_REFUSED" });
    await writeFile(path, JSON.stringify({ ...request, spec: { ...request.spec, question: "Changed?" } }));
    const frozen = await prepareNodeArrangement(input);
    const next = await prepareNodeArrangement(await readNodeArrangement(path));
    expect(frozen.identity).toBe(first.identity);
    expect(next.identity).not.toBe(first.identity);
    expect((await prepareNodeArrangement(input, "8s")).identity).not.toBe(first.identity);
    expect((await prepareNodeArrangement(input, "6000ms")).identity).toBe(first.identity);
    expect(first.kind).toBe("arrangement");
    const frame = Math.round(parseDuration(first.media.poster, "poster", 30) * 30);
    expect(arrangePhaseAt(frame / (180 - 1))).toBe("reveal");
    expect(arrangePhaseAt(0)).toBe("hold");
    expect((await readFile(path, "utf8"))).toContain("Changed?");
  } finally { await rm(root, { recursive: true, force: true }); }
});


it("canonicalizes key order and incorporates resolved relative asset bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-arrangement-assets-"));
  try {
    const path = join(root, "board.arrange.json");
    const spec = { question: "What differs?", workRemoved: "Compare states", evidence: "observation", states: [{ id: "a", label: "A", view: { src: "shot.png" }, provenance: "capture" }, { id: "b", label: "B", view: { src: "shot.png" }, provenance: "capture" }], frame: { scale: "shared", viewport: { width: 100, height: 100 } }, correspondence: ["object"] };
    await writeFile(path, JSON.stringify({ pattern: "registered-comparison", spec }));
    const input = await readNodeArrangement(path);
    expect(input.failures).toEqual([]);
    await expect(prepareNodeArrangement(input)).rejects.toThrow();
    await writeFile(join(root, "shot.png"), "first bytes");
    vi.mocked(readFile).mockClear();
    const first = await prepareNodeArrangement(input);
    expect(vi.mocked(readFile).mock.calls.filter(([path]) => path === join(root, "shot.png"))).toHaveLength(1);
    const render = () => JSON.stringify(first.media.render({ width: 1920, height: 1080 } as never));
    const before = render();
    await writeFile(path, JSON.stringify({ spec: Object.fromEntries(Object.entries(spec).reverse()), pattern: "registered-comparison" }));
    const reordered = await prepareNodeArrangement(await readNodeArrangement(path));
    expect(reordered.identity).toBe(first.identity);
    await writeFile(join(root, "shot.png"), "other bytes");
    const changed = await prepareNodeArrangement(input);
    expect(changed.identity).not.toBe(first.identity);
    expect(render()).toBe(before);
    expect(first.identity).toBe(reordered.identity);
    expect(JSON.stringify(first.request)).toContain(Buffer.from("first bytes").toString("base64"));
    expect(JSON.stringify(changed.request)).toContain(Buffer.from("other bytes").toString("base64"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("only declares a poster when an encoded frame reaches reveal", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-arrangement-poster-"));
  try {
    const path = join(root, "board.arrange.json");
    await writeFile(path, JSON.stringify({ pattern: "aligned-intervals", spec: { question: "Overlap?", workRemoved: "Compare intervals", evidence: "observation", timeRef: { unit: "s", origin: 0 }, tracks: [{ id: "a", label: "A", intervals: [{ start: 0, end: 2 }] }, { id: "b", label: "B", intervals: [{ start: 1, end: 3 }] }], motion: { phase: "reveal", revealIds: ["b"], predict: "tick" } } }));
    const input = await readNodeArrangement(path);
    const one = await prepareNodeArrangement(input, "1f");
    expect(one.media.poster).toBeUndefined();
    for (const count of [2, 3, 4]) {
      const media = (await prepareNodeArrangement(input, `${count}f`)).media;
      expect(media.poster).toBeDefined();
      const frame = Math.min(count - 1, Math.round(parseDuration(media.poster, "poster", 30) * 30));
      expect(arrangePhaseAt(frame / (count - 1))).toBe("reveal");
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
