// One grid, two graphs. A line and signed bars share one type system, one zero
// line and one clock. Data is synthetic and labelled as such on every frame.
import {
  video,
  Frame,
  Stack,
  Text,
  Vector,
  vector,
  googleFont,
  type RenderContext,
} from "@foxworth/superimg";
import {
  layout,
  defineChart,
  lineY,
  barY,
  scaleLinear,
  scaleBand,
  scaleOrdinal,
  group,
} from "@foxworth/superimg/charts";

// Palette: near-black stage, warm white ink, one accent. Prior stays graphite.
const STAGE = "#0C0D10",
  INK = "#F2F2EF",
  GRAPHITE = "#8A8F9C",
  HAIRLINE = "#26282E",
  ACCENT = "#FF6A3D",
  PRIOR = "#5C6170";
const SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";
const MONTHS = ["JAN", "FEB", "MAR", "APR"];

// Illustrative series: a dip in March, a strong April.
const trend = [
  { id: "jan", month: 1, value: 24 },
  { id: "feb", month: 2, value: 37 },
  { id: "mar", month: 3, value: 32 },
  { id: "apr", month: 4, value: 58 },
];
// A later-only category and mixed signs deliberately exercise category union and zero.
const bars = [
  { id: "a:web", category: "Web", series: "Current", value: 32 },
  { id: "b:web", category: "Web", series: "Prior", value: 21 },
  { id: "a:cli", category: "CLI", series: "Current", value: -12 },
  { id: "b:cli", category: "CLI", series: "Prior", value: -6 },
  { id: "b:api", category: "API", series: "Prior", value: 25 },
];
const CATEGORIES = ["Web", "CLI", "API"] as const;
const SERIES = ["Current", "Prior"] as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutCubic = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);
const easeInOutCubic = (p: number) => {
  const x = clamp01(p);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

const theme = {
  foreground: INK,
  muted: GRAPHITE,
  grid: HAIRLINE,
  background: STAGE,
  palette: [ACCENT, PRIOR],
};

interface Progress {
  open: number; // zero lines draw, copy settles
  line: number; // line reveal 0–1
  grow: Record<(typeof CATEGORIES)[number], number>; // per-category bar growth
}

function buildCharts(
  w: number,
  h: { line: number; bars: number },
  font: number,
  p: Progress,
) {
  const line = layout(
    defineChart({
      focus: false,
      marks: [
        lineY(trend, {
          id: "trend",
          key: "id",
          x: "month",
          y: "value",
          stroke: ACCENT,
          strokeWidth: 3,
          lineCap: "round",
          lineJoin: "round",
        }),
      ],
      scales: {
        x: {
          scale: scaleLinear().domain([1, 4]),
          axis: {
            line: false,
            ticks: {
              values: [1, 2, 3, 4],
              line: false,
              padding: font * 0.7,
              format: (v: number) => MONTHS[v - 1]!,
            },
            tickLabels: { fontSize: font },
          },
        },
        y: {
          scale: scaleLinear().domain([0, 70]),
          grid: true,
          axis: {
            line: false,
            ticks: { count: 4, line: false, padding: font * 0.6 },
            tickLabels: { fontSize: font },
          },
        },
      },
    }),
    {
      id: "monthly-trend",
      width: w,
      height: h.line,
      theme,
      typography: { fontFamily: SANS },
      motion: { lineReveal: p.line },
    },
  );
  const columns = layout(
    defineChart({
      focus: false,
      // One mark per category so each group grows on its own offset while
      // every mark shares the same band, value and color scales.
      marks: CATEGORIES.map((category) =>
        barY(
          bars.filter((b) => b.category === category),
          {
            id: `channels:${category.toLowerCase()}`,
            key: "id",
            x: "category",
            y: "value",
            z: "series",
            color: "series",
            layout: group({
              scale: scaleBand().domain([...SERIES]).padding(0.14),
            }),
          },
        ),
      ),
      scales: {
        x: {
          scale: scaleBand().domain([...CATEGORIES]).padding(0.42),
          axis: {
            line: false,
            ticks: {
              line: false,
              padding: font * 0.7,
              format: (v: string) => v.toUpperCase(),
            },
            tickLabels: { fontSize: font },
          },
        },
        y: {
          scale: scaleLinear().domain([-20, 50]),
          grid: true,
          axis: {
            line: false,
            ticks: { count: 4, line: false, padding: font * 0.6 },
            tickLabels: { fontSize: font },
          },
        },
      },
      color: {
        scale: scaleOrdinal()
          .domain([...SERIES])
          .range([ACCENT, PRIOR]),
      },
    }),
    {
      id: "channel-comparison",
      width: w,
      height: h.bars,
      theme,
      typography: { fontFamily: SANS },
      motion: {
        barsGrow: 1,
        marks: Object.fromEntries(
          CATEGORIES.map((c) => [
            `channels:${c.toLowerCase()}`,
            { barsGrow: p.grow[c] },
          ]),
        ),
      },
    },
  );
  return { line, columns };
}

// Resolved point for one datum id; annotations never read coordinates from SVG.
function datum<T extends { id: string }>(
  chart: { points: readonly { x: number; y: number; datum: unknown }[] },
  id: string,
): { x: number; y: number; datum: T } {
  const found = chart.points.find((pt) => (pt.datum as { id: string }).id === id);
  if (!found) throw new Error(`chart-primitives: missing datum ${id}`);
  return { x: found.x, y: found.y, datum: found.datum as T };
}
type Trend = (typeof trend)[number];
type Bar = (typeof bars)[number];

export function renderChartPrimitives(ctx: RenderContext) {
  const { width, height } = ctx;
  const landscape = width / height >= 1.2;
  const t = ctx.director(
    { open: "0.5s", line: "1.3s", bars: "0.9s", hold: "2.3s" },
    { tone: "premium" },
  );
  const progress: Progress = {
    open: easeInOutCubic(t.in("open")),
    line: easeInOutCubic(t.in("line")),
    grow: {
      Web: easeOutCubic(t.in("bars", { at: "0ms", duration: "600ms" })),
      CLI: easeOutCubic(t.in("bars", { at: "120ms", duration: "600ms" })),
      API: easeOutCubic(t.in("bars", { at: "240ms", duration: "600ms" })),
    },
  };
  // The reading and its pin arrive only once the line has fully drawn.
  const landed = clamp01((t.in("line") - 0.9) / 0.1);

  // Design block: 1920×1080 for landscape, 1080×1080 otherwise, centred in the stage.
  const block = landscape ? { w: 1920, h: 1080 } : { w: 1080, h: 1080 };
  const u = Math.min(width / block.w, height / block.h);
  const offset = { x: (width - block.w * u) / 2, y: (height - block.h * u) / 2 };
  const px = (v: number) => Math.round(v * u);
  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    ...children: Parameters<typeof Frame>[1][]
  ) =>
    Frame(
      {
        x: Math.round(x * u + offset.x),
        y: Math.round(y * u + offset.y),
        width: px(w),
        height: px(h),
      },
      ...children,
    );
  const label = (
    text: string,
    opts: { id?: string; size?: number; color?: string; align?: "left" | "right"; width?: number; motion?: ReturnType<typeof t.motion> },
  ) => {
    const node = Text(
      {
        ...(opts.id ? { id: opts.id } : {}),
        size: px(opts.size ?? (landscape ? 20 : 18)),
        weight: 600,
        color: opts.color ?? GRAPHITE,
        letterSpacing: px(2.4),
        fontFamily: SANS,
        ...(opts.motion ? { motion: opts.motion } : {}),
      },
      text,
    );
    // Right-aligned labels are placed by a definite row, not by text alignment.
    return opts.align === "right" && opts.width
      ? Stack({ direction: "row", justify: "end", width: px(opts.width) }, node)
      : node;
  };

  const M = landscape ? 96 : 72;
  const contentW = (landscape ? 1920 : 1080) - M * 2;
  const chartX = landscape ? 648 : M;
  const chartW = landscape ? 1176 : contentW;
  const chartH = landscape ? { line: 380, bars: 284 } : { line: 214, bars: 168 };
  const tickFont = px(landscape ? 22 : 18);
  const { line, columns } = buildCharts(px(chartW), { line: px(chartH.line), bars: px(chartH.bars) }, tickFont, progress);

  // Annotations come from resolved points, never from scraped SVG.
  const peak = datum<Trend>(line, "apr");
  const lineZero = line.project("y", 0);
  const barZero = columns.project("y", 0);
  const webCurrent = datum<Bar>(columns, "a:web");
  const webPrior = datum<Bar>(columns, "b:web");
  const apiPrior = datum<Bar>(columns, "b:api");
  // The absent Current/API datum: its slot is the Prior slot shifted by the
  // Current–Prior pitch measured on Web. Marked, not invented.
  const apiCurrentX = apiPrior.x + (webCurrent.x - webPrior.x);

  const zeroRule = (chart: typeof line | typeof columns, y: number) => {
    const { x, width: w } = chart.scene.chart;
    return vector.path({
      d: `M${x},${y}H${x + w}`,
      pathLength: 1,
      strokeDasharray: 1,
      strokeDashoffset: 1 - progress.open,
      stroke: INK,
      strokeWidth: 1.5,
      fill: "none",
      opacity: 0.9,
    });
  };
  const lineOverlay = Vector(
    { width: px(chartW), height: px(chartH.line) },
    zeroRule(line, lineZero),
    vector.group(
      { opacity: landed },
      vector.path({
        d: `M${peak.x},${peak.y}V${lineZero}`,
        stroke: GRAPHITE,
        strokeWidth: 1,
        strokeDasharray: "3 5",
        fill: "none",
      }),
      vector.circle({
        cx: peak.x,
        cy: peak.y,
        r: px(7),
        fill: STAGE,
        stroke: ACCENT,
        strokeWidth: px(2.5),
      }),
    ),
  );
  const barsOverlay = Vector(
    { width: px(chartW), height: px(chartH.bars) },
    zeroRule(columns, barZero),
    vector.circle({
      cx: apiCurrentX,
      cy: barZero,
      r: px(4.5),
      fill: STAGE,
      stroke: GRAPHITE,
      strokeWidth: 1.5,
      opacity: progress.grow.API,
    }),
  );

  const copy = {
    eyebrow: t.motion({ id: "eyebrow", during: "open", exit: false, y: 8 }),
    headline: t.motion({ id: "headline", during: "open", exit: false, y: 12, at: "60ms" }),
    headline2: t.motion({ id: "headline-2", during: "open", exit: false, y: 12, at: "120ms" }),
    titles: t.motion({ id: "chart-titles", during: "open", exit: false, y: 8, at: "140ms" }),
    notes: t.motion({ id: "notes", during: "open", exit: false, y: 8, at: "200ms" }),
  };
  const swatch = (color: string, text: string) =>
    Stack(
      { direction: "row", align: "center", gap: px(10) },
      Frame({ width: px(10), height: px(10), fill: color, radius: px(5) }),
      Text({ size: px(landscape ? 20 : 18), weight: 500, color: INK, fontFamily: SANS }, text),
    );
  const legend = Stack(
    { direction: "row", align: "center", gap: px(28), motion: copy.notes },
    swatch(ACCENT, "Current"),
    swatch(PRIOR, "Prior"),
  );
  const reading = (size: number) =>
    Text(
      {
        id: "reading",
        size: px(size),
        weight: 600,
        color: INK,
        letterSpacing: -px(size * 0.04),
        lineHeight: 1,
        fontFamily: SANS,
        style: { opacity: landed },
      },
      String(peak.datum.value),
    );
  const readingLabel = label(`${MONTHS[peak.datum.month - 1]} · ACTIVE PROJECTS`, {
    id: "reading-label",
    motion: copy.titles,
  });
  const headline = (text: string, size: number, id: string, motion: ReturnType<typeof t.motion>) =>
    Text(
      {
        id,
        size: px(size),
        weight: 600,
        color: INK,
        letterSpacing: -px(size * 0.03),
        lineHeight: 1,
        fontFamily: SANS,
        motion,
      },
      text,
    );
  const rule = (y: number) => box(M, y, contentW, 1, Frame({ width: px(contentW), height: 1, fill: HAIRLINE }));
  const eyebrowRow = (y: number) => [
    box(M, y, contentW * 0.6, 28, label("ILLUSTRATIVE DATA · SYNTHETIC SERIES", { id: "eyebrow", motion: copy.eyebrow })),
    box(M + contentW * 0.6, y, contentW * 0.4, 28, label("TYPED CHARTS", { align: "right", width: contentW * 0.4, motion: copy.eyebrow })),
  ];
  const chartBlock = (
    title: string,
    id: "line" | "bars",
    y: number,
    h: number,
    artwork: typeof line.artwork,
    overlay: typeof lineOverlay,
    trailing?: typeof legend,
  ) => [
    box(
      chartX,
      y,
      chartW,
      28,
      trailing
        ? Stack(
            { direction: "row", width: px(chartW), justify: "space-between", align: "center" },
            label(title, { id: `${id}-title`, motion: copy.titles }),
            trailing,
          )
        : label(title, { id: `${id}-title`, motion: copy.titles }),
    ),
    Frame(
      {
        id: `${id}-chart`,
        x: Math.round(chartX * u + offset.x),
        y: Math.round((y + 36) * u + offset.y),
        width: px(chartW),
        height: px(h),
      },
      artwork,
      Frame({ x: 0, y: 0, width: px(chartW), height: px(h) }, overlay),
    ),
  ];
  const explanation = (width: number, lines: number) =>
    Text(
      {
        id: "explanation",
        size: px(20),
        weight: 400,
        color: GRAPHITE,
        lineHeight: 1.5,
        maxWidth: px(width),
        fontFamily: SANS,
        motion: copy.notes,
      },
      lines === 1 ? "Bars share one zero line · API reports Prior only" : "Bars share one zero line. API reports Prior only.",
    );

  if (landscape) {
    return Frame(
      { id: "stage", width, height, fill: STAGE },
      rule(84),
      ...eyebrowRow(100),
      box(M, 190, 528, 100, headline("One grid.", 84, "headline", copy.headline)),
      box(M, 286, 528, 100, headline("Two graphs.", 84, "headline-2", copy.headline2)),
      box(M, 440, 456, 190, reading(168)),
      box(M, 640, 456, 28, readingLabel),
      box(M, 712, 456, 28, legend),
      box(M, 790, 400, 64, explanation(400, 2)),
      ...chartBlock("MONTHLY ADOPTION · PROJECTS", "line", 196, chartH.line, line.artwork, lineOverlay),
      ...chartBlock("CHANGE BY CHANNEL · VS PRIOR", "bars", 664, chartH.bars, columns.artwork, barsOverlay),
    );
  }
  // Square and portrait: one 1080-wide block, copy above, graphs below, centred.
  return Frame(
    { id: "stage", width, height, fill: STAGE },
    rule(72),
    ...eyebrowRow(86),
    box(M, 128, contentW, 88, headline("One grid.", 84, "headline", copy.headline)),
    box(M, 212, contentW, 88, headline("Two graphs.", 84, "headline-2", copy.headline2)),
    box(M, 328, 190, 140, reading(136)),
    box(M + 184, 430, contentW - 184, 24, readingLabel),
    ...chartBlock("MONTHLY ADOPTION · PROJECTS", "line", 496, chartH.line, line.artwork, lineOverlay),
    ...chartBlock("CHANGE BY CHANNEL · VS PRIOR", "bars", 776, chartH.bars, columns.artwork, barsOverlay, legend),
    box(M, 1000, contentW, 28, explanation(contentW, 1)),
  );
}

export default video({
  duration: "5s",
  fonts: [googleFont("Inter:wght@400;500;600;700")],
  render: renderChartPrimitives,
  editions: {
    square: {
      size: { width: 1080, height: 1080 },
      render: renderChartPrimitives,
    },
  },
});
