import { expect, it } from "vitest";
import { snapshotDataToMediaJson } from "./snapshot.js";

it("clones immutable nested snapshot data and rejects nonportable input", () => {
  const input = Object.freeze({ nested: Object.freeze([Object.freeze({ value: 1 })]) });
  expect(snapshotDataToMediaJson(input)).toEqual(input);
  const invalid: unknown[] = [{ value: undefined }, { value: NaN }, { value: new Date() }];
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  invalid.push(cycle);
  for (const value of invalid) expect(() => snapshotDataToMediaJson(value)).toThrow("portable JSON");
});

it("rejects cyclic reused snapshot data before hashing it", async () => {
  const { assertSnapshotCurrent } = await import("./provider.js");
  const data: Record<string, unknown> = {};
  data.self = data;
  const snapshot = { schemaVersion: 0, kind: "media-collection-snapshot", source: "card.media.ts", sourceId: "card", providerHash: "x", snapshotDigest: "x", entries: [{ id: "card", data, dataDigest: "x" }] };
  const source = { templatePath: "/project/card.media.ts", relativePath: "card.media.ts", sourceId: "card" };
  expect(() => assertSnapshotCurrent(snapshot as never, {} as never, source, "/project")).toThrow("portable JSON");
});

it("rejects accessor and extended snapshot arrays without invoking getters", () => {
  let reads = 0;
  const getter = [1];
  Object.defineProperty(getter, "0", { get() { reads++; return 1; }, enumerable: true });
  const symbol = [1];
  Object.defineProperty(symbol, Symbol("extra"), { value: true });
  const extended = Object.assign([1], { extra: true });
  for (const array of [getter, symbol, extended, new Array(1)]) {
    expect(() => snapshotDataToMediaJson({ array })).toThrow("portable JSON");
  }
  expect(reads).toBe(0);
});
