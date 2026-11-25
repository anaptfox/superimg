import { describe, expect, it } from "vitest";
import type { DeterministicMediaDefinition, JsonObject } from "@superimg/types";
import { selectMediaDefinition } from "./selection-value.js";

describe("pure media definition selection", () => {
  const render = () => null;
  const square = () => null;
  const media = { sample: { a: 1, b: 2 }, config: { width: 800, height: 400 }, render, variants: { blue: { b: 3 } }, editions: { square: { size: { width: 400, height: 400 }, render: square } } } as unknown as DeterministicMediaDefinition<JsonObject>;
  it("applies sample, request, variant and edition without mutating the original", () => {
    const selected = selectMediaDefinition(media, { data: { a: 4, b: 5 }, variantId: "blue", editionId: "square" });
    expect(selected.sample).toEqual({ a: 4, b: 3 });
    expect(selected.config).toMatchObject({ width: 400, height: 400 });
    expect(selected.render).toBe(square);
    expect(media.sample).toEqual({ a: 1, b: 2 });
    expect(media.render).toBe(render);
  });
  it("replaces sample with entry data and never executes resolve", () => {
    const selected = selectMediaDefinition({ ...media, resolve: () => { throw Error("must not execute"); } } as typeof media, { entryData: { id: "x" }, variantId: "blue" });
    expect(selected.sample).toEqual({ id: "x", b: 3 });
  });
  it("can be embedded without runtime closure dependencies", () => {
    const embedded = new Function(`return (${selectMediaDefinition.toString()})`)() as typeof selectMediaDefinition;
    expect(embedded(media, { data: { a: 7 } }).sample).toEqual({ a: 7, b: 2 });
    expect(() => embedded(media, { editionId: "absent" })).toThrow('Unknown media edition "absent"');
    expect(() => embedded(media, { variantId: "absent" })).toThrow('Unknown media variant "absent"');
  });
});
