import { describe, expect, it } from "vitest";
import * as types from "../index.js";
import { createMediaIR, MEDIA_IR_STUB_HASH } from "../media-ir.js";

describe("draft platform contracts", () => {
  it("exports unsuffixed draft names and not V1 primary types", () => {
    const keys = Object.keys(types);
    // Runtime values
    expect(typeof types.createMediaIR).toBe("function");
    // Type-only — ensure no MediaIRV1 runtime export slipped in
    expect(keys.some((k) => /MediaIRV1|EditOperationV1|MediaJobV1/.test(k))).toBe(
      false,
    );
  });

  it("createMediaIR builds a schemaVersion 0 stub with defaults", () => {
    const ir = createMediaIR({ sourceId: "hero", width: 1280, height: 720 });
    expect(ir.kind).toBe("@foxworth/superimg/media-ir");
    expect(ir.schemaVersion).toBe(0);
    expect(ir.identity).toEqual({
      sourceId: "hero",
      variantId: "default",
      editionId: "default",
    });
    expect(ir.canvas).toEqual({ width: 1280, height: 720 });
    expect(ir.clock.totalFrames).toBe(90);
    expect(ir.provenance.programHash).toBe(MEDIA_IR_STUB_HASH);
    expect(ir.scenes).toHaveLength(1);
    expect(ir.extensions).toEqual({});
  });
});
