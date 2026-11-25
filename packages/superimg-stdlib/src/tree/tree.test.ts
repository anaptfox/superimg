import { describe, expect, expectTypeOf, it } from "vitest";
import { h, isMediaElement, MEDIA_ELEMENT } from "./h.js";
import {
  Code,
  Frame,
  Stack,
  Text,
  Spacer,
  Safe,
  Fill,
  Image,
  Html,
  Video,
  Plate,
  Vector,
  vector,
  lower,
  walkMediaTree,
  layoutTree,
  type TreeBounds,
  type TreeGeometry,
  type TreeNamespace,
  type TreeNodeSemantics,
  type TreePaint,
  type TreeRelations,
} from "./index.js";

function styleOf(html: string, id: string): string {
  return html.match(new RegExp(`id="${id}"[^>]*style="([^"]*)"`))?.[1] ?? "";
}

function px(style: string, prop: string): number {
  const match = style.match(new RegExp(`${prop}:(-?[\\d.]+)px`));
  return match ? Number(match[1]) : Number.NaN;
}

/** Literal MotionResult. `style` matches director buildStyle (opacity, then transform, then filter). */
function motionPaint(partial: { opacity: number; transform?: string; filter?: string }) {
  const transform = partial.transform ?? "";
  const filter = partial.filter ?? "";
  const style = [
    `opacity:${partial.opacity}`,
    transform ? `transform:${transform}` : "",
    filter ? `filter:${filter}` : "",
  ].filter(Boolean).join(";");
  return {
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0,
    blur: 0,
    opacity: partial.opacity,
    enter: 1,
    exit: 0,
    visible: true,
    phase: "steady" as const,
    transform,
    filter,
    style,
  };
}

describe("h()", () => {
  it("creates a branded element", () => {
    const node = h("h1", { id: "title" }, "Hello");
    expect(isMediaElement(node)).toBe(true);
    expect(node.$$typeof).toBe(MEDIA_ELEMENT);
    expect(node.type).toBe("h1");
    expectTypeOf(node.type).toEqualTypeOf<"h1">();
    expectTypeOf(node.props.id).toEqualTypeOf<"title">();
    expect(node.props.id).toBe("title");
    expect(node.children).toEqual(["Hello"]);
  });

  it("keeps h attributes open while primitive props stay closed", () => {
    const raw = h("circle", { cx: 10, "data-mark": "dot" });
    expect(raw.props.cx).toBe(10);
    if (false) {
      // @ts-expect-error primitive misspellings must fail at author time
      Frame({ widht: 100 });
    }
  });

  it("flattens nested children and drops nullish", () => {
    const node = h("div", null, "a", null, ["b", false, "c"], undefined);
    expect(node.children).toEqual(["a", "b", "c"]);
  });
});

describe("lower()", () => {
  it("keeps raw strings out of root-only tree APIs", () => {
    if (false) {
      // @ts-expect-error raw markup must be wrapped in Html()
      lower("<div>raw</div>");
      // @ts-expect-error the semantic walker accepts branded roots only
      walkMediaTree("<div>raw</div>");
    }
  });

  it("escapes text children", () => {
    const html = lower(h("p", null, "<script>"));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("keeps Html() markup unescaped", () => {
    const html = lower(h("Html", { html: "<b>x</b>" }));
    expect(html).toContain("<b>x</b>");
    expect(html).not.toContain("&lt;b&gt;");
  });

  it("merges MotionResult style", () => {
    const motion = {
      x: 0,
      y: 24,
      scale: 1,
      rotate: 0,
      blur: 0,
      opacity: 0.5,
      enter: 1,
      exit: 0,
      visible: true,
      phase: "steady" as const,
      transform: "translateY(24px)",
      filter: "",
      style: "opacity:0.5;transform:translateY(24px)",
    };
    const html = lower(h("h1", { style: motion }, "Hi"));
    expect(html).toContain("opacity:0.5");
    expect(html).toContain("translateY(24px)");
    expect(html).toContain("Hi");
  });

  it("serializes SVG tags when medium is svg", () => {
    const svg = lower(h("circle", { r: 5, cx: 10, cy: 10 }), "svg");
    expect(svg).toContain("<circle");
    expect(svg).toContain('r="5"');
    expect(svg).not.toContain("<div");
  });

  it("emits nested left/top relative to the parent box", () => {
    const html = lower(
      Frame(
        { width: 400, height: 200, x: 0, y: 0 },
        Frame(
          { id: "outer", x: 40, y: 20, width: 200, height: 100 },
          Frame({ id: "inner", x: 10, y: 8, width: 40, height: 16 }),
        ),
      ),
      { width: 400, height: 200 },
    );
    expect(px(styleOf(html, "outer"), "left")).toBe(40);
    expect(px(styleOf(html, "outer"), "top")).toBe(20);
    expect(px(styleOf(html, "inner"), "left")).toBe(10);
    expect(px(styleOf(html, "inner"), "top")).toBe(8);
  });

  it("keeps inspect boxes canvas-absolute while CSS stays local", () => {
    const tree = Frame(
      { width: 400, height: 200, id: "stage" },
      Frame(
        { id: "outer", x: 40, y: 20, width: 200, height: 100 },
        Frame({ id: "inner", x: 10, y: 8, width: 40, height: 16 }),
      ),
    );
    const inner = walkMediaTree(tree).find((n) => n.id === "inner");
    expect(inner?.layout).toEqual({ x: 50, y: 28, width: 40, height: 16 });
    const html = lower(tree, { width: 400, height: 200 });
    expect(px(styleOf(html, "inner"), "left")).toBe(10);
    expect(px(styleOf(html, "inner"), "top")).toBe(8);
  });

  it("paints Text with font-size so layout boxes match glyphs", () => {
    const html = lower(
      Frame({ width: 400, height: 80 }, Text({ id: "hi", size: 24, weight: 700, align: "center" }, "Hello")),
      { width: 400, height: 80 },
    );
    const style = styleOf(html, "hi");
    expect(style).toContain("font-size:24px");
    expect(style).toContain("font-weight:700");
    expect(style).toContain("white-space:nowrap");
    expect(style).toContain("text-align:center");
    expect(style).toContain("margin:0");
  });

  it("wraps Text when layout wrapped it, and when maxWidth is set", () => {
    const long = lower(
      Frame(
        { width: 400, height: 200 },
        Text({ id: "long", size: 32 }, "alpha beta gamma delta epsilon zeta eta theta"),
      ),
      { width: 400, height: 200 },
    );
    expect(styleOf(long, "long")).toContain("white-space:pre");
    expect(long).toContain("<br>");

    const short = lower(
      Frame({ width: 400, height: 80 }, Text({ id: "short", size: 32 }, "Hi")),
      { width: 400, height: 80 },
    );
    expect(styleOf(short, "short")).toContain("white-space:nowrap");

    const capped = lower(
      Frame({ width: 400, height: 80 }, Text({ id: "cap", size: 16, maxWidth: 120 }, "Hello world from a much longer caption")),
      { width: 400, height: 80 },
    );
    expect(styleOf(capped, "cap")).toContain("white-space:pre");
    expect(capped).toContain("<br>");
  });

  it("composes motion transform in front of an authored object transform", () => {
    const move = motionPaint({
      opacity: 1,
      transform: "translateY(12px) scale(1) rotate(0deg)",
    });
    const html = lower(
      Frame(
        { width: 200, height: 100 },
        h("div", {
          id: "box",
          width: 80,
          height: 40,
          style: { transform: "scale(1.2)" },
          motion: move,
        }),
      ),
      { width: 200, height: 100 },
    );
    const style = styleOf(html, "box");
    expect(style).toContain("transform:translateY(12px) scale(1) rotate(0deg) scale(1.2)");
    expect(style.match(/transform:/g)).toHaveLength(1);
  });

  it("multiplies motion opacity with a string style and keeps other declarations", () => {
    const html = lower(
      Frame(
        { width: 200, height: 100 },
        h("div", {
          id: "box",
          width: 80,
          height: 40,
          style: "opacity:0.5;color:red",
          motion: motionPaint({ opacity: 0.5 }),
        }),
      ),
      { width: 200, height: 100 },
    );
    const style = styleOf(html, "box");
    expect(style).toContain("color:red");
    expect(style).toContain("opacity:0.25");
    expect(style.match(/opacity:/g)).toHaveLength(1);
  });

  it("appends motion style unchanged when authored style does not conflict", () => {
    const html = lower(
      Frame(
        { width: 200, height: 100 },
        h("div", {
          id: "box",
          width: 80,
          height: 40,
          style: { color: "red" },
          motion: motionPaint({ opacity: 1, transform: "translateY(12px)" }),
        }),
      ),
      { width: 200, height: 100 },
    );
    expect(styleOf(html, "box")).toBe(
      "position:absolute;left:0px;top:0px;width:80px;height:40px;box-sizing:border-box;color:red;opacity:1;transform:translateY(12px)",
    );
  });

  it("composes a motion filter ahead of a filter in a style array", () => {
    const html = lower(
      Frame(
        { width: 200, height: 100 },
        h("div", {
          id: "box",
          width: 80,
          height: 40,
          style: [{ filter: "grayscale(1)" }, "color:blue"],
          motion: motionPaint({ opacity: 1, filter: "blur(4px)" }),
        }),
      ),
      { width: 200, height: 100 },
    );
    const style = styleOf(html, "box");
    expect(style).toContain("color:blue");
    expect(style).toContain("filter:blur(4px) grayscale(1)");
    expect(style.match(/filter:/g)).toHaveLength(1);
  });
});

describe("Frame / Stack layout", () => {
  it("assigns boxes to stacked children", () => {
    const tree = Frame(
      { width: 400, height: 200 },
      Stack(
        { gap: 10, pad: 0 },
        Text({ variant: "body", size: 16 }, "A"),
        Text({ variant: "body", size: 16 }, "B"),
      ),
    );
    const laid = layoutTree(tree);
    expect(laid.layout).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    const stack = laid.children.find(isMediaElement);
    expect(stack?.type).toBe("Stack");
    const texts = (stack?.children ?? []).filter(isMediaElement);
    expect(texts).toHaveLength(2);
    expect(texts[0]!.layout?.y).toBe(0);
    expect(texts[1]!.layout?.y).toBeGreaterThan(texts[0]!.layout!.y);
  });

  it("walkMediaTree emits nodes with layout", () => {
    const tree = Frame({ width: 800, height: 400, id: "root" }, Text({ id: "t" }, "Hello"));
    const nodes = walkMediaTree(tree);
    expect(nodes.some((n) => n.id === "root" && n.role === "Frame")).toBe(true);
    expect(nodes.some((n) => n.id === "t" && n.text?.includes("Hello") && n.layout)).toBe(true);
  });

  it("centered stack children shrink to content instead of collapsing", () => {
    const tree = Frame(
      { width: 400, height: 200 },
      Stack(
        { align: "center", justify: "center", gap: 8 },
        Stack({ id: "copy" }, Text({ size: 16 }, "Hello")),
        Frame({ id: "win", width: 200, height: 80 }),
      ),
    );
    const laid = layoutTree(tree);
    const stack = laid.children.find(isMediaElement)!;
    const copy = stack.children.filter(isMediaElement).find((n) => n.props.id === "copy");
    expect(copy?.layout?.width).toBeGreaterThan(20);
    expect(copy?.layout?.width).toBeLessThan(400);
    expect(copy?.layout?.height).toBeGreaterThan(0);
  });

  it("center-justified stack fills the parent so children sit in the middle", () => {
    const tree = Frame(
      { width: 400, height: 200 },
      Stack(
        { align: "center", justify: "center" },
        Frame({ id: "box", width: 40, height: 20 }),
      ),
    );
    const laid = layoutTree(tree);
    const stack = laid.children.find(isMediaElement)!;
    expect(stack.layout).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    const box = stack.children.filter(isMediaElement).find((n) => n.props.id === "box");
    expect(box?.layout?.x).toBe(180);
    expect(box?.layout?.y).toBe(90);
  });

  it("center-aligned stack text fills the row so glyphs share one centerline", () => {
    const tree = Frame(
      { width: 400, height: 200 },
      Stack(
        { align: "center", justify: "center" },
        Text({ id: "title", size: 32 }, "Hello"),
      ),
    );
    const html = lower(tree, { width: 400, height: 200 });
    const style = styleOf(html, "title");
    expect(style).toContain("text-align:center");
    expect(px(style, "width")).toBe(400);
  });

  it("does not imply fill on a default stack", () => {
    const stack = Stack(Text("Hello"));
    expect(stack.props.width).toBeUndefined();
    expect(stack.props.height).toBeUndefined();
  });

  it("implies fill so align/justify center have a box to work in", () => {
    const stack = Stack({ align: "center", justify: "center" }, Text("Hello"));
    expect(stack.props.width).toBe("fill");
    expect(stack.props.height).toBe("fill");
  });

  it("keeps an explicit stack size over implied fill", () => {
    const stack = Stack(
      { align: "center", justify: "center", width: 120, height: 80 },
      Text("Hello"),
    );
    expect(stack.props.width).toBe(120);
    expect(stack.props.height).toBe(80);
  });

  it("implies width fill on a row stack with justify center", () => {
    const stack = Stack(
      { direction: "row", justify: "center" },
      Frame({ width: 10, height: 10 }),
    );
    expect(stack.props.width).toBe("fill");
    expect(stack.props.height).toBeUndefined();
  });

  it("centers mixed-width children on one horizontal axis", () => {
    const tree = Frame(
      { width: 400, height: 200 },
      Stack(
        { align: "center", justify: "center", gap: 8 },
        Frame({ id: "chip", width: 80, height: 20 }),
        Frame({ id: "bar", width: 200, height: 4 }),
      ),
    );
    const laid = layoutTree(tree);
    const stack = laid.children.find(isMediaElement)!;
    const kids = stack.children.filter(isMediaElement);
    const chip = kids.find((n) => n.props.id === "chip")!;
    const bar = kids.find((n) => n.props.id === "bar")!;
    expect(chip.layout!.x + chip.layout!.width / 2).toBe(200);
    expect(bar.layout!.x + bar.layout!.width / 2).toBe(200);
  });

  it("does not stretch text in a start-aligned stack", () => {
    const html = lower(
      Frame({ width: 400, height: 200 }, Stack(Text({ id: "t", size: 16 }, "Hi"))),
      { width: 400, height: 200 },
    );
    const style = styleOf(html, "t");
    expect(style).not.toContain("text-align:center");
    expect(px(style, "width")).toBeLessThan(80);
  });

  it("Spacer consumes leftover space in a row", () => {
    const tree = Frame(
      { width: 300, height: 40 },
      Stack(
        { direction: "row", width: 300, height: 40 },
        Text({ size: 12 }, "L"),
        Spacer(),
        Text({ size: 12 }, "R"),
      ),
    );
    const laid = layoutTree(tree);
    const stack = laid.children.find(isMediaElement)!;
    const kids = stack.children.filter(isMediaElement);
    const spacer = kids.find((k) => k.type === "Spacer");
    expect(spacer?.layout?.width).toBeGreaterThan(10);
  });

  it("Frame siblings overlay; Stack children are laid out in flow", () => {
    const overlay = layoutTree(
      Frame(
        { width: 200, height: 100 },
        Frame({ id: "a", width: 200, height: 40 }),
        Frame({ id: "b", width: 200, height: 40 }),
      ),
    );
    const overlayKids = overlay.children.filter(isMediaElement);
    expect(overlayKids[0]!.layout?.y).toBe(overlayKids[1]!.layout?.y);

    const stacked = layoutTree(
      Frame(
        { width: 200, height: 100 },
        Stack(
          Frame({ id: "a", width: 200, height: 40 }),
          Frame({ id: "b", width: 200, height: 40 }),
        ),
      ),
    );
    const stack = stacked.children.find(isMediaElement)!;
    const stackedKids = stack.children.filter(isMediaElement);
    expect(stackedKids[1]!.layout!.y).toBe(stackedKids[0]!.layout!.y + 40);
  });

  it("window chrome stacks a title bar above fill content", () => {
    const html = lower(
      Frame(
        { id: "window", width: 400, height: 200, pad: 0 },
        Stack(
          { width: "fill", height: "fill" },
          Frame({ id: "bar", height: 44, width: "fill" }),
          Frame({ id: "body", width: "fill", height: "fill" }),
        ),
      ),
      { width: 400, height: 200 },
    );
    expect(px(styleOf(html, "bar"), "top")).toBe(0);
    expect(px(styleOf(html, "bar"), "height")).toBe(44);
    expect(px(styleOf(html, "body"), "top")).toBe(44);
    expect(px(styleOf(html, "body"), "height")).toBe(156);
  });

  it("only explicit fill grows; undefined sizes shrink to content", () => {
    const laid = layoutTree(
      Frame(
        { width: 400, height: 200 },
        Stack(
          { direction: "row", align: "center", gap: 8, width: "fill" },
          Frame({ id: "fixed", width: 80, height: 40 }),
          Frame({ id: "grow", width: "fill", height: 40 }),
        ),
      ),
    );
    const row = laid.children.find(isMediaElement)!;
    const kids = row.children.filter(isMediaElement);
    const fixed = kids.find((n) => n.props.id === "fixed")!;
    const grow = kids.find((n) => n.props.id === "grow")!;
    expect(fixed.layout?.width).toBe(80);
    expect(grow.layout?.width).toBeGreaterThan(200);
  });

  it("omitted Frame size hugs content instead of filling the parent", () => {
    const laid = layoutTree(
      Frame(
        { width: 400, height: 200 },
        Frame({ id: "chip" }, Text({ size: 16 }, "Hi")),
      ),
    );
    const chip = laid.children.filter(isMediaElement).find((n) => n.props.id === "chip");
    expect(chip?.layout?.width).toBeGreaterThan(10);
    expect(chip?.layout?.width).toBeLessThan(200);
  });

  it("throws when Stack is given x or y", () => {
    expect(() =>
      layoutTree(h("Stack", { x: 10, y: 4 }, Text("nope"))),
    ).toThrow(/Stack cannot take x\/y/);
    expect(() => Stack({ x: 10 } as never, Text("nope"))).toThrow(/Stack cannot take x\/y/);
  });

  it("explicit fill still fills the parent", () => {
    const laid = layoutTree(
      Frame(
        { width: 400, height: 200 },
        Frame({ id: "bg", width: "fill", height: "fill" }),
      ),
    );
    const bg = laid.children.filter(isMediaElement).find((n) => n.props.id === "bg");
    expect(bg?.layout?.width).toBe(400);
    expect(bg?.layout?.height).toBe(200);
  });
});

describe("Fill / Image / Video / Html", () => {
  it("lowers Fill color and radial gradient", () => {
    const color = lower(Fill({ id: "stage-bg", color: "#0b0b12" }), { width: 100, height: 80 });
    expect(color).toContain('data-si-primitive="Fill"');
    expect(color).toContain("#0b0b12");
    const grad = lower(
      Fill({
        id: "cta-scrim",
        gradient: {
          kind: "radial",
          at: "50% 50%",
          size: "52% 44%",
          stops: ["rgba(5,5,10,0.82)", "transparent"],
        },
      }),
      { width: 100, height: 80 },
    );
    expect(grad).toContain("radial-gradient");
    expect(grad).toContain("52% 44%");
  });

  it("lowers Image with kenBurns", () => {
    const html = lower(
      Image({ src: "/photo.jpg", kenBurns: 0.5 }),
      { width: 100, height: 80 },
    );
    expect(html).toContain("url(/photo.jpg)");
    expect(html).toContain("scale(");
  });

  it("lowers Video src", () => {
    const html = lower(Video({ src: "/clip.mp4" }), { width: 100, height: 80 });
    expect(html).toContain("<video");
    expect(html).toContain("/clip.mp4");
  });

  it("lowers Plate to a marked box, not a video tag", () => {
    const html = lower(Plate({ src: "mascot.mp4" }), { width: 100, height: 80 });
    expect(html).toContain("data-superimg-plate=\"mascot.mp4\"");
    expect(html).not.toContain("<video");
  });

  it("keeps Html() markup unescaped and boxed", () => {
    const html = lower(
      Html({ id: "widget", width: 480, height: 320, html: "<b>x</b>" }),
      { width: 1920, height: 1080 },
    );
    expect(html).toContain("<b>x</b>");
    expect(html).not.toContain("&lt;b&gt;");
    expect(html).toContain('id="widget"');
    expect(html).toContain("width:480px");
    expect(html).toContain("height:320px");
  });

  it("throws when Html() has no markup", () => {
    expect(() => Html({ html: undefined as unknown as string })).toThrow(/requires an html string/);
  });

  it("defaults Html to a fill-sized opaque box", () => {
    const html = Html({ html: "<b>x</b>" });
    expect(html.props.width).toBe("fill");
    expect(html.props.height).toBe("fill");
  });

  it("lowers a linear Fill", () => {
    const html = lower(
      Fill({
        gradient: { kind: "linear", angle: "165deg", stops: ["#05050a", "#07070c"] },
      }),
      { width: 100, height: 80 },
    );
    expect(html).toContain("linear-gradient");
    expect(html).toContain("165deg");
  });

  it.each([0, 120, -45])("serializes numeric gradient angle %s as CSS degrees", (angle) => {
    const html = lower(Fill({ gradient: { kind: "linear", angle, stops: ["#f00", "#00f"] } }),
      { width: 100, height: 80 });
    expect(html).toContain(`linear-gradient(${angle}deg, #f00, #00f)`);
  });

  it("lowers Image without kenBurns as an img", () => {
    const html = lower(Image({ src: "/still.jpg", fit: "contain" }), { width: 100, height: 80 });
    expect(html).toContain("<img");
    expect(html).toContain("/still.jpg");
    expect(html).toContain("contain");
  });

  it("builds Code and Safe", () => {
    const code = Code({ code: "const x = 1;", lang: "ts" });
    expect(code.type).toBe("Code");
    expect(typeof code.props.html).toBe("string");
    const safe = Safe({ preset: "broadcast" }, Text("y"));
    expect(safe.type).toBe("Safe");
  });
});

describe("Vector / vector", () => {
  it("defaults Vector to the canvas box", () => {
    const vectorRoot = Vector(vector.path({ d: "M0 0 L10 10" }));
    expect(vectorRoot.props.width).toBe("fill");
    expect(vectorRoot.props.height).toBe("fill");
    const laid = layoutTree(vectorRoot, {
      width: 320,
      height: 180,
    });
    expect(laid.layout).toEqual({ x: 0, y: 0, width: 320, height: 180 });
  });

  it("lowers one semantic tree into an embedded SVG namespace", () => {
    const tree = Frame(
      { width: 400, height: 200 },
      Vector(
        { id: "art", width: 200, height: 100, viewBox: { x: 0, y: 0, width: 100, height: 50 } },
        vector.defs(
          vector.mask(
            { id: "fade", mode: "alpha" },
            vector.path({ d: "M0 0 L100 0 L100 50 L0 50 Z", fill: "white" }),
          ),
        ),
        vector.group(
          { id: "diagram", mask: "fade", transform: { x: 5, y: 2 } },
          vector.path({
            id: "edge",
            d: "M0 0 L50 25",
            fill: "none",
            stroke: "#fff",
            strokeWidth: 2,
            strokeLinecap: "round",
          }),
          vector.text(
            { x: 50, y: 30, size: 12, anchor: "middle", family: "Inter" },
            "HELLO ",
            vector.run({ fill: "#f0f", weight: 700 }, "VECTOR"),
          ),
        ),
      ),
    );
    const html = lower(tree, { width: 400, height: 200 });
    expect(html).toContain("<svg");
    expect(html).toContain('viewBox="0 0 100 50"');
    expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(html).toContain('<mask id="fade"');
    expect(html).toContain('mask-type="alpha"');
    expect(html).toContain('mask="url(#fade)"');
    expect(html).toContain('transform="translate(5 2)"');
    expect(html).toContain('stroke-width="2"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain("<text");
    expect(html).toContain("<tspan");
    expect(html).not.toContain("<VectorPath");
  });

  it("lowers Vector as a real root SVG", () => {
    const svg = lower(
      Vector(
        { width: 120, height: 80, fit: "fill" },
        vector.path({ d: "M0 0 L120 80", stroke: "black" }),
      ),
      "svg",
    );
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('preserveAspectRatio="none"');
    expect(svg).not.toContain("position:absolute");
  });

  it("keeps deliberate opaque SVG markup valid and reported", () => {
    const tree = Vector(
      { width: 100, height: 80 },
      Html({ width: 100, height: 80, html: '<circle cx="5" cy="5" r="5"/>' }),
    );
    const svg = lower(tree, "svg");
    expect(svg).toContain('<g data-si-primitive="Html"');
    expect(svg).toContain("</g>");
    expect(svg).toContain('<circle cx="5"');
    expect(svg).not.toContain("<div");
    expect(walkMediaTree(tree).find((node) => node.tag === "Html")?.opaque).toBe(true);
  });

  it("exports the semantic inspection helper types", () => {
    const namespace: TreeNamespace = "svg";
    const bounds: TreeBounds = { x: 0, y: 0, width: 10, height: 20, estimated: true };
    const paint: TreePaint = { fill: "red", strokeWidth: 2 };
    const geometry: TreeGeometry = { kind: "path", d: "M0 0", valid: true };
    const relations: TreeRelations = { clip: "crop", references: ["crop"] };
    const semantics: TreeNodeSemantics = {
      tag: "VectorPath",
      childCount: 0,
      namespace,
      bounds,
      paint,
      geometry,
      relations,
    };
    expect(semantics.namespace).toBe("svg");
  });

  it("walks structural vector semantics without fake layout boxes", () => {
    const tree = Vector(
      { width: 200, height: 100, viewBox: { x: 0, y: 0, width: 100, height: 50 } },
      vector.defs(vector.clip({ id: "crop" }, vector.path({ d: "M0 0 L20 0 L20 20 Z" }))),
      vector.group(
        { id: "moved", transform: "translate(10 5)", clip: "crop" },
        vector.path({ id: "line", d: "M0 0 L0 20", stroke: "red", strokeWidth: 3 }),
      ),
    );
    const nodes = walkMediaTree(tree);
    const root = nodes[0]!;
    const group = nodes.find((node) => node.id === "moved")!;
    const line = nodes.find((node) => node.id === "line")!;
    const clip = nodes.find((node) => node.id === "crop")!;
    expect(root.namespace).toBe("svg");
    expect(group.relations).toEqual({ clip: "crop", references: ["crop"] });
    expect(line.geometry).toMatchObject({ kind: "path", valid: true });
    expect(line.layout).toBeUndefined();
    expect(line.bounds?.width).toBe(0);
    expect(line.bounds?.height).toBeGreaterThan(30);
    expect(line.path).toMatch(/^0\./);
    expect(line.parentPath).toBe(group.path);
    expect(line.depth).toBe((group.depth ?? 0) + 1);
    expect(line.paint).toEqual({ stroke: "red", strokeWidth: 3 });
    expect(clip.childCount).toBe(1);
  });

  it("reports invalid path data without aborting the walk", () => {
    const nodes = walkMediaTree(
      Vector({ width: 100, height: 100 }, vector.path({ id: "bad", d: "not a path" })),
    );
    expect(nodes.find((node) => node.id === "bad")?.geometry).toMatchObject({
      kind: "path",
      valid: false,
    });
  });
});
