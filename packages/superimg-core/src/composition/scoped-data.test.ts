import { describe, expect, it } from "vitest";
import { scopedCompositionData, snapshotJsonObject } from "./scoped-data.js";

describe("composition data snapshots", () => {
  it("copies and freezes nested occurrence data without freezing the caller's object", () => {
    const nested = { settings: { theme: "a" }, rows: [{ label: "one" }] };
    const snapshot = snapshotJsonObject(nested, "use.data");
    nested.settings.theme = "b";
    nested.rows[0]!.label = "two";
    expect(snapshot).toEqual({ settings: { theme: "a" }, rows: [{ label: "one" }] });
    expect(Object.isFrozen(snapshot.settings)).toBe(true);
    expect(Object.isFrozen(snapshot.rows)).toBe(true);
    expect(Object.isFrozen(nested)).toBe(false);
  });

  it("isolates two scoped entry patches and rejects cycles", () => {
    const patch = { settings: { theme: "a" } };
    const scoped = scopedCompositionData({ uses: { first: patch, second: patch } }, ["first", "second"]);
    patch.settings.theme = "b";
    expect(scoped.first).toEqual({ settings: { theme: "a" } });
    expect(scoped.second).toEqual({ settings: { theme: "a" } });
    expect(scoped.first).not.toBe(scoped.second);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => snapshotJsonObject(cyclic, "use.data")).toThrow("contains a cycle");
  });
});
