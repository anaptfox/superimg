import { describe, it, expect, expectTypeOf } from "vitest";
import {
  layout,
  defineChart,
  lineY,
  barY,
  barX,
  scaleLinear,
  scaleBand,
} from "./index.js";
import { Vector } from "../tree/vector.js";
import { lowerSvg } from "../tree/lower-svg.js";
const size = {
  id: "chart",
  width: 960,
  height: 540,
};
const data = [
  {
    id: "a",
    x: 0,
    y: -5,
  },
  {
    id: "b",
    x: 1,
    y: 8,
  },
  {
    id: "c",
    x: 2,
    y: 12,
  },
];
function line(rows = data) {
  return defineChart({
    marks: [
      lineY(rows, {
        id: "trend",
        key: "id",
        x: "x",
        y: "y",
      }),
    ],
    scales: {
      x: { scale: scaleLinear().domain([0, 2]) },
      y: { scale: scaleLinear().domain([-10, 15]) },
    },
  });
}
function bars(horizontal = false) {
  return defineChart({
    marks: [
      horizontal
        ? barX(data, {
            id: "bars",
            key: "id",
            x: "y",
            y: "id",
          })
        : barY(data, {
            id: "bars",
            key: "id",
            x: "id",
            y: "y",
          }),
    ],
    scales: horizontal
      ? {
          x: { scale: scaleLinear().domain([-10, 15]) },
          y: { scale: scaleBand().domain(["a", "b", "c"]) },
        }
      : {
          x: { scale: scaleBand().domain(["a", "b", "c"]) },
          y: { scale: scaleLinear().domain([-10, 15]) },
        },
  });
}
describe("typed charts", () => {
  it("retains datum identity, shared scales and inspectable artwork", () => {
    const result = layout(line(), size);
    expectTypeOf(result.points[0]!.datum).toEqualTypeOf<
      (typeof data)[number]
    >();
    expect(result.points).toHaveLength(3);
    expect(result.points[0]!.datum).toBe(data[0]);
    expect(result.point(result.points[0]!.key)).toBe(result.points[0]);
    expect(result.project("x", 0)).toBe(result.points[0]!.x);
    const mark = result.mark("trend").find((n) => n.kind === "polyline")!;
    const sampled = result.pathPoint(mark.key, 0);
    expect(sampled.x).toBeCloseTo(result.points[0]!.x);
    expect(sampled.y).toBeCloseTo(result.points[0]!.y);
    const svg = lowerSvg(result.artwork);
    expect(svg).toContain("<path");
    expect(svg).toContain("#2563eb");
    expect(svg).toContain("Arial");
    expect(svg).not.toMatch(/NaN|foreignObject|<script/);
    expect(result.diagnostics[0]!.code).toBe("APPROXIMATE_TEXT_METRICS");
  });
  it("samples animated lines in any order without changing final semantic geometry", () => {
    const snapshots = new Map(
      [0, 0.25, 0.5, 0.75, 1].map((p) => [
        p,
        lowerSvg(
          layout(line(), { ...size, motion: { lineReveal: p } }).artwork,
        ),
      ]),
    );
    for (const p of [1, 0.75, 0.5, 0.25, 0, 0.5, 1, 0])
      expect(
        lowerSvg(
          layout(line(), { ...size, motion: { lineReveal: p } }).artwork,
        ),
      ).toBe(snapshots.get(p));
    expect(
      layout(line(), { ...size, motion: { lineReveal: 0 } }).points,
    ).toEqual(layout(line(), size).points);
  });
  it.each([false, true])(
    "grows mixed-sign bars from their resolved baseline, horizontal=%s",
    (horizontal) => {
      const full = layout(bars(horizontal), size),
        empty = layout(bars(horizontal), { ...size, motion: { barsGrow: 0 } });
      const finalSvg = lowerSvg(full.artwork);
      expect(finalSvg).not.toContain("NaN");
      const svg = lowerSvg(empty.artwork);
      expect(svg).toContain(horizontal ? 'width="0"' : 'height="0"');
      const frames = new Map(
        [0, 0.5, 1].map((p) => [
          p,
          lowerSvg(
            layout(bars(horizontal), { ...size, motion: { barsGrow: p } })
              .artwork,
          ),
        ]),
      );
      for (const p of [1, 0, 0.5, 0, 1])
        expect(
          lowerSvg(
            layout(bars(horizontal), { ...size, motion: { barsGrow: p } })
              .artwork,
          ),
        ).toBe(frames.get(p));
    },
  );
  it("preserves gaps without creating phantom semantic points", () => {
    const result = layout(
      line([
        {
          id: "a",
          x: 0,
          y: 2,
        },
        {
          id: "gap",
          x: 1,
          y: NaN,
        },
        {
          id: "c",
          x: 2,
          y: 4,
        },
      ]),
      size,
    );
    expect(result.points).toHaveLength(2);
    expect(
      result.mark("trend").filter((n) => n.kind === "polyline"),
    ).toHaveLength(2);
  });
  it("scopes every occurrence without lossy id sanitization", () => {
    const one = lowerSvg(
      Vector(
        { width: 1920, height: 540 },
        layout(line(), { ...size, id: "a:b" }).artwork,
        layout(line(), { ...size, id: "a-b" }).artwork,
      ),
    );
    const ids = (s: string) =>
      [...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids(one)).size).toBe(ids(one).length);
  });
  it("rejects duplicate datum keys, invalid dimensions, and invalid sampling", () => {
    expect(() =>
      layout(
        line([
          {
            id: "same",
            x: 0,
            y: 1,
          },
          {
            id: "same",
            x: 1,
            y: 2,
          },
        ]),
        size,
      ),
    ).toThrow(/Duplicate/);
    expect(() => layout(line(), { ...size, width: Infinity })).toThrow(
      /finite/,
    );
    expect(() => layout(line(), { ...size, width: 0 })).toThrow(/positive/);
    expect(() =>
      layout(line(), { ...size, motion: { lineReveal: NaN } }),
    ).toThrow(/finite/);
    expect(() => layout(line(), size).pathPoint("missing", 0)).toThrow(
      /Unknown path/,
    );
  });
  it("rejects unsupported paint instead of silently changing it", () => {
    const def = line();
    expect(() =>
      layout({ ...def, theme: { foreground: "currentColor" } }, size),
    ).toThrow(/solid colors/);
  });
  it("uses supplied text metrics and propagates explicit font family", () => {
    const result = layout(line(), {
      ...size,
      typography: { fontFamily: "Example Sans" },
      measureText: (text, o) => ({
        x: 0,
        y: -o.fontSize,
        width: text.length * o.fontSize * 0.6,
        height: o.fontSize,
      }),
    });
    expect(result.diagnostics).toEqual([]);
    expect(lowerSvg(result.artwork)).toContain("Example Sans");
  });
});
import type {
  SceneNode,
  ChartMark,
  StaticChartDefinition,
} from "@tanstack/charts/types/core";
function synthetic(nodes: readonly SceneNode[]) {
  const mark: ChartMark = {
    initialize: () => ({
      id: "synthetic",
      channels: {},
      render: () => ({ nodes }),
    }),
  };
  return {
    marks: [mark],
    scales: { x: null, y: null },
  } satisfies StaticChartDefinition;
}
describe("scene geometry fidelity", () => {
  it("retains nested translations, clips, polygon holes and independent round corners", () => {
    const def = synthetic([
      {
        kind: "group",
        key: "nested",
        translateX: 20,
        translateY: 30,
        clip: {
          x: 0,
          y: 0,
          width: 100,
          height: 80,
        },
        children: [
          {
            kind: "area",
            key: "holes",
            points: [[999, 999]],
            path: "M999,999",
            polygons: [
              [
                [
                  [0, 0],
                  [20, 0],
                  [20, 20],
                ],
                [
                  [3, 3],
                  [7, 3],
                  [7, 7],
                ],
              ],
            ],
            style: { fill: "#2563eb" },
          },
          {
            kind: "rect",
            key: "corners",
            x: 5,
            y: 5,
            width: 60,
            height: 30,
            cornerRadii: [20, 0, 5, 0],
          },
          {
            kind: "label",
            key: "rotated",
            text: "Hello",
            x: 10,
            y: 15,
            rotate: 45,
            anchor: "end",
            baseline: "hanging",
          },
          {
            kind: "polyline",
            key: "curve",
            points: [],
            path: "M0,0C0,10 10,10 10,0",
          },
        ],
      },
    ]);
    const result = layout(def, size),
      svg = lowerSvg(result.artwork);
    expect(svg).toContain("translate(20 30)");
    expect(svg).toContain('clip-path="url(#chart-');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).not.toContain("M999,999");
    expect(svg).toContain("A20,20");
    expect(svg).toContain("rotate(45 10 15)");
    expect(svg).toContain('text-anchor="end"');
    expect(result.pathPoint("curve", 0)).toEqual({ x: 20, y: 30 });
    expect(result.pathPoint("curve", 1)).toEqual({ x: 30, y: 30 });
  });
  it("rejects unsafe custom scene features and nonfinite geometry", () => {
    expect(() =>
      layout(
        synthetic([
          {
            kind: "rule",
            key: "bad",
            x1: 0,
            y1: 0,
            x2: NaN,
            y2: 1,
          },
        ]),
        size,
      ),
    ).toThrow(/finite/);
    expect(() =>
      layout(
        synthetic([
          {
            kind: "dot",
            key: "bad",
            x: 0,
            y: 0,
            radius: 2,
            style: { lineJoin: "arcs" },
          },
        ]),
        size,
      ),
    ).toThrow(/Unsupported join/);
    expect(() =>
      layout(
        synthetic([
          {
            kind: "group",
            key: "bad",
            children: [],
            focus: {
              match: "primary",
              points: [],
              placement: "over",
            },
          },
        ]),
        size,
      ),
    ).toThrow(/focus/);
    expect(() =>
      layout(
        synthetic([
          {
            kind: "dot",
            key: "same",
            x: 0,
            y: 0,
            radius: 1,
          },
          {
            kind: "dot",
            key: "same",
            x: 1,
            y: 1,
            radius: 1,
          },
        ]),
        size,
      ),
    ).toThrow(/Duplicate scene/);
  });
  it("preserves later-only categories and stacked endpoints", () => {
    const rows = [
      {
        id: "a1",
        category: "A",
        series: "one",
        value: 12,
      },
      {
        id: "a2",
        category: "A",
        series: "two",
        value: 8,
      },
      {
        id: "b2",
        category: "B",
        series: "two",
        value: -4,
      },
    ];
    const def = defineChart({
      marks: [
        barY(rows, {
          id: "stack",
          x: "category",
          y: "value",
          color: "series",
          key: "id",
        }),
      ],
      scales: { x: { scale: scaleBand }, y: { scale: scaleLinear } },
    });
    const result = layout(def, size);
    expect(result.scene.scales.x!.domain).toEqual(["A", "B"]);
    expect(result.points.map((p) => [p.y1Value, p.y2Value])).toEqual([
      [0, 12],
      [12, 20],
      [-4, 0],
    ]);
    const zero = layout(def, { ...size, motion: { barsGrow: 0 } });
    const source = lowerSvg(zero.artwork);
    expect(source).toContain(`y="${result.project("y", 0)}"`);
  });
});

describe("named scales and motion baselines", () => {
  it.each([false, true])(
    "grows from opposite semantic edge with named scales, horizontal=%s",
    (horizontal) => {
      const mark = horizontal
        ? barX(data, {
            id: "named",
            key: "id",
            x: "y",
            y: "id",
            xScale: "values",
            yScale: "categories",
          })
        : barY(data, {
            id: "named",
            key: "id",
            x: "id",
            y: "y",
            xScale: "categories",
            yScale: "values",
          });
      const definition = defineChart({
        marks: [mark],
        scales: {
          x: null,
          y: null,
          values: {
            channel: horizontal ? "x" : "y",
            scale: scaleLinear().domain([-10, 15]),
          },
          categories: {
            channel: horizontal ? "y" : "x",
            scale: scaleBand().domain(["a", "b", "c"]),
          },
        },
      });
      const chart = layout(definition, { ...size, motion: { barsGrow: 0 } });
      const svg = lowerSvg(chart.artwork);
      expect(svg).not.toContain("NaN");
      const zero = chart.project("values", 0);
      const rendered = svg
        .match(/<rect[^>]*>/g)!
        .filter((rect) => rect.includes('data-si-primitive="VectorRect"'));
      expect(rendered).toHaveLength(3);
      for (const rect of rendered) {
        expect(rect).toContain(`${horizontal ? "x" : "y"}="${zero}"`);
        expect(rect).toContain(`${horizontal ? "width" : "height"}="0"`);
      }
    },
  );
});

it("samples singleton line segments at their actual datum coordinates", () => {
  const chart = layout(
    line([
      { id: "a", x: 0, y: 2 },
      { id: "gap", x: 1, y: NaN },
      { id: "c", x: 2, y: 4 },
    ]),
    size,
  );
  const lines = chart.mark("trend").filter((node) => node.kind === "polyline");
  for (const [index, node] of lines.entries()) {
    expect(chart.pathPoint(node.key, 0)).toEqual({
      x: chart.points[index]!.x,
      y: chart.points[index]!.y,
    });
    expect(chart.pathPoint(node.key, 1)).toEqual(chart.pathPoint(node.key, 0));
  }
});

it("keeps dots hidden until line completion and rejects unsupported filled reveal", () => {
  const chart = layout(
    synthetic([{ kind: "dot", key: "dot", x: 5, y: 6, radius: 3 }]),
    { ...size, motion: { lineReveal: 0 } },
  );
  expect(lowerSvg(chart.artwork)).toContain('opacity="0"');
  expect(() =>
    layout(
      synthetic([
        {
          kind: "area",
          key: "area",
          points: [
            [0, 0],
            [5, 0],
            [5, 5],
          ],
        },
      ]),
      { ...size, motion: { lineReveal: 0.5 } },
    ),
  ).toThrow(/Area reveal/);
});
