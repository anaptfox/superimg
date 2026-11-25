import { describe, it, expect } from "vitest";
import {
  edgeEnsureInit,
  ensureInit,
} from "../rendering/resvg-rasterizer.edge.js";

describe("resvg edge ensureInit", () => {
  it("requires explicit WASM source", async () => {
    await expect(edgeEnsureInit()).rejects.toThrow(/explicit WASM source/i);
    await expect(ensureInit()).rejects.toThrow(/explicit WASM source/i);
  });
});
