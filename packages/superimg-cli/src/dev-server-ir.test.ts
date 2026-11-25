import { describe, it, expect } from "vitest";
import {
  classifyChange,
  shouldBroadcastCompileError,
  shouldBroadcastWatchSuccess,
} from "./dev-server-ir.js";

const h = (intent: string, markup: string) => ({
  intentHash: intent.repeat(64).slice(0, 64),
  markupHash: markup.repeat(64).slice(0, 64),
  programHash: "p".repeat(64),
});

describe("classifyChange", () => {
  it("reload on cold start", () => {
    expect(classifyChange(null, h("a", "b"))).toBe("reload");
  });
  it("no-change when intent+markup equal", () => {
    const x = h("a", "b");
    expect(classifyChange(x, { ...x, programHash: "q".repeat(64) })).toBe(
      "no-change",
    );
  });
  it("markup-update when only markup changes", () => {
    expect(classifyChange(h("a", "b"), h("a", "c"))).toBe("markup-update");
  });
  it("reload when intent changes", () => {
    expect(classifyChange(h("a", "b"), h("x", "b"))).toBe("reload");
  });
});

describe("WS broadcast gates (concurrent IR / watch epochs)", () => {
  it("shouldBroadcastWatchSuccess only when epochs match", () => {
    expect(shouldBroadcastWatchSuccess(3, 3)).toBe(true);
    expect(shouldBroadcastWatchSuccess(2, 3)).toBe(false);
  });

  it("shouldBroadcastCompileError ignores stale_generation", () => {
    const stale = Object.assign(new Error("Generation superseded"), {
      code: "stale_generation",
    });
    expect(shouldBroadcastCompileError(stale, 5, 5)).toBe(false);
  });

  it("shouldBroadcastCompileError ignores late failures from older epochs", () => {
    const real = new Error("syntax error");
    expect(shouldBroadcastCompileError(real, 4, 5)).toBe(false);
    expect(shouldBroadcastCompileError(real, 5, 5)).toBe(true);
  });
});
