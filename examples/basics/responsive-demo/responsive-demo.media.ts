// Responsive Demo — the program measures the canvas it was given, then
// art-directs itself. Landscape lays the rule along the bottom; portrait
// stands it up the left edge and stacks the type.

import { video, Fill, Frame, Stack, Text, type RenderContext, googleFont } from "@foxworth/superimg";

export interface MeasureData extends Record<string, unknown> {
  title: string;
  subtitle: string;
  accentColor: string;
}

type Ctx = RenderContext<MeasureData>;

const FIELD = "#0B2E33";
const CHALK = "#E6F0EA";
const MUTED = "rgba(230,240,234,0.52)";
const HAIR = "rgba(230,240,234,0.22)";

const DISPLAY = "'Bricolage Grotesque', 'Helvetica Neue', system-ui, sans-serif";
const MONO = "'Martian Mono', ui-monospace, monospace";

const PHASES = { draw: "18%", type: "22%", measure: "18%", hold: "32%", exit: "10%" };
const TICK_STEP = 40;

function beats(ctx: Ctx) {
  const t = ctx.director(PHASES);
  return {
    t,
    rule: ctx.std.interpolate(t.in("draw"), [0, 1], [0, 1], "easeOutQuint"),
    caliper: ctx.std.interpolate(t.in("measure"), [0, 1], [0, 1], "easeInOutCubic"),
    readout: ctx.std.interpolate(t.in("measure"), [0.55, 1], [0, 1], "easeOutCubic"),
    heading: t.motion({ id: "title", during: "type", at: "0%", for: "46%", y: 30, exit: false }),
    sub: t.motion({ id: "subtitle", during: "type", at: "22%", for: "46%", y: 18, exit: false }),
    kicker: t.motion({ id: "kicker", during: "draw", at: "30%", for: "60%", y: -12, exit: false }),
    leave: ctx.std.interpolate(t.in("exit"), [0, 1], [0, 1], "easeInCubic"),
  };
}

/** A drawn measuring rule: hairline plus ticks, wiped open along its axis. */
function rule(opts: {
  axis: "x" | "y";
  span: number;
  depth: number;
  progress: number;
  accent: string;
}) {
  const { axis, span, depth, progress, accent } = opts;
  const count = Math.floor(span / TICK_STEP) + 1;
  const drawn = Math.max(2, Math.round(span * progress));
  const ticks = Array.from({ length: count }, (_, i) => {
    const major = i % 6 === 0;
    const long = major ? depth : Math.round(depth * 0.42);
    return Fill({
      ...(axis === "x"
        ? { x: i * TICK_STEP, y: 0, width: major ? 2 : 1, height: long }
        : { x: 0, y: i * TICK_STEP, width: long, height: major ? 2 : 1 }),
      color: major ? accent : HAIR,
    });
  });
  return Frame(
    {
      width: axis === "x" ? drawn : depth,
      height: axis === "x" ? depth : drawn,
      overflow: "hidden",
    },
    Frame(
      {
        width: axis === "x" ? span : depth,
        height: axis === "x" ? depth : span,
      },
      Fill({
        ...(axis === "x"
          ? { x: 0, y: 0, width: span, height: 1 }
          : { x: 0, y: 0, width: 1, height: span }),
        color: HAIR,
      }),
      ...ticks,
    ),
  );
}

function readoutText(id: string, text: string, size: number, accent: string, opacity: number) {
  return Text(
    {
      id,
      variant: "label",
      size,
      weight: 500,
      letterSpacing: Math.round(size * 0.12),
      color: accent,
      fontFamily: MONO,
      style: { opacity },
    },
    text,
  );
}

function renderLandscape(ctx: Ctx) {
  const { width, height, data } = ctx;
  const b = beats(ctx);
  const accent = data.accentColor;
  const s = Math.min(width, height) / 1080;
  const px = (value: number) => Math.round(value * s);

  const margin = Math.round(width * 0.085);
  const ruleY = height - Math.round(height * 0.17);
  const ruleSpan = width - margin * 2;
  const jaw = Math.round(56 * (height / 1080));
  const travel = (ruleSpan / 2) * b.caliper;

  return Frame(
    { id: "stage", width, height, style: { opacity: 1 - b.leave } },
    Fill({ color: FIELD }),
    Frame({ id: "rule", x: margin, y: ruleY, width: ruleSpan, height: jaw },
      rule({ axis: "x", span: ruleSpan, depth: jaw, progress: b.rule, accent }),
    ),
    // Caliper jaws travel out of the centre until they hold the whole canvas.
    Frame(
      { id: "caliper", x: margin, y: ruleY - Math.round(jaw * 0.5), width: ruleSpan, height: jaw },
      Fill({
        x: Math.round(ruleSpan / 2 - travel),
        y: 0,
        width: 3,
        height: Math.round(jaw * 1.4),
        color: accent,
      }),
      Fill({
        x: Math.round(ruleSpan / 2 + travel) - 3,
        y: 0,
        width: 3,
        height: Math.round(jaw * 1.4),
        color: accent,
      }),
    ),
    Frame(
      { id: "readout", x: margin, y: ruleY + jaw + Math.round(20 * (height / 1080)), width: ruleSpan, height: 34 },
      Stack(
        { width: "fill", height: "fill", align: "center", justify: "center" },
        readoutText("width-readout", `${width} PX`, 24, accent, b.readout),
      ),
    ),
    Frame(
      { id: "copy", x: margin, y: Math.round(height * 0.2), width: Math.round(width * 0.58), height: Math.round(height * 0.5) },
      Stack(
        { width: "fill", height: "fill", justify: "center", gap: 26 },
        Frame({ width: "fill", height: px(32) }, Text(
          {
            id: "kicker",
            variant: "label",
            size: px(22),
            weight: 500,
            letterSpacing: 5,
            color: MUTED,
            fontFamily: MONO,
            motion: b.kicker,
          },
          `LANDSCAPE · ${width}×${height}`,
        )),
        Frame({ width: "fill", height: px(270) }, Text(
          {
            id: "title",
            variant: "display",
            size: px(124),
            weight: 700,
            lineHeight: 1.02,
            letterSpacing: -4,
            maxWidth: Math.round(width * 0.58),
            color: CHALK,
            fontFamily: DISPLAY,
            motion: b.heading,
          },
          data.title,
        )),
        Frame({ width: "fill", height: px(100) }, Text(
          {
            id: "subtitle",
            variant: "body",
            size: px(30),
            weight: 400,
            lineHeight: 1.5,
            maxWidth: Math.round(width * 0.44),
            color: MUTED,
            fontFamily: MONO,
            motion: b.sub,
          },
          data.subtitle,
        )),
      ),
    ),
    Frame(
      { id: "spine", x: width - margin, y: Math.round(height * 0.16), width: 3, height: Math.max(2, Math.round(height * 0.34 * b.rule)) },
      Fill({ color: accent }),
    ),
  );
}

function renderPortrait(ctx: Ctx) {
  const { width, height, data } = ctx;
  const b = beats(ctx);
  const accent = data.accentColor;
  const s = Math.min(width, height) / 1080;
  const px = (value: number) => Math.round(value * s);

  const margin = Math.round(width * 0.11);
  const ruleX = Math.round(margin * 0.42);
  const ruleSpan = height - Math.round(height * 0.24);
  const jaw = Math.round(52 * (width / 1080));
  const travel = (ruleSpan / 2) * b.caliper;
  const top = Math.round(height * 0.12);

  return Frame(
    { id: "stage", width, height, style: { opacity: 1 - b.leave } },
    Fill({ color: FIELD }),
    Frame({ id: "rule", x: ruleX, y: top, width: jaw, height: ruleSpan },
      rule({ axis: "y", span: ruleSpan, depth: jaw, progress: b.rule, accent }),
    ),
    Frame(
      { id: "caliper", x: ruleX - Math.round(jaw * 0.2), y: top, width: jaw, height: ruleSpan },
      Fill({
        x: 0,
        y: Math.round(ruleSpan / 2 - travel),
        width: Math.round(jaw * 1.4),
        height: 3,
        color: accent,
      }),
      Fill({
        x: 0,
        y: Math.round(ruleSpan / 2 + travel) - 3,
        width: Math.round(jaw * 1.4),
        height: 3,
        color: accent,
      }),
    ),
    Frame(
      { id: "copy", x: margin, y: Math.round(height * 0.3), width: width - margin * 2, height: Math.round(height * 0.4) },
      Stack(
        { width: "fill", height: "fill", justify: "center", gap: 28 },
        Frame({ width: "fill", height: px(32) }, Text(
          {
            id: "kicker",
            variant: "label",
            size: px(20),
            weight: 500,
            letterSpacing: 5,
            color: MUTED,
            fontFamily: MONO,
            motion: b.kicker,
          },
          `${ctx.isSquare ? "SQUARE" : "PORTRAIT"} · ${width}×${height}`,
        )),
        Frame({ width: "fill", height: px(270) }, Text(
          {
            id: "title",
            variant: "display",
            size: px(ctx.isSquare ? 120 : 104),
            weight: 700,
            lineHeight: 1.04,
            letterSpacing: -3,
            maxWidth: width - margin * 2,
            color: CHALK,
            fontFamily: DISPLAY,
            motion: b.heading,
          },
          data.title,
        )),
        Frame({ width: "fill", height: px(100) }, Text(
          {
            id: "subtitle",
            variant: "body",
            size: px(27),
            weight: 400,
            lineHeight: 1.55,
            maxWidth: width - margin * 2,
            color: MUTED,
            fontFamily: MONO,
            motion: b.sub,
          },
          data.subtitle,
        )),
      ),
    ),
    Frame(
      { id: "readout", x: margin, y: height - Math.round(height * 0.14), width: width - margin * 2, height: 40 },
      Stack(
        { direction: "row", width: "fill", height: "fill", align: "center", gap: 16 },
        readoutText("height-readout", `${height} PX TALL`, 24, accent, b.readout),
      ),
    ),
    Frame(
      { id: "spine", x: margin, y: Math.round(height * 0.24), width: Math.max(2, Math.round((width - margin * 2) * b.rule)), height: 3 },
      Fill({ color: accent }),
    ),
  );
}

export default video<MeasureData>({
  duration: "6s",
  fonts: [googleFont("Bricolage+Grotesque:wght@500;700"), googleFont("Martian+Mono:wght@400;500")],
  sample: {
    title: "Made to measure",
    subtitle: "Reads the canvas. Art-directs itself.",
    accentColor: "#4CC9C0",
  },
  editions: {
    landscape: { size: { width: 1920, height: 1080 }, render: renderLandscape },
    square: { size: { width: 1080, height: 1080 }, render: renderPortrait },
    portrait: { size: { width: 1080, height: 1920 }, render: renderPortrait },
  },
  render(ctx) {
    return ctx.isPortrait || ctx.isSquare ? renderPortrait(ctx) : renderLandscape(ctx);
  },
});
