// FAQ — myth busting, one claim at a time. The myth is set large, a coral rule strikes
// through it at real glyph width, and the truth rises underneath.

import { video, layoutTimeline, Frame, Stack, Text, Fill, Html, googleFont } from "@foxworth/superimg";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqVideoData extends Record<string, unknown> {
  topic: string;
  items: FaqItem[];
  theme: "dark" | "light" | "neon";
  accentColor: string;
}

const DISPLAY = "'Archivo', 'Inter', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const THEMES: Record<string, { bg: string; wash: string; ink: string; faint: string }> = {
  dark: { bg: "#1B0E1E", wash: "#3A1730", ink: "#F2E9E4", faint: "rgba(242,233,228,0.42)" },
  light: { bg: "#F6F0EA", wash: "#E4D3C8", ink: "#1B0E1E", faint: "rgba(27,14,30,0.46)" },
  neon: { bg: "#0C0018", wash: "#2B0A55", ink: "#F4ECFF", faint: "rgba(244,236,255,0.46)" },
};



function itemWeight(item: FaqItem): number {
  return Math.max(1, (item.question.length + item.answer.length) / 48);
}

function estimateFaqTimeline(data: FaqVideoData) {
  const weights = data.items.map(itemWeight);
  const itemsS = Math.max(3, weights.reduce((a, w) => a + w, 0) * 3.6);
  return layoutTimeline({ intro: 0.9, items: itemsS, outro: 0.8 });
}

export default video<FaqVideoData>({
  duration: "12.5s", // AST fallback; resolve() owns the real clock
  fonts: [googleFont("Archivo:wght@500;700;800"), googleFont("Inter:wght@400;500"), googleFont("IBM+Plex+Mono:wght@500;600")],
  inlineCss: ["* { margin: 0; padding: 0; box-sizing: border-box; }", "body { overflow: hidden; }"],

  sample: {
    topic: "TypeScript Myths",
    items: [
      { question: "TypeScript is slow?", answer: "Types vanish at compile time." },
      { question: "Only for big teams?", answer: "Solo devs gain the most." },
      { question: "Too hard to learn?", answer: "Start loose, add types later." },
    ],
    theme: "dark",
    accentColor: "#FF6B5A",
  },

  resolve({ data }) {
    const { totalSeconds, phases } = estimateFaqTimeline(data);
    return { duration: `${totalSeconds}s`, phases };
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { topic, items, theme, accentColor } = data;

    const skin = THEMES[theme] ?? THEMES.dark!;

    if (items.length === 0) {
      return Frame(
        { id: "empty-state", width, height, fill: skin.bg },
        Stack(
          { width: "fill", height: "fill", align: "center", justify: "center", gap: 24, pad: 96 },
          Text({ variant: "title", size: 52, color: skin.ink }, topic),
          Text({ variant: "body", size: 30, color: skin.ink }, "No questions yet"),
        ),
      );
    }
    const { phases } = estimateFaqTimeline(data);
    const t = ctx.director(phases);

    // ── Which myth is on screen, and how far into its beat are we ───────────
    const slots = std.stack(items, {
      id: "myths",
      itemIds: items.map((_item, i) => `myth-${i}`),
      during: t.in("items"),
      weights: items.map(itemWeight),
      lead: 0,
      trail: 0,
    });
    const pending = items.findIndex((_item, i) => slots.state(i).slot < 1);
    const index = pending < 0 ? items.length - 1 : pending;
    const local = slots.state(index).slot;
    const item = items[index]!;

    // ── Beat choreography (fractions of one myth's slot) ────────────────────
    const seg = (a: number, b: number, easing: Parameters<typeof std.interpolate>[3] = "easeOutCubic") =>
      std.interpolate(local, [a, b], [0, 1], easing);

    const labelIn = seg(0.0, 0.1);
    const mythIn = seg(0.04, 0.18, "easeOutQuint");
    const strike = seg(0.26, 0.4, "easeInOutCubic");
    const truthIn = seg(0.34, 0.46, "easeOutQuint");
    const leave = seg(0.9, 1.0, "easeInCubic");

    const beatOp = (1 - leave) * std.clamp01(t.in("items") > 0 ? 1 : 0);
    const beatY = -leave * 26;

    // ── Page geometry ───────────────────────────────────────────────────────
    const colW = 1240;
    const colX = Math.round((width - colW) / 2);
    const mythSize = 68;
    const mythBoxH = 188;

    const intro = t.in("intro");
    const chromeOp = std.interpolate(intro, [0, 0.6], [0, 1], "easeOutCubic");
    const outro = t.in("outro");
    const pageOp = 1 - std.interpolate(outro, [0, 1], [0, 1], "easeInCubic");

    // Real glyph width for the strike: the browser sizes the inline box, the
    // gradient rides it. No measurement heuristic, no overshoot.
    const mythHtml = `<div style="font-family:${DISPLAY};font-weight:800;font-size:${mythSize}px;line-height:1.16;letter-spacing:-2.2px;color:${skin.ink};opacity:${(1 - strike * 0.56).toFixed(3)}">
  <span style="background-image:linear-gradient(${accentColor},${accentColor});background-repeat:no-repeat;background-position:0 58%;background-size:${(strike * 100).toFixed(2)}% 8px;-webkit-box-decoration-break:clone;box-decoration-break:clone;">${std.text.escapeHtml(item.question)}</span>
</div>`;

    // ── Beat ticks along the bottom ─────────────────────────────────────────
    const tickW = 46;
    const tickGap = 12;
    const ticksW = items.length * tickW + (items.length - 1) * tickGap;
    const ticksSvg = `<svg width="${ticksW}" height="6" viewBox="0 0 ${ticksW} 6" xmlns="http://www.w3.org/2000/svg">
${items
  .map((_it, i) => {
    const x = i * (tickW + tickGap);
    const done = i < index ? 1 : i === index ? local : 0;
    return `<rect x="${x}" y="2" width="${tickW}" height="2" rx="1" fill="${skin.faint}" opacity="0.4"/>` +
      `<rect x="${x}" y="1" width="${(tickW * done).toFixed(2)}" height="4" rx="2" fill="${accentColor}"/>`;
  })
  .join("\n")}
</svg>`;

    return Frame(
      { id: "stage", width, height },
      Fill({ color: skin.bg }),
      Fill({
        gradient: { kind: "radial", at: "18% 8%", size: "70% 62%", stops: [std.color.alpha(skin.wash, 0.85), "transparent"] },
      }),
      Fill({
        gradient: { kind: "radial", at: "86% 92%", size: "58% 52%", stops: [std.color.alpha(accentColor, 0.14), "transparent"] },
      }),

      Frame(
        { x: 0, y: 0, width, height, style: { opacity: pageOp } },

        // ── Persistent chrome ───────────────────────────────────────────
        Frame(
          { x: colX, y: 108, width: colW, height: 82, style: { opacity: chromeOp } },
          Stack(
            { width: colW, gap: 16 },
            Stack(
              { direction: "row", height: 26, gap: 14, align: "center" },
              Frame({ width: 30, height: 3, fill: accentColor }),
              Text({ variant: "label", color: accentColor, size: 14, weight: 600, fontFamily: MONO, letterSpacing: 4.5 }, "MYTH BUSTING"),
            ),
            Text({ variant: "title", color: skin.faint, size: 27, weight: 500, fontFamily: DISPLAY }, topic),
          ),
        ),

        // ── The beat ────────────────────────────────────────────────────
        Frame(
          {
            id: "beat",
            x: colX,
            y: 322,
            width: colW,
            height: 460,
            style: { opacity: beatOp, transform: `translateY(${beatY.toFixed(2)}px)` },
          },

          // Index counter
          Frame(
            { x: 0, y: 0, width: colW, height: 26, style: { opacity: labelIn } },
            Stack(
              { direction: "row", height: 26, gap: 14, align: "center" },
              Text({ variant: "label", color: accentColor, size: 15, weight: 600, fontFamily: MONO, letterSpacing: 3 }, String(index + 1).padStart(2, "0")),
              Frame({ width: 18, height: 1, fill: skin.faint }),
              Text({ variant: "label", color: skin.faint, size: 15, weight: 500, fontFamily: MONO, letterSpacing: 3 }, "CLAIM"),
            ),
          ),

          // The myth, struck at real width
          Frame(
            {
              x: 0,
              y: 58,
              width: colW,
              height: mythBoxH,
              style: { opacity: mythIn, transform: `translateY(${((1 - mythIn) * 20).toFixed(2)}px)` },
            },
            Html({ id: "myth", width: colW, height: mythBoxH, html: mythHtml }),
          ),

          // The truth rises underneath
          Frame(
            {
              x: 0,
              y: 268,
              width: colW,
              height: 130,
              style: { opacity: truthIn, transform: `translateY(${((1 - truthIn) * 26).toFixed(2)}px)` },
            },
            Frame({
              x: 0,
              y: 4,
              width: 5,
              height: 96,
              radius: 3,
              fill: accentColor,
              style: { transform: `scaleY(${truthIn.toFixed(3)})`, transformOrigin: "center top" },
            }),
            Frame(
              { x: 34, y: 0, width: colW - 34, height: 130 },
              Stack(
                { width: colW - 34, gap: 12 },
                Text({ variant: "label", color: accentColor, size: 14, weight: 600, fontFamily: MONO, letterSpacing: 4 }, "ACTUALLY"),
                Text(
                  {
                    variant: "title",
                    color: skin.ink,
                    size: 42,
                    weight: 500,
                    fontFamily: DISPLAY,
                    maxWidth: colW - 60,
                    lineHeight: 1.28,
                  },
                  item.answer,
                ),
              ),
            ),
          ),
        ),

        // ── Beat ticks ──────────────────────────────────────────────────
        Frame(
          { x: colX, y: 902, width: ticksW, height: 6, style: { opacity: chromeOp } },
          Html({ id: "ticks", width: ticksW, height: 6, html: ticksSvg }),
        ),
      ),
    );
  },
});
