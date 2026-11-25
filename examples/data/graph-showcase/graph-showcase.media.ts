import { video, Frame, Text, Vector, vector, googleFont, type RenderContext, type MediaElement } from "@foxworth/superimg";
import { layout, defineChart, lineY, barY, scaleLinear, scaleBand, scaleOrdinal, group } from "@foxworth/superimg/charts";

// Fictional observations. This is an authored graph study, not a product benchmark.
export const weeks = [18, 21, 24, 23, 29, 34, 31, 37, 42, 44, 49, 52]
  .map((projects, index) => ({ id: `w${index + 1}`, week: index + 1, projects }));
export const channels = ["Web", "CLI", "Docs", "API"];
export const changes = [
  { id: "web:current", channel: "Web", series: "Current", change: 32 },
  { id: "web:prior", channel: "Web", series: "Prior", change: 21 },
  { id: "cli:current", channel: "CLI", series: "Current", change: -12 },
  { id: "cli:prior", channel: "CLI", series: "Prior", change: -6 },
  { id: "docs:current", channel: "Docs", series: "Current", change: 14 },
  { id: "docs:prior", channel: "Docs", series: "Prior", change: 18 },
  { id: "api:prior", channel: "API", series: "Prior", change: 25 },
];
export const palette = {
  stage: "#0C0D10", ink: "#F2F2EF", muted: "#A2A6AF",
  prior: "#6E7380", hairline: "#24262C", accent: "#FF6A3D", tint: "#2B1713",
};
const FAMILY = "Inter, Arial, sans-serif";
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const out = (value: number) => 1 - (1 - clamp(value)) ** 3;
const smooth = (value: number) => { const p = clamp(value); return p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2; };
const mix = (a: number, b: number, progress: number) => a + (b - a) * progress;

export function geometry(width: number, height: number) {
  const square = width / height < 1.2;
  const unit = square ? width / 1080 : width / 1920;
  const x = (square ? 56 : 96) * unit;
  const chartY = (square ? 464 : 390) * unit;
  const chartHeight = (square ? 424 : 520) * unit;
  const margin = { top: 28 * unit, right: 32 * unit, bottom: 72 * unit, left: 76 * unit };
  // Both families use exactly the same plot rectangle and [-20, 60] domain.
  const zero = chartY + margin.top + .75 * (chartHeight - margin.top - margin.bottom);
  return { square, unit, x, y: chartY, width: width - x * 2, height: chartHeight, margin, zero };
}

export function charts(width: number, height: number, grow: number, reveal: number, categoryTime?: number) {
  const g = geometry(width, height), u = g.unit;
  const theme = { foreground: palette.ink, muted: palette.muted, grid: palette.hairline, background: palette.stage, palette: [palette.accent, palette.prior] };
  const y = () => ({ scale: scaleLinear().domain([-20, 60]), grid: false,
    axis: { ticks: { values: [-20, 0, 20, 40, 60] }, tickLabels: { fontSize: 28 * u } } });
  const line = layout(defineChart({
    margin: g.margin,
    marks: [lineY(weeks, { id: "weekly", key: "id", x: "week", y: "projects", stroke: palette.accent, strokeWidth: 4 * u })],
    scales: { x: { scale: scaleLinear().domain([1, 12]), axis: { ticks: { values: [1, 4, 8, 12], format: (value: number) => `W${value}` }, tickLabels: { fontSize: 28 * u } } }, y: y() },
  }), { id: "signal-line", width: g.width, height: g.height, theme, typography: { fontFamily: FAMILY }, motion: { lineReveal: reveal } });
  const bars = layout(defineChart({
    margin: g.margin,
    marks: channels.map(channel => barY(changes.filter(item => item.channel === channel), {
      id: `channel-${channel}`, key: "id", x: "channel", y: "change", z: "series", color: "series",
      layout: group({ scale: scaleBand().domain(["Current", "Prior"]).padding(.2) }),
    })),
    scales: { x: { scale: scaleBand().domain(channels).padding(.28), axis: { tickLabels: { fontSize: 28 * u } } }, y: y() },
    color: { scale: scaleOrdinal().domain(["Current", "Prior"]).range([palette.accent, palette.prior]) },
  }), { id: "signal-bars", width: g.width, height: g.height, theme, typography: { fontFamily: FAMILY }, motion: {
    barsGrow: grow,
    ...(categoryTime === undefined ? {} : { marks: Object.fromEntries(channels.map((channel, index) => [`channel-${channel}`, { barsGrow: out((categoryTime - .4 - index * .06) / .9) }])) }),
  } });
  return { line, bars, geometry: g };
}

export function renderGraphShowcase(ctx: RenderContext) {
  const { width, height } = ctx;
  const g = geometry(width, height), { square, unit: u } = g;
  const director = ctx.director({ intro: "3s", line: "5s", bars: "4.5s", final: "3.5s" });
  const intro = director.clip({ during: "intro" });
  const lineClip = director.clip({ during: "line" });
  const barClip = director.clip({ during: "bars" });
  const final = director.clip({ during: "final" });
  const stage = ctx.timeline.seconds < 3 ? "intro" : ctx.timeline.seconds < 8 ? "line" : ctx.timeline.seconds < 12.5 ? "bars" : "final";
  const reveal = smooth((lineClip.seconds - .35) / 1.4);
  const leaveLine = clamp((lineClip.seconds - 4.6) / .4) ** 3;
  const arrange = smooth(final.seconds / .5);
  const art = charts(width, height, 1, reveal, barClip.seconds);
  const nodes: MediaElement[] = [];
  const text = (id: string, x: number, y: number, w: number, size: number, content: string, color: string = palette.ink, weight = 500, tracking = 0, opacity = 1) => {
    const lines = content.split("\n");
    const ink = (line: string, index = 0) => Text({ id: index ? `${id}-${index}` : id, size, color, weight,
      fontFamily: FAMILY, lineHeight: 1.06, letterSpacing: tracking, maxWidth: w }, line);
    return lines.length === 1
      ? Frame({ id: `${id}-box`, x, y, width: w, style: { opacity } }, ink(content))
      : Frame({ id: `${id}-box`, x, y, width: w, height: size * 1.08 * lines.length, style: { opacity } },
          ...lines.map((line, index) => Frame({ x: 0, y: index * size * 1.08, width: w, height: size * 1.06 }, ink(line, index))));
  };
  const label = (id: string, y: number, content: string) => text(id, (square ? 64 : 96) * u, y * u, width - 160 * u, (square ? 20 : 25) * u, content, palette.muted, 500, 2 * u);
  const place = (id: string, element: MediaElement, x: number, y: number, w: number, h: number, opacity = 1) =>
    Frame({ id, x, y, width: w, height: h, style: { opacity } }, element);

  // A fixed ruler is the film's continuity device. No decorative camera drift.
  const lattice = [];
  for (let column = 0; column <= 12; column++) for (let row = 0; row <= 5; row++) {
    lattice.push(vector.circle({ cx: g.x + g.margin.left + column * (g.width - g.margin.left - g.margin.right) / 12,
      cy: g.y + g.margin.top + row * (g.height - g.margin.top - g.margin.bottom) / 5, r: 1.6 * u, fill: palette.hairline }));
  }
  nodes.push(Vector({ id: "lattice", width, height }, ...lattice));
  nodes.push(label("provenance", square ? 64 : 76, "ILLUSTRATIVE DATA / SYNTHETIC SERIES"));
  nodes.push(text("film-number", width - 150 * u, (square ? 100 : 76) * u, 90 * u, 23 * u, "01—04", palette.muted, 500, 1 * u));
  nodes.push(Vector({ id: "zero-ruler", width, height }, vector.path({ id: "zero-baseline",
    d: `M${g.x + g.margin.left},${g.zero}H${g.x + g.width - g.margin.right}`,
    stroke: palette.muted, strokeWidth: 1.2 * u, pathLength: 1, strokeDasharray: 1,
    strokeDashoffset: 1 - smooth(intro.seconds / .7), fill: "none" })));
  nodes.push(text("imprint", (square ? 64 : 96) * u, height - 76 * u, 420 * u, 20 * u, "SUPERIMG / GRAPH STUDY 001", palette.muted, 550, 2 * u));

  if (stage === "intro") {
    const enter = out((intro.seconds - .15) / .65), exit = clamp((intro.seconds - 2.7) / .3) ** 3;
    nodes.push(text("intro-headline", (square ? 64 : 96) * u, ((square ? 250 : 254) + 16 * (1 - enter) - 16 * exit) * u,
      width - 192 * u, (square ? 106 : 142) * u, "One grid.\nEvery graph.", palette.ink, 600, -5 * u, enter));
    nodes.push(label("intro-subtitle", square ? 530 : 605, "A clearer way to see."));
  }

  if (stage === "line") {
    const opacity = 1 - leaveLine, enter = out(lineClip.seconds / .4);
    nodes.push(label("line-label", square ? 160 : 172, "01 / WEEKLY ACTIVE PROJECTS"));
    nodes.push(text("line-headline", (square ? 64 : 96) * u, (square ? 218 : 228) * u,
      (square ? 650 : 1100) * u, (square ? 106 : 100) * u, square ? "See the\nsignal." : "See the signal.", palette.ink, 600, -3 * u, square ? 1 : enter * opacity));
    const finalPoint = art.line.points.find(point => (point.datum as { id: string }).id === "w12")!;
    const path = art.line.mark("weekly").find(mark => mark.kind === "polyline")!;
    const point = art.line.pathPoint(path.key, reveal);
    const floor = art.line.project("y", 0);
    const fill = `M${art.line.points[0]!.x},${floor}` + art.line.points.map(item => `L${item.x},${item.y}`).join("") + `L${finalPoint.x},${floor}Z`;
    const area = Vector({ id: "line-area", width: g.width, height: g.height },
      vector.path({ id: "area-tint", d: fill, fill: palette.tint, opacity: clamp((lineClip.seconds - 1.75) / .3) }));
    nodes.push(place("line-area-position", area, g.x, g.y - 24 * u * leaveLine, g.width, g.height, opacity));
    nodes.push(place("line-position", art.line.artwork, g.x, g.y - 24 * u * leaveLine, g.width, g.height, opacity));
    const leader = Vector({ id: "line-reader", width: g.width, height: g.height },
      vector.path({ d: `M${point.x},${point.y}V${floor}`, stroke: palette.accent, strokeOpacity: .45, strokeWidth: 1 * u, strokeDasharray: "4 7", fill: "none" }),
      vector.circle({ cx: point.x, cy: point.y, r: 8 * u, fill: palette.stage, stroke: palette.accent, strokeWidth: 3 * u }));
    nodes.push(place("reader-position", leader, g.x, g.y - 24 * u * leaveLine, g.width, g.height, opacity));
    const numberOpacity = out((lineClip.seconds - 1.75) / .25) * opacity;
    nodes.push(text("terminal-value", (square ? 730 : 1530) * u, (square ? 230 : 220) * u, 260 * u, (square ? 126 : 150) * u,
      String((finalPoint.datum as { projects: number }).projects), palette.accent, 550, -6 * u, numberOpacity));
    nodes.push(text("terminal-unit", (square ? 740 : 1540) * u, (square ? 376 : 382) * u, 280 * u, 23 * u, "W12 / PROJECTS", palette.muted, 500, 1 * u, numberOpacity));
  }

  if (stage === "bars" || stage === "final") {
    const endWidth = (square ? g.width : 1044 * u);
    const endHeight = (square ? 300 * u : g.height);
    const chartWidth = mix(g.width, endWidth, arrange), chartHeight = mix(g.height, endHeight, arrange);
    const chartX = mix(g.x, square ? g.x : 780 * u, arrange);
    const chartY = g.zero - g.margin.top - .75 * (chartHeight - g.margin.top - g.margin.bottom);
    // Re-layout the same keyed bars; the accepted values and zero never change.
    const barArt = chartWidth === g.width && chartHeight === g.height ? art.bars : layout(defineChart({
      margin: g.margin,
      marks: channels.map(channel => barY(changes.filter(item => item.channel === channel), {
        id: `channel-${channel}`, key: "id", x: "channel", y: "change", z: "series", color: "series",
        layout: group({ scale: scaleBand().domain(["Current", "Prior"]).padding(.2) }),
      })),
      scales: { x: { scale: scaleBand().domain(channels).padding(.28), axis: { tickLabels: { fontSize: 28 * u } } },
        y: { scale: scaleLinear().domain([-20, 60]), grid: false, axis: { ticks: { values: [-20, 0, 20, 40, 60] }, tickLabels: { fontSize: 28 * u } } } },
      color: { scale: scaleOrdinal().domain(["Current", "Prior"]).range([palette.accent, palette.prior]) },
    }), { id: "signal-bars", width: chartWidth, height: chartHeight,
      theme: { foreground: palette.ink, muted: palette.muted, grid: palette.hairline, background: palette.stage, palette: [palette.accent, palette.prior] },
      typography: { fontFamily: FAMILY } });
    nodes.push(place("bars-position", barArt.artwork, chartX, chartY, chartWidth, chartHeight));
    const api = barArt.points.find(point => (point.datum as { id: string }).id === "api:prior")!;
    const currentWeb = barArt.points.find(point => (point.datum as { id: string }).id === "web:current")!;
    const priorWeb = barArt.points.find(point => (point.datum as { id: string }).id === "web:prior")!;
    const missingX = api.x - (priorWeb.x - currentWeb.x);
    nodes.push(place("missing-data-position", Vector({ id: "missing-data", width: chartWidth, height: chartHeight },
      vector.text({ id: "missing-api-current", x: missingX, y: barArt.project("y", 0) - 18 * u,
        anchor: "middle", family: FAMILY, size: 22 * u, fill: palette.muted }, "n/a")), chartX, chartY, chartWidth, chartHeight));
    if (stage === "bars") {
      nodes.push(label("bars-label", square ? 160 : 172, "02 / CHANGE BY CHANNEL"));
      nodes.push(text("bars-headline", (square ? 64 : 96) * u, (square ? 218 : 228) * u, (square ? 900 : 1420) * u,
        (square ? 88 : 100) * u, square ? "Every change.\nIn context." : "Every change. In context.", palette.ink, 600, -3 * u));
      nodes.push(text("bar-unit", (square ? 64 : 96) * u, (square ? 425 : 352) * u, 820 * u, 24 * u, "PROJECTS / CHANGE VS PRIOR", palette.muted, 500, 1 * u));
      nodes.push(text("missing-note", (square ? 64 : 1220) * u, (square ? 900 : 906) * u, 600 * u, 24 * u, "API / prior only — not zero", palette.muted));
    } else {
      const mini = layout(defineChart({ guides: false, margin: { left: 76 * u, right: 32 * u, top: 12 * u, bottom: 20 * u },
        marks: [lineY(weeks, { id: "mini-weekly", key: "id", x: "week", y: "projects", stroke: palette.accent, strokeWidth: 3 * u })],
        scales: { x: { scale: scaleLinear().domain([1, 12]), axis: false }, y: { scale: scaleLinear().domain([-20, 60]), axis: false } },
      }), { id: "final-line", width: endWidth, height: (square ? 90 : 180) * u,
        theme: { foreground: palette.ink, muted: palette.muted, grid: palette.hairline, background: palette.stage, palette: [palette.accent] },
        motion: { lineReveal: out((final.seconds - .5) / .6) } });
      nodes.push(place("final-line-position", mini.artwork, square ? g.x : 780 * u, (square ? 460 : 192) * u, endWidth, (square ? 90 : 180) * u));
      nodes.push(text("final-headline", (square ? 64 : 96) * u, (square ? 140 : 230) * u,
        (square ? 930 : 650) * u, (square ? 112 : 110) * u, "SuperImg\nCharts.", palette.ink, 600, -4 * u));
      nodes.push(text("final-subtitle", (square ? 64 : 96) * u, (square ? 414 : 510) * u,
        (square ? 930 : 590) * u, (square ? 30 : 38) * u, square ? "Typed marks. Deterministic frames." : "Typed marks.\nDeterministic frames.", palette.muted, 500, -.5 * u));
      nodes.push(text("final-url", (square ? 64 : 96) * u, (square ? 945 : 635) * u, 600 * u, (square ? 26 : 30) * u,
        "@foxworth/superimg/charts", palette.accent, 500, .5 * u));
    }
    const legendY = stage === "final" ? square ? 905 : 898 : square ? 945 : 914;
    nodes.push(text("legend-current", (square ? 64 : 96) * u, legendY * u, 215 * u, 24 * u, "● Current", palette.accent));
    nodes.push(text("legend-prior", (square ? 285 : 340) * u, legendY * u, 215 * u, 24 * u, "● Prior", palette.muted));
  }
  return Frame({ id: "one-grid", width, height, fill: palette.stage }, ...nodes);
}

export default video({
  size: { width: 1920, height: 1080 }, fps: 30, duration: "16s",
  fonts: [googleFont("Inter:wght@400;500;600;700")],
  render: renderGraphShowcase,
  editions: { square: { size: { width: 1080, height: 1080 }, render: renderGraphShowcase } },
});
