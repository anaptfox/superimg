import { describe, expect, it } from "vitest";

describe("assembled public package", () => {
  it("loads the root and server exports", async () => {
    const [root, server] = await Promise.all([
      import("superimg"),
      import("superimg/server"),
    ]);

    expect(root.define).toBeTypeOf("function");
    expect(root.compose).toBeTypeOf("function");
    expect(root.layoutTimeline).toBeTypeOf("function");
    expect("compileTemplate" in root).toBe(false);
    expect("Player" in root).toBe(false);
    expect(server.compileTemplate).toBeTypeOf("function");
  });

  it("loads platform-safe and granular exports", async () => {
    const [defineEntry, edge, easing] = await Promise.all([
      import("superimg/define"),
      import("superimg/edge"),
      import("superimg/stdlib/easing"),
    ]);

    expect(defineEntry.define).toBeTypeOf("function");
    expect(edge.define).toBeTypeOf("function");
    expect(easing).toBeDefined();
  });
});
