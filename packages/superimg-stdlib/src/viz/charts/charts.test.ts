import { describe, it, expect } from "vitest";
import { createCoords } from "../coords.js";
import { line, lineTime } from "./line.js";
import { treemap, pack, sunburst } from "./hierarchy.js";
import { contour, density } from "./contour.js";
import { force } from "./force.js";
import { bar } from "./bar.js";
import { barHorizontal } from "./bar-horizontal.js";
import { barRace } from "./bar-race.js";
import { bars } from "./bars.js";
import { lines } from "./lines.js";
import { pie } from "./pie.js";
import { scatter } from "./scatter.js";
import { sparkline } from "./sparkline.js";
import { legend } from "./legend.js";
import { area } from "./area.js";
import { stack } from "./stack.js";
import { chartScales, DEFAULT_CHART_COLORS, plotArea } from "./shared.js";

const SAMPLE = [
  { label: "A", value: 10 },
  { label: "B", value: 30 },
  { label: "C", value: 20 },
  { label: "D", value: 50 },
];

function chartCoords() {
  return createCoords({
    width: 400,
    height: 300,
    xRange: [0, 4],
    yRange: [0, 60],
    padding: { top: 20, bottom: 40, left: 40, right: 20 },
  });
}

describe("charts.shared", () => {
  it("chartScales maps values to coords yRange", () => {
    const coords = chartCoords();
    const area = plotArea(coords);
    const scales = chartScales(coords, area);
    expect(scales.y(30)).toBeCloseTo(area.top + area.height / 2, 0);
    expect(scales.y(60)).toBeCloseTo(area.top, 0);
    expect(scales.y(0)).toBeCloseTo(area.top + area.height, 0);
  });
});

describe("charts.line", () => {
  it("renders a stroke path", () => {
    const svg = line(chartCoords(), SAMPLE);
    expect(svg).toContain("<path");
    expect(svg).toContain('stroke="#5b8cff"');
  });

  it("draw animation uses real path length, not n*40 heuristic", () => {
    const coords = chartCoords();
    const full = line(coords, SAMPLE, { animate: "draw", progress: 1 });
    const half = line(coords, SAMPLE, { animate: "draw", progress: 0.5 });
    const naiveLen = SAMPLE.length * 40;

    const dashFull = full.match(/stroke-dasharray="([^"]+)"/)?.[1];
    const dashHalf = half.match(/stroke-dashoffset="([^"]+)"/)?.[1];
    expect(Number(dashFull)).toBeGreaterThan(naiveLen);
    expect(Number(dashHalf)).toBeGreaterThan(0);
    expect(Number(dashHalf)).toBeLessThan(Number(dashFull));
  });

  it("showLabels renders category labels", () => {
    const svg = line(chartCoords(), SAMPLE, { showLabels: true });
    expect(svg).not.toContain(">Jan<");
    expect(svg).toContain(">A<");
    expect(svg).toContain(">D<");
  });

  it("fill mode adds area path", () => {
    const svg = line(chartCoords(), SAMPLE, { fill: true, animate: "draw", progress: 0.5 });
    expect(svg).toContain("<clipPath");
    expect(svg).toContain('opacity="0.350"');
    expect(svg).toContain("stroke-dasharray");
  });

  it("fill grow mode scales fill opacity", () => {
    const low = line(chartCoords(), SAMPLE, { fill: true, animate: "grow", progress: 0.2 });
    const high = line(chartCoords(), SAMPLE, { fill: true, animate: "grow", progress: 1 });
    expect(low).toContain('opacity="0.070"');
    expect(high).toContain('opacity="0.350"');
  });
});

describe("charts.bar", () => {
  it("renders rects per datum", () => {
    const svg = bar(chartCoords(), SAMPLE);
    expect((svg.match(/<rect/g) ?? []).length).toBe(SAMPLE.length);
  });

  it("showLabels renders category text", () => {
    const svg = bar(chartCoords(), SAMPLE, { showLabels: true });
    expect(svg).toContain(">A<");
    expect(svg).toContain(">D<");
  });

  it("aligns bar height to coords yRange not data max", () => {
    const coords = chartCoords();
    const half = [{ label: "X", value: 30 }];
    const svg = bar(coords, half);
    const yMatch = svg.match(/y="([\d.]+)"/);
    const hMatch = svg.match(/height="([\d.]+)"/);
    const area = plotArea(coords, 8);
    const expectedH = area.height / 2;
    expect(Number(hMatch?.[1])).toBeCloseTo(expectedH, 0);
    expect(Number(yMatch?.[1])).toBeCloseTo(area.top + area.height / 2, 0);
  });

  it("grow animation scales bar height with progress", () => {
    const coords = chartCoords();
    const low = bar(coords, [{ label: "X", value: 60 }], { animate: "grow", progress: 0.5 });
    const high = bar(coords, [{ label: "X", value: 60 }], { animate: "grow", progress: 1 });
    const hLow = Number(low.match(/height="([\d.]+)"/)?.[1]);
    const hHigh = Number(high.match(/height="([\d.]+)"/)?.[1]);
    expect(hLow).toBeCloseTo(hHigh / 2, 0);
  });
});

describe("charts.barHorizontal", () => {
  it("renders horizontal rects", () => {
    const svg = barHorizontal(chartCoords(), SAMPLE, { showLabels: true });
    expect((svg.match(/<rect/g) ?? []).length).toBe(SAMPLE.length);
    expect(svg).toContain(">A<");
  });
});

describe("charts.barRace", () => {
  const keyframes = [
    { time: 0, rankings: [{ label: "Alpha", value: 40 }, { label: "Bravo", value: 60 }] },
    { time: 3, rankings: [{ label: "Alpha", value: 80 }, { label: "Bravo", value: 50 }] },
  ];

  function labelY(svg: string, label: string): number | undefined {
    const marker = `>${label}</text>`;
    const labelIdx = svg.indexOf(marker);
    if (labelIdx < 0) return undefined;
    const chunk = svg.slice(Math.max(0, labelIdx - 120), labelIdx);
    const matches = chunk.match(/y="([\d.]+)"/g);
    if (!matches?.length) return undefined;
    const last = matches[matches.length - 1]!.match(/[\d.]+/)?.[0];
    return last ? Number(last) : undefined;
  }

  it("renders bars at interpolated time", () => {
    const svg = barRace(chartCoords(), keyframes, 1.5, { showLabels: true });
    expect(svg).toContain("<rect");
    expect(svg).toContain("Alpha");
    expect(svg).toContain("Bravo");
  });

  it("order changes between start and end", () => {
    const early = barRace(chartCoords(), keyframes, 0, { showLabels: true });
    const late = barRace(chartCoords(), keyframes, 3, { showLabels: true });
    expect(labelY(early, "Bravo")!).toBeLessThan(labelY(early, "Alpha")!);
    expect(labelY(late, "Alpha")!).toBeLessThan(labelY(late, "Bravo")!);
  });

  it("keeps stable fill per label across time", () => {
    const opts = {
      colorByLabel: { Alpha: "#aa0000", Bravo: "#00aa00" },
      showLabels: true,
    };
    const early = barRace(chartCoords(), keyframes, 0, opts);
    const late = barRace(chartCoords(), keyframes, 3, opts);
    expect(early).toContain('fill="#aa0000"');
    expect(early).toContain('fill="#00aa00"');
    expect(late).toContain('fill="#aa0000"');
    expect(late).toContain('fill="#00aa00"');
  });

  it("interpolates vertical position between keyframes", () => {
    const y0 = labelY(barRace(chartCoords(), keyframes, 0, { showLabels: true }), "Alpha");
    const yMid = labelY(barRace(chartCoords(), keyframes, 1.5, { showLabels: true }), "Alpha");
    const y3 = labelY(barRace(chartCoords(), keyframes, 3, { showLabels: true }), "Alpha");
    expect(y0).toBeDefined();
    expect(yMid).toBeDefined();
    expect(y3).toBeDefined();
    expect(yMid!).toBeLessThan(y0!);
    expect(yMid!).toBeGreaterThan(y3!);
  });
});

describe("charts.sparkline", () => {
  it("renders stroke path in box", () => {
    const svg = sparkline({ x: 10, y: 20, width: 100, height: 40 }, [1, 3, 2, 5], {
      color: "#fff",
      progress: 1,
    });
    expect(svg).toContain("<path");
    expect(svg).toContain('stroke="#fff"');
  });

  it("draw mode uses dash attrs", () => {
    const svg = sparkline({ x: 0, y: 0, width: 100, height: 40 }, [1, 5, 3], {
      animate: "draw",
      progress: 0.5,
    });
    expect(svg).toContain("stroke-dasharray");
  });
});

describe("charts.lineTime", () => {
  const data = [
    { date: "2024-01-01", value: 10 },
    { date: "2024-03-01", value: 30 },
    { date: "2024-06-01", value: 50 },
  ];

  it("renders time-series path", () => {
    const svg = lineTime(chartCoords(), data);
    expect(svg).toContain("<path");
  });

  it("fill mode adds fill path", () => {
    const svg = lineTime(chartCoords(), data, { fill: true });
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("charts.hierarchy", () => {
  const data = [
    { label: "Eng", value: 40 },
    { label: "Design", value: 25 },
    { label: "Ops", value: 15 },
    { label: "Sales", value: 20 },
  ];
  const box = { x: 10, y: 10, width: 300, height: 200 };

  it("treemap renders rects", () => {
    const svg = treemap(box, data, { showLabels: true });
    expect((svg.match(/<rect/g) ?? []).length).toBe(4);
    expect(svg).toContain("Eng");
  });

  it("pack renders circles", () => {
    const svg = pack(box, data);
    expect((svg.match(/<circle/g) ?? []).length).toBe(4);
  });

  it("sunburst renders arc paths", () => {
    const svg = sunburst(box, data, { progress: 1 });
    expect((svg.match(/<path/g) ?? []).length).toBe(4);
  });
});

describe("charts.contour", () => {
  const coords = chartCoords();
  const grid = Array.from({ length: 10 }, (_, row) =>
    Array.from({ length: 10 }, (_, col) => Math.sin(col * 0.5) * Math.cos(row * 0.5)),
  );

  it("contour renders paths from grid", () => {
    const svg = contour(coords, grid, 5);
    expect(svg).toContain("<path");
  });

  it("density renders paths from points", () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({
      x: (i % 6) * 0.6,
      y: Math.floor(i / 6) * 12 + Math.random() * 4,
    }));
    const svg = density(coords, pts, { progress: 1 });
    expect(svg).toContain("<path");
  });
});

describe("charts.force", () => {
  const box = { x: 0, y: 0, width: 400, height: 300 };
  const nodes = [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ];
  const links = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "c", target: "a" },
  ];

  it("renders nodes and edges", () => {
    const svg = force(box, nodes, links, 0, { progress: 1, showLabels: true });
    expect((svg.match(/<circle/g) ?? []).length).toBe(3);
    expect((svg.match(/<line/g) ?? []).length).toBe(3);
    expect(svg).toContain(">A<");
  });

  it("positions change over time", () => {
    const early = force(box, nodes, links, 0, { progress: 0.1, ticks: 30 });
    const late = force(box, nodes, links, 2, { progress: 1, ticks: 300 });
    expect(early).not.toBe(late);
  });
});

describe("charts.lines", () => {
  it("renders multiple series", () => {
    const series = [
      { id: "A", data: SAMPLE },
      { id: "B", data: SAMPLE.map((d) => ({ ...d, value: d.value * 0.5 })) },
    ];
    const svg = lines(chartCoords(), series);
    expect((svg.match(/<path/g) ?? []).length).toBe(2);
  });
});

describe("charts.bars", () => {
  it("renders grouped bars", () => {
    const series = [
      { id: "2023", data: SAMPLE, color: "#5b8cff" },
      { id: "2024", data: SAMPLE.map((d) => ({ ...d, value: d.value + 5 })), color: "#4fd1c5" },
    ];
    const svg = bars(chartCoords(), series);
    expect((svg.match(/<rect/g) ?? []).length).toBe(SAMPLE.length * 2);
  });
});

describe("charts.pie", () => {
  const segments = [
    { label: "Eng", value: 40 },
    { label: "Design", value: 25 },
    { label: "Ops", value: 15 },
  ];

  it("renders slice paths", () => {
    const svg = pie(segments, { cx: 200, cy: 150, outerRadius: 80 });
    expect((svg.match(/<path/g) ?? []).length).toBe(3);
  });

  it("box option centers pie in layout cell", () => {
    const svg = pie(segments, { box: { x: 100, y: 50, width: 200, height: 200 } });
    expect(svg).toContain('transform="translate(200,150)"');
  });

  it("labels mode emits text with names and percents", () => {
    const svg = pie(segments, {
      cx: 200,
      cy: 150,
      outerRadius: 80,
      progress: 1,
      labels: { format: "both" },
    });
    expect(svg).toContain("<text");
    expect(svg).toContain("Eng");
    expect(svg).toContain("%");
  });
});

describe("charts.scatter", () => {
  const points = [
    { x: 1, y: 2, label: "p1" },
    { x: 2, y: 4 },
    { x: 3, y: 5 },
    { x: 4, y: 7 },
  ];

  it("reveals points sequentially", () => {
    const early = scatter(chartCoords(), points, [0, 5], [0, 10], { progress: 0.2 });
    const late = scatter(chartCoords(), points, [0, 5], [0, 10], { progress: 1 });
    expect((early.match(/<circle/g) ?? []).length).toBeLessThan(points.length);
    expect((late.match(/<circle/g) ?? []).length).toBe(points.length);
  });

  it("showPointLabels renders labels", () => {
    const svg = scatter(chartCoords(), points, [0, 5], [0, 10], {
      progress: 1,
      showPointLabels: true,
    });
    expect(svg).toContain(">p1<");
  });

  it("defaults domains to coords ranges", () => {
    const svg = scatter(chartCoords(), points, undefined, undefined, { progress: 1 });
    expect(svg).toContain("<circle");
  });
});

describe("charts.legend", () => {
  it("uses explicit colors aligned to series", () => {
    const svg = legend(
      { x: 10, y: 10, width: 200, height: 200 },
      SAMPLE.map((s) => ({ id: s.label, data: [s] })),
      { colors: DEFAULT_CHART_COLORS },
    );
    expect(svg).toContain(`fill="${DEFAULT_CHART_COLORS[0]}"`);
    expect(svg).toContain(">A<");
  });

  it("horizontal layout places items in a row", () => {
    const svg = legend(
      { x: 10, y: 10, width: 400, height: 40 },
      SAMPLE.slice(0, 2).map((s) => ({ id: s.label, data: [s] })),
      { layout: "horizontal" },
    );
    const rects = [...svg.matchAll(/<rect x="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(rects[1]).toBeGreaterThan(rects[0]!);
  });
});

describe("charts.area", () => {
  it("renders fill path at full progress", () => {
    const svg = area(chartCoords(), SAMPLE, { progress: 1 });
    expect(svg).toContain("<path");
    expect(svg).toContain('fill="#5b8cff"');
  });

  it("grow at 0 collapses values", () => {
    const full = area(chartCoords(), SAMPLE, { animate: "grow", progress: 1 });
    const zero = area(chartCoords(), SAMPLE, { animate: "grow", progress: 0 });
    expect(full.length).toBeGreaterThan(0);
    expect(zero).toContain("<path");
  });
});

describe("charts.stack", () => {
  const series = [
    {
      id: "a",
      data: SAMPLE.map((d) => ({ label: d.label, value: d.value })),
    },
    {
      id: "b",
      data: SAMPLE.map((d) => ({ label: d.label, value: d.value / 2 })),
    },
  ];

  it("renders stacked bars", () => {
    const svg = stack(chartCoords(), series, { mode: "bar", progress: 1 });
    expect((svg.match(/<rect/g) ?? []).length).toBe(SAMPLE.length * 2);
  });

  it("renders stacked area", () => {
    const svg = stack(chartCoords(), series, { mode: "area", progress: 1 });
    expect((svg.match(/<path/g) ?? []).length).toBe(2);
  });

  it("expand mode stacks to unit height", () => {
    const svg = stack(chartCoords(), series, { mode: "bar", expand: true, progress: 1 });
    expect(svg).toContain("<rect");
  });
});
