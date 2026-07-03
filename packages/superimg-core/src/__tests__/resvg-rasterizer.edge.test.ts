import { describe, it, expect } from "vitest";
import { ensureInit } from "../rendering/resvg-rasterizer.edge.js";

describe("resvg edge ensureInit", () => {
  it("requires explicit WASM source", async () => {
    await expect(ensureInit()).rejects.toThrow(/explicit WASM source/i);
  });
});