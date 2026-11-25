import { describe, expect, it } from "vitest";
import {
  DISPLAY_LIST_KIND,
  DISPLAY_LIST_SCHEMA_VERSION,
  Fill,
  Frame,
  Html,
  Image,
  Instance,
  Scene,
  Stack,
  Text,
  Vector,
  checkNativePortability,
  lowerDisplayList,
  vector,
  visual,
} from "./index.js";
import { createDirector } from "../director.js";
import { interpolate } from "../interpolate.js";
import * as color from "../color.js";
import helloWorld from "../../../../examples/basics/hello-world/hello-world.media.js";

describe("lowerDisplayList", () => {
  it("lowers layout primitives, gradients, rounded borders, clips, motion, opacity, and blendMode", () => {
    const tree = Frame(
      { id: "root", width: 800, height: 600, overflow: "hidden", radius: 16 },
      Fill({
        id: "bg",
        gradient: { kind: "linear", angle: 90, stops: ["#112233 0%", "#445566 100%"] },
      }),
      Stack(
        { id: "card", width: 400, height: 200, pad: 24, gap: 12, fill: "#ffffff", radius: 12, border: "2px solid #17140f" },
        Text(
          { id: "headline", size: 32, weight: 700, align: "center", color: "#17140f", reveal: 0.5 },
          "Hello World!",
        ),
        Fill({
          id: "bar",
          width: 200,
          height: 20,
          color: "#e2452b",
          opacity: 0.8,
          blendMode: "multiply",
          motion: { style: "", x: 10, y: 5, scale: 1, rotate: 0, opacity: 0.5, phase: "steady" },
        }),
      ),
    );

    const frame = lowerDisplayList(tree, { width: 800, height: 600 });
    expect(frame.kind).toBe(DISPLAY_LIST_KIND);
    expect(frame.schemaVersion).toBe(DISPLAY_LIST_SCHEMA_VERSION);
    expect(frame.issues).toEqual([]);

    const bg = frame.ops.find((op) => op.id === "bg");
    expect(bg?.kind).toBe("rect");
    if (bg?.kind === "rect") {
      expect(bg.fill?.kind).toBe("linearGradient");
      expect(bg.clips).toEqual([{ x: 0, y: 0, width: 800, height: 600, radius: 16 }]);
    }

    const card = frame.ops.find((op) => op.id === "card");
    expect(card?.kind).toBe("rect");
    if (card?.kind === "rect") {
      expect(card.radius).toBe(12);
      expect(card.stroke).toEqual({ color: "#17140f", width: 2 });
    }

    const headline = frame.ops.find((op) => op.id === "headline");
    expect(headline?.kind).toBe("text");
    if (headline?.kind === "text") {
      expect(headline.lines[0]?.text).toBe("Hello ");
      expect(headline.align).toBe("center");
      expect(headline.color).toBe("#17140f");
    }

    const bar = frame.ops.find((op) => op.id === "bar");
    expect(bar?.kind).toBe("rect");
    if (bar?.kind === "rect") {
      expect(bar.blendMode).toBe("multiply");
      expect(bar.opacity).toBeCloseTo(0.4, 4);
      expect(bar.matrix?.e).toBe(10);
      expect(bar.matrix?.f).toBe(5);
    }
  });

  it("lowers Vector primitives, paths, lines, polygons, and VectorDefs gradients", () => {
    const tree = Frame(
      { id: "stage", width: 400, height: 400 },
      Vector(
        { id: "art", width: 400, height: 400, viewBox: { x: 0, y: 0, width: 200, height: 200 }, fit: "fill" },
        vector.defs(
          vector.linearGradient(
            { id: "grad1", x1: 0, y1: 0, x2: 1, y2: 1 },
            vector.stop({ offset: 0, stopColor: "#ff0000" }),
            vector.stop({ offset: "100%", stopColor: "#0000ff" }),
          ),
        ),
        vector.rect({ id: "r", x: 10, y: 10, width: 50, height: 40, rx: 6, fill: "url(#grad1)" }),
        vector.circle({ id: "c", cx: 100, cy: 100, r: 25, fill: "#00ff00", stroke: "#000000", strokeWidth: 2 }),
        vector.line({ id: "l", x1: 0, y1: 0, x2: 100, y2: 50, stroke: "#111111", strokeWidth: 3 }),
        vector.polygon({ id: "p", points: [[0, 0], [50, 0], [25, 40]], fill: "#abcdef" }),
        vector.path({ id: "custom", d: "M 0 0 L 20 20 Z", fill: "#123456" }),
      ),
    );

    const frame = lowerDisplayList(tree, { width: 400, height: 400 });
    expect(frame.issues).toEqual([]);
    const rect = frame.ops.find((o) => o.id === "r");
    expect(rect?.kind).toBe("rect");
    if (rect?.kind === "rect") {
      expect(rect.fill?.kind).toBe("linearGradient");
      expect(rect.matrix?.a).toBe(2);
      expect(rect.matrix?.d).toBe(2);
    }
    expect(frame.ops.find((o) => o.id === "c")?.kind).toBe("ellipse");
    const line = frame.ops.find((o) => o.id === "l");
    expect(line?.kind).toBe("path");
    if (line?.kind === "path") expect(line.d).toBe("M 0 0 L 100 50");
    const poly = frame.ops.find((o) => o.id === "p");
    expect(poly?.kind).toBe("path");
    if (poly?.kind === "path") expect(poly.d).toBe("M 0 0 L 50 0 L 25 40 Z");
  });

  it("lowers a spatial Scene preserving matrices, sprites, and visible anchors", () => {
    const nell = visual<null>({
      id: "nell",
      render: () => ({
        anchors: { talk: { x: 0, y: -28 } },
        parts: [
          {
            id: "shadow",
            band: -0.5,
            bounds: { x: -10, y: -3, width: 20, height: 6 },
            content: vector.ellipse({ rx: 10, ry: 3, fill: "#142b25" }),
          },
          {
            id: "body",
            bounds: { x: -8, y: -24, width: 16, height: 24 },
            content: Image({ src: "nell", fit: "fill" }),
          },
        ],
      }),
    });

    const tree = Scene(
      { id: "meadow", width: 200, height: 100 },
      Instance({ id: "nell", entityId: "nell", of: nell, data: null, at: { x: 120, y: 60 }, semantic: { space: "screen" } }),
    );

    const frame = lowerDisplayList(tree, { width: 200, height: 100 });
    expect(frame.issues).toEqual([]);
    expect(frame.ops.some((o) => o.kind === "ellipse")).toBe(true);
    const sprite = frame.ops.find((o) => o.kind === "image");
    expect(sprite?.kind).toBe("image");
    if (sprite?.kind === "image") {
      expect(sprite.asset).toBe("nell");
      expect(sprite.fit).toBe("fill");
    }
    expect(frame.anchors).toEqual([{ entity: "nell", name: "talk", x: 120, y: 32 }]);
  });

  it("lowers hello-world.media.ts cleanly across enter, hold, and exit with zero issues", () => {
    const renderAt = (seconds: number) => {
      const durationSeconds = 5.5;
      const fps = 30;
      const totalFrames = Math.ceil(durationSeconds * fps);
      const frame = Math.min(totalFrames - 1, Math.round(seconds * fps));
      const timeline = {
        frame,
        fps,
        totalFrames,
        durationSeconds,
        seconds,
        progress: seconds / durationSeconds,
      };
      const ctx = {
        width: 1920,
        height: 1080,
        fps,
        timeline,
        data: { title: "Cross-OS SuperImg", accent: "#E2452B" },
        director: (phases?: Record<string, string>) => createDirector({ timeline, fps }, phases),
        std: { interpolate, color },
      };
      const tree = helloWorld.render(ctx as never);
      expect(checkNativePortability(tree).portable).toBe(true);
      return lowerDisplayList(tree, { width: 1920, height: 1080, strict: true });
    };

    const enterFrame = renderAt(0.4);
    const holdFrame = renderAt(2.5);
    const exitFrame = renderAt(5.2);

    expect(holdFrame.issues).toEqual([]);
    const title = holdFrame.ops.find((o) => o.id === "title");
    expect(title?.kind).toBe("text");
    if (title?.kind === "text") {
      expect(title.lines.map((l) => l.text).join(" ")).toContain("Cross-OS SuperImg");
    }
    const cool = holdFrame.ops.find((o) => o.id === "ink-cool");
    expect(cool?.kind).toBe("rect");
    if (cool?.kind === "rect") {
      expect(cool.blendMode).toBe("multiply");
      expect(cool.opacity).toBe(1);
    }
    const coolEnter = enterFrame.ops.find((o) => o.id === "ink-cool");
    const coolExit = exitFrame.ops.find((o) => o.id === "ink-cool");
    expect(coolEnter && cool && coolEnter.bounds.width < cool.bounds.width).toBe(true);
    expect(coolExit && coolExit.opacity < 1).toBe(true);
  });

  it("records structured issues for browser-only nodes and throws in strict mode", () => {
    const tree = Frame(
      { id: "root", width: 400, height: 300 },
      Html({ id: "web-only", width: 200, height: 100, html: "<div>hi</div>" }),
    );
    const frame = lowerDisplayList(tree, { width: 400, height: 300 });
    expect(frame.issues).toEqual([
      {
        nodeId: "web-only",
        code: "UNSUPPORTED_NODE",
        message: "Html is browser-only and cannot be lowered to DisplayList",
      },
    ]);
    expect(() => lowerDisplayList(tree, { width: 400, height: 300, strict: true })).toThrow(/UNSUPPORTED_NODE/);
  });
});
