import { describe, expect, it } from "vitest";
import { buildSuperimgPlugin, STDLIB_NOOP_ID } from "./plugin.shared.js";

describe("explicit chart authoring resolution", () => {
  it("uses the same chart module in server and virtual browser hosts", () => {
    for (const target of ["/stdlib/dist/charts/index.js", "\0stdlib-charts"]) {
      const plugin = buildSuperimgPlugin({
        resolveSuperimg: () => "/root.js",
        resolveInteractive: () => "/interactive.js",
        resolveStdlibSubpath: (sub) => (sub === "charts" ? target : null),
      });
      expect(plugin.resolveId("@foxworth/superimg/charts")).toBe(target);
      expect(plugin.resolveId("@foxworth/superimg")).toBe("/root.js");
    }
  });

  it("fails visibly instead of stripping unavailable chart imports", () => {
    for (const target of [null, STDLIB_NOOP_ID]) {
      const plugin = buildSuperimgPlugin({
        resolveSuperimg: () => "/root.js",
        resolveInteractive: () => "/interactive.js",
        resolveStdlibSubpath: () => target,
      });
      expect(() => plugin.resolveId("@foxworth/superimg/charts")).toThrow(
        "@foxworth/superimg/charts is unavailable",
      );
    }
  });
});
