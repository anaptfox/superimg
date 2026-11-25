import { describe, expect, it } from "vitest";
import { createThumbnail } from "./thumbnail.js";

describe("createThumbnail", () => {
  it("scales host RGBA pixels and encodes dimensions plus pixels", () => {
    const source = { width: 4, height: 2, rgba: new Uint8Array(Array.from({ length: 32 }, (_, i) => i)) };
    const { raster, bytes } = createThumbnail(source, 2);
    expect(raster).toEqual({ width: 2, height: 1, rgba: new Uint8Array([0, 1, 2, 3, 8, 9, 10, 11]) });
    expect([...bytes]).toEqual([0, 0, 0, 2, 0, 0, 0, 1, 0, 1, 2, 3, 8, 9, 10, 11]);
  });
  it("does not upscale and rejects an invalid requested width", () => {
    const source = { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 4]) };
    expect(createThumbnail(source, 10).raster).toBe(source);
    expect(() => createThumbnail(source, 0)).toThrow(RangeError);
  });
});
