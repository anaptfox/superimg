// Registry history as a product film: one grid, one line, one travelling reader.
// The reading, its caption and the pin all come from the resolved chart scene.
import {
  video,
  Frame,
  Stack,
  Text,
  Vector,
  vector,
  type RenderContext,
  googleFont,
} from "@foxworth/superimg";
import { layout, defineChart, lineY, scaleLinear } from "@foxworth/superimg/charts";
export interface NpmStatsData extends Record<string, unknown> {
  downloads: Array<{
    date: string;
    count: number;
  }>;
  package: string;
  description: string;
  totalDownloads: number;
  showGrid: boolean;
  accentColor: string;
}
// Shared "one grid" system: near-black stage, warm white ink, graphite captions.
// The data-driven accent paints strokes and pins only, never body text.
const STAGE = "#0C0D10",
  INK = "#F2F2EF",
  GRAPHITE = "#8A8F9C",
  HAIRLINE = "#26282E";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";
const rangeLabel = (date: string | number) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOutCubic = (p: number) => {
  const x = clamp01(p);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export function renderNpmStats(ctx: RenderContext<NpmStatsData>) {
  const { width, height, data, std } = ctx;
  const landscape = width / height >= 1.2;
  const accent = data.accentColor || "#CB3837";
  const points = (data.downloads ?? [])
    .filter(
      (d) =>
        Number.isFinite(d.count) &&
        d.count >= 0 &&
        Number.isFinite(Date.parse(d.date)),
    )
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map((d, i) => ({ ...d, at: Date.parse(d.date), id: `${d.date}:${i}` }));
  if (!points.length)
    return Frame(
      { width, height, fill: STAGE },
      Stack(
        {
          width: "fill",
          height: "fill",
          align: "center",
          justify: "center",
          gap: 24,
        },
        Text({ size: Math.round(Math.min(width, height) * 0.06), color: INK, fontFamily: MONO, weight: 700 }, data.package),
        Text({ size: Math.round(Math.min(width, height) * 0.025), color: GRAPHITE, fontFamily: SANS }, "No download observations"),
      ),
    );
  const t = ctx.director(
    { head: ".7s", draw: "3.4s", peak: "1s", hold: "1.7s" },
    { tone: "premium" },
  );
  const open = easeInOutCubic(t.in("head"));
  const draw = std.interpolate(t.in("draw"), [0, 1], [0, 1], "easeInOutCubic");
  const first = points[0]!,
    last = points[points.length - 1]!;

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
  const M = landscape ? 96 : 72;
  const contentW = block.w - M * 2;
  const chartX = landscape ? 792 : M;
  const chartW = landscape ? block.w - M - 792 : contentW;
  const chartH = landscape ? 600 : 256;
  const tickFont = px(landscape ? 22 : 18);

  const chart = layout(
    defineChart({
      focus: false,
      marks: [
        lineY(points, {
          id: "downloads",
          key: "id",
          x: "at",
          y: "count",
          stroke: accent,
          strokeWidth: 3,
          lineCap: "round",
          lineJoin: "round",
        }),
      ],
      scales: {
        x: {
          scale: scaleLinear().domain([
            first.at,
            Math.max(last.at, first.at + 86400000),
          ]),
          axis: {
            line: false,
            ticks: {
              values: points.map((p) => p.at),
              line: false,
              padding: tickFont * 0.7,
              format: (v: number) =>
                new Date(v)
                  .toLocaleDateString("en-US", {
                    month: "short",
                    timeZone: "UTC",
                  })
                  .toUpperCase(),
            },
            tickLabels: { fontSize: tickFont, thin: { minGap: tickFont * 1.2, priority: "ends" } },
          },
        },
        y: {
          scale: scaleLinear().domain([
            0,
            Math.max(1, ...points.map((p) => p.count)) * 1.08,
          ]),
          grid: data.showGrid,
          axis: {
            line: false,
            ticks: {
              count: 4,
              line: false,
              padding: tickFont * 0.6,
              format: (v: number) => std.text.formatCompact(v),
            },
            tickLabels: { fontSize: tickFont },
          },
        },
      },
    }),
    {
      id: "npm-history",
      width: px(chartW),
      height: px(chartH),
      typography: { fontFamily: MONO },
      theme: {
        foreground: INK,
        muted: GRAPHITE,
        background: STAGE,
        grid: HAIRLINE,
        palette: [accent],
      },
      motion: { lineReveal: draw },
    },
  );
  // The semantic path is retained by the adapter: no SVG parsing or parallel scales.
  const line = chart.mark("downloads").find((mark) => mark.kind === "polyline");
  const head =
    line && points.length > 1
      ? chart.pathPoint(line.key, draw)
      : { x: chart.points[0]!.x, y: chart.points[0]!.y };
  const value = chart.scene.scales.y!.invert!(head.y) as number;
  const date = chart.scene.scales.x!.invert!(head.x) as number;
  const zeroY = chart.project("y", 0);
  const plot = chart.scene.chart;
  const annotation = Vector(
    { width: px(chartW), height: px(chartH) },
    // Zero line: the one rule every reading hangs from. Draws during `head`.
    vector.path({
      d: `M${plot.x},${zeroY}H${plot.x + plot.width}`,
      pathLength: 1,
      strokeDasharray: 1,
      strokeDashoffset: 1 - open,
      stroke: INK,
      strokeWidth: 1.5,
      fill: "none",
      opacity: 0.9,
    }),
    vector.group(
      { opacity: Math.min(1, draw * 12) },
      vector.path({
        d: `M${head.x},${head.y}V${zeroY}`,
        stroke: GRAPHITE,
        strokeWidth: 1,
        strokeDasharray: "3 5",
        fill: "none",
      }),
      ...(head.x - plot.x >= 1 ? [vector.path({
        d: `M${plot.x},${head.y}H${head.x}`,
        stroke: GRAPHITE,
        strokeWidth: 1,
        strokeDasharray: "3 5",
        fill: "none",
        opacity: 0.7,
      })] : []),
      vector.circle({
        cx: head.x,
        cy: head.y,
        r: px(7),
        fill: STAGE,
        stroke: accent,
        strokeWidth: px(2.5),
      }),
    ),
  );

  const enter = {
    eyebrow: t.motion({ id: "eyebrow", during: "head", exit: false, y: 8 }),
    name: t.motion({ id: "package", during: "head", exit: false, y: 12, at: "60ms" }),
    detail: t.motion({ id: "detail", during: "head", exit: false, y: 10, at: "120ms" }),
    chart: t.motion({ id: "chart-title", during: "head", exit: false, y: 8, at: "140ms" }),
  };
  const label = (
    text: string,
    opts: { id?: string; color?: string; align?: "left" | "right"; width?: number; size?: number; mono?: boolean; motion?: ReturnType<typeof t.motion>; opacity?: number },
  ) => {
    const node = Text(
      {
        ...(opts.id ? { id: opts.id } : {}),
        size: px(opts.size ?? (landscape ? 20 : 18)),
        weight: 600,
        color: opts.color ?? GRAPHITE,
        letterSpacing: px(2.4),
        fontFamily: opts.mono ? MONO : SANS,
        ...(opts.motion ? { motion: opts.motion } : {}),
        ...(opts.opacity !== undefined ? { style: { opacity: opts.opacity } } : {}),
      },
      text,
    );
    // Right-aligned labels are placed by a definite row, not by text alignment.
    return opts.align === "right" && opts.width
      ? Stack({ direction: "row", justify: "end", width: px(opts.width) }, node)
      : node;
  };
  const rule = (y: number) =>
    box(M, y, contentW, 1, Frame({ width: px(contentW), height: 1, fill: HAIRLINE }));
  const range = `${rangeLabel(first.date)} — ${rangeLabel(last.date)}`.toUpperCase();
  const reading = (size: number) =>
    Text(
      {
        id: "download-reading",
        size: px(size),
        weight: 600,
        color: INK,
        letterSpacing: -px(size * 0.04),
        lineHeight: 1,
        fontFamily: SANS,
      },
      std.text.formatCompact(Math.round(value)),
    );
  const caption = () =>
    Text(
      { id: "observed-caption", size: px(landscape ? 20 : 18), color: GRAPHITE, fontFamily: MONO },
      `${draw > 0 && draw < 1 ? "interpolated ·" : "observed"} ${rangeLabel(date)}`,
    );
  const accentRule = () => Frame({ width: px(56), height: px(3), fill: accent, radius: px(1.5), motion: enter.detail });
  const periodTotal = (size: number) =>
    Stack(
      { direction: "row", align: "end", gap: px(14), style: { opacity: t.in("peak") } },
      Text(
        { id: "period-total", size: px(size), weight: 600, color: INK, letterSpacing: -px(size * 0.02), lineHeight: 1, fontFamily: SANS },
        std.text.formatCompact(data.totalDownloads),
      ),
      Text(
        { size: px(landscape ? 20 : 18), weight: 600, color: GRAPHITE, letterSpacing: px(2.4), fontFamily: SANS },
        "PERIOD TOTAL",
      ),
    );
  const chartFrame = (y: number) =>
    Frame(
      {
        id: "chart",
        x: Math.round(chartX * u + offset.x),
        y: Math.round(y * u + offset.y),
        width: px(chartW),
        height: px(chartH),
      },
      chart.artwork,
      Frame({ x: 0, y: 0, width: px(chartW), height: px(chartH) }, annotation),
    );
  const observations = `${points.length} OBSERVATIONS`;

  if (landscape) {
    return Frame(
      { id: "registry-sheet", width, height, fill: STAGE },
      rule(84),
      box(M, 100, contentW * 0.6, 28, label("NPM REGISTRY · DOWNLOAD HISTORY", { id: "registry-label", motion: enter.eyebrow })),
      box(M + contentW * 0.6, 100, contentW * 0.4, 28, label(range, { align: "right", width: contentW * 0.4, mono: true, motion: enter.eyebrow })),
      box(M, 186, 600, 132, Text({ id: "package-name", size: px(120), weight: 700, color: INK, lineHeight: 1, fontFamily: MONO, motion: enter.name }, data.package)),
      box(M, 334, 560, 64, Text({ size: px(22), color: GRAPHITE, lineHeight: 1.45, maxWidth: px(560), fontFamily: SANS, motion: enter.detail }, data.description)),
      box(M, 440, 56, 3, accentRule()),
      box(M, 468, 600, 180, reading(176)),
      box(M, 664, 600, 28, caption()),
      box(chartX, 186, chartW, 28, label("MONTHLY DOWNLOADS", { motion: enter.chart })),
      chartFrame(222),
      rule(862),
      box(M, 888, contentW * 0.6, 48, periodTotal(44)),
      box(M + contentW * 0.6, 904, contentW * 0.4, 28, label(observations, { align: "right", width: contentW * 0.4, opacity: t.in("peak") })),
    );
  }
  // Square and portrait: one 1080 block, reading above the graph, centred.
  return Frame(
    { id: "registry-sheet", width, height, fill: STAGE },
    rule(72),
    box(M, 86, contentW * 0.6, 24, label("NPM REGISTRY · DOWNLOAD HISTORY", { id: "registry-label", size: 16, motion: enter.eyebrow })),
    box(M + contentW * 0.6, 86, contentW * 0.4, 24, label(range, { align: "right", width: contentW * 0.4, size: 16, mono: true, motion: enter.eyebrow })),
    box(M, 124, contentW, 100, Text({ id: "package-name", size: px(96), weight: 700, color: INK, lineHeight: 1, fontFamily: MONO, motion: enter.name }, data.package)),
    box(M, 232, contentW, 28, Text({ size: px(20), color: GRAPHITE, maxWidth: px(contentW), fontFamily: SANS, motion: enter.detail }, data.description)),
    box(M, 292, 56, 3, accentRule()),
    box(M, 310, contentW, 228, reading(224)),
    box(M, 552, contentW, 24, caption()),
    box(M, 600, contentW, 24, label("MONTHLY DOWNLOADS", { motion: enter.chart })),
    chartFrame(628),
    rule(908),
    box(M, 928, contentW * 0.6, 40, periodTotal(36)),
    box(M + contentW * 0.6, 940, contentW * 0.4, 24, label(observations, { align: "right", width: contentW * 0.4, opacity: t.in("peak") })),
  );
}
export default video<NpmStatsData>({
  duration: "6.8s",
  fonts: [
    googleFont("JetBrains+Mono:wght@400;500;700"),
    googleFont("Inter:wght@400;500;600;700;800"),
  ],
  sample: {
    package: "react",
    description: "A JavaScript library for building user interfaces",
    downloads: [
      { date: "2024-01-01", count: 15000000 },
      { date: "2024-02-01", count: 16500000 },
      { date: "2024-03-01", count: 17200000 },
      { date: "2024-04-01", count: 18000000 },
      { date: "2024-05-01", count: 19500000 },
      { date: "2024-06-01", count: 20000000 },
    ],
    totalDownloads: 106200000,
    showGrid: true,
    accentColor: "#CB3837",
  },
  render: renderNpmStats,
  editions: {
    square: { size: { width: 1080, height: 1080 }, render: renderNpmStats },
  },
});
