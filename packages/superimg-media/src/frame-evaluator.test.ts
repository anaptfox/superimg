import { describe, expect, it } from "vitest";
import { video } from "@superimg/types";
import { Frame, Text, h } from "@superimg/stdlib/tree";
import { FrameEvaluator } from "./frame-evaluator.js";
import { isEscapedTreeHtml } from "./escaped-html.js";

describe("frame evaluator escaped-tree qualification", () => {
  it("certifies the emitted bytes independently of later authored tree mutation", () => {
    const tree = Frame({ width: 100, height: 100 }, Text("safe text"));
    const evaluator = new FrameEvaluator(video({ duration: "1s", render: () => tree }), {
      captureSemantic: () => {
        (tree as unknown as { type: string }).type = "script";
        return { selected: 1 };
      },
    });
    const result = evaluator.render(0);
    expect(result.tree).toBe(tree);
    expect(result.html).not.toContain("<script");
    expect(isEscapedTreeHtml(result.escapedTree, result.compositeHtml)).toBe(true);
  });
  it("never certifies a script mutated into a primitive by an accessor or semantic callback", () => {
    for (const accessor of [true, false]) {
      const tree = h("script", {}, "unsafe()");
      const mutate = () => { (tree as unknown as { type: string }).type = "Frame"; };
      if (accessor) Object.defineProperty(tree.props, "style", { enumerable: true, get() { mutate(); return ""; } });
      const evaluator = new FrameEvaluator(video({ duration: "1s", render: () => tree }), {
        ...(!accessor ? { captureSemantic: () => { mutate(); return {}; } } : {}),
      });
      const result = evaluator.render(0);
      expect(result.html).toContain("<script");
      expect(result.escapedTree).toBeUndefined();
    }
  });
  it("rejects actual composite additions even when authored config accessors change after rendering", () => {
    const media = video({ duration: "1s", render: () => Frame({}, Text("safe")) });
    let reads = 0;
    Object.defineProperty(media.config, "watermark", { get: () => ++reads === 1
      ? { type: "html", content: "<script>unsafe()</script>" } : undefined });
    const result = new FrameEvaluator(media).render(0);
    expect(result.compositeHtml).toContain("<script");
    expect(result.escapedTree).toBeUndefined();
  });
});
