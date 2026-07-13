import { describe, expect, it } from "vitest";
import { define } from "@superimg/types";
import {
  detectStdlibCapabilities,
  getLoadedStdlibCapabilities,
  prepareStdlibForTemplate,
} from "./stdlib-capabilities.js";
import { stdlib } from "./stdlib.js";

describe("stdlib capabilities", () => {
  it("detects capability use without loading the heavy packs into the base graph", () => {
    const template = define({
      config: { duration: 1 },
      render(ctx) {
        return [
          ctx.std.code.highlight("const x = 1"),
          ctx.std.svg.rough.circle(10, 10, 4),
          ctx.std.viz.equation("x"),
          ctx.std.viz.lottie({ src: "animation.json" }),
          ctx.std.viz.mermaid("graph TD; A-->B"),
          ctx.std.viz.three.scene({}),
        ].join("");
      },
    });

    expect(detectStdlibCapabilities(template)).toEqual([
      "code",
      "rough",
      "katex",
      "lottie",
      "mermaid",
      "three",
    ]);
  });

  it("prepares a detected capability before render", async () => {
    const template = define({
      config: { duration: 1 },
      render(ctx) {
        return ctx.std.code.highlight("const answer = 42", { lang: "ts" });
      },
    });

    await prepareStdlibForTemplate(template);

    expect(getLoadedStdlibCapabilities()).toContain("code");
    expect(stdlib.code.highlight("const answer = 42", { lang: "ts" })).toContain("answer");
  });
});
