import { afterEach, describe, expect, it, vi } from "vitest";
import { Frame, Stack, Text } from "./primitives.js";
import { layoutTree } from "./layout.js";
import { lower } from "./lower.js";
import { isMediaElement } from "./h.js";
import { walkMediaTree } from "./walk.js";
import * as measure from "../svg/measure.js";

afterEach(() => vi.restoreAllMocks());

describe("resolved layout typography", () => {
  it("measures nested variants at the same canvas scale that it paints", () => {
    const tree = Frame({ width: 1920, height: 1080 },
      Stack({ width: 600, height: 500, gap: 10, align: "start" },
        Text({ variant: "display" }, "Title"),
        Text({ variant: "body" }, "Body"),
      ),
    );
    const laid = layoutTree(tree);
    const stack = laid.children[0];
    if (!isMediaElement(stack)) throw new Error("Expected stack");
    const heading = stack.children[0];
    const body = stack.children[1];
    if (!isMediaElement(heading) || !isMediaElement(body)) throw new Error("Expected text");
    expect(heading.layout?.height).toBeCloseTo(96 * 1.2);
    expect(body.layout?.y).toBeCloseTo(96 * 1.2 + 10);
    expect(lower(tree)).toContain("font-size:96px");
  });

  it("uses the authored root width when lower options have a different fallback", () => {
    const tree = Frame({ width: 1200, height: 630 }, Text({ variant: "display" }, "Hello"));
    const html = lower(tree, { width: 1920, height: 1080 });
    expect(html).toContain("font-size:60px");
    expect(html).toContain("height:72px");
    expect(html).not.toContain("font-size:96px");
  });

  it("keeps explicit typography and approximate geometry in agreement", () => {
    const tree = Frame({ width: 1920, height: 1080 },
      Text({ size: 30, lineHeight: 1.5, weight: 800, fontFamily: "Custom", letterSpacing: 2 }, "Hello"),
    );
    const html = lower(tree);
    expect(html).toContain("font-size:30px");
    expect(html).toContain("height:45px");
    expect(html).toContain("font-weight:800");
    expect(html).toContain("font-family:Custom");
    expect(html).toContain("letter-spacing:2px");
  });

  it("memoizes intrinsic text measurement only within one layout evaluation", () => {
    const wrap = vi.spyOn(measure, "wrapText");
    const tree = Frame({ width: 1920, height: 1080 },
      Stack({ align: "center" }, Stack({ align: "center" },
        Text({ maxWidth: 500, size: 32 }, "Some measured text"),
      )),
    );
    layoutTree(tree);
    expect(wrap).toHaveBeenCalledTimes(1);
    layoutTree(tree, { width: 1200 });
    expect(wrap).toHaveBeenCalledTimes(2);
  });

  it("exposes the same wrapped lines, padding constraint and metric provenance used by paint", () => {
    const tree = Frame({ width: 400, height: 200 }, Frame({ id: "holder", width: 130, height: 30, pad: 5 }, Text({ id: "copy", size: 20, maxWidth: 100 }, "one two three four")));
    const measurer = { measure: (text: string) => ({ width: text.length * 10, ascent: 16, descent: 4, exact: true }) };
    const exact = walkMediaTree(tree, { measurer }).find(node => node.id === "copy")!;
    expect(exact.textGeometry?.lines.map(line => line.text)).toEqual(["one two", "three four"]);
    expect(exact.textGeometry?.parentContent).toEqual({ x: 5, y: 5, width: 120, height: 20 });
    expect(exact.textGeometry?.lines[1]?.bounds.y).toBe(29);
    expect(exact.textGeometry?.metrics).toBe("font");
    expect(walkMediaTree(tree).find(node => node.id === "copy")?.textGeometry?.metrics).toBe("heuristic");
    expect(lower(tree, { measurer })).toContain("one two<br>three four");
  });

  it("recomputes line evidence when width or text changes across evaluations", () => {
    const sample = (width: number, text: string) => walkMediaTree(Frame({ width: 400, height: 300 }, Frame({ width, height: 200 }, Text({ id: "copy", size: 20 }, text)))).find(node => node.id === "copy")!.textGeometry!;
    expect(sample(100, "wide words wrap here").lines.length).toBeGreaterThan(sample(300, "wide words wrap here").lines.length);
    expect(sample(300, "new content").lines[0]?.text).toBe("new content");
  });

  it("reserves wrapped intrinsic height using the padded inner width", () => {
    const tree = Frame({ width: 400, height: 300 }, Stack({ width: 140 },
      Frame({ id: "holder", width: 120, pad: 10 }, Text({ id: "copy", size: 20 }, "one two three four")),
      Text({ id: "after", size: 20 }, "after")));
    const measurer = { measure: (text: string) => ({ width: text.length * 10, ascent: 16, descent: 4, exact: true }) };
    const nodes = walkMediaTree(tree, { measurer });
    const holder = nodes.find(node => node.id === "holder")!;
    const copy = nodes.find(node => node.id === "copy")!;
    const after = nodes.find(node => node.id === "after")!;
    expect(copy.textGeometry?.lines).toHaveLength(2);
    expect(holder.layout?.height).toBe(68);
    expect(after.layout?.y).toBe(68);
  });
});
