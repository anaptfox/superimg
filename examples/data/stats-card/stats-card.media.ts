// Stats card — one obsidian trading card that lands, counts itself up, and draws its own tape.
// Material: black glass, one mint (or rose) accent, tabular mono numerals. No dashboard chrome.

import {
  video,
  Frame,
  Stack,
  Text,
  Fill,
  Html,
  Spacer,
  type FrameProps,
  type MediaChild,
  type MediaElement,
  googleFont,
} from "@foxworth/superimg";

const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace";
const SANS = "'Inter', system-ui, sans-serif";

const INK = "#08080B";
const GLASS_TOP = "rgba(255,255,255,0.055)";
const GLASS_BOT = "rgba(255,255,255,0.018)";
const CHALK = "#F4F3F0";
const MUTED = "rgba(244,243,240,0.42)";

type SurfaceProps = Omit<FrameProps, "style"> & {
  border?: string;
  style?: Record<string, string | number | undefined>;
};

/** The trading-card material is an example recipe composed from the layout kernel. */
function Surface(props: SurfaceProps, ...children: MediaChild[]): MediaElement {
  const { border, style, ...frame } = props;
  return Frame(
    {
      radius: 16,
      pad: 20,
      fill: "rgba(255,255,255,0.06)",
      ...frame,
      style: border ? { ...style, border } : style,
    },
    ...children,
  );
}

type Pt = { x: number; y: number };

/** Catmull-Rom through every sample — a tape, not a polyline. */
function tapePath(pts: readonly Pt[]): string {
  if (pts.length < 2) return "";
  const out: string[] = [`M${pts[0]!.x.toFixed(2)},${pts[0]!.y.toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    out.push(
      `C${(p1.x + (p2.x - p0.x) / 6).toFixed(2)},${(p1.y + (p2.y - p0.y) / 6).toFixed(2)}` +
        ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)},${(p2.y - (p3.y - p1.y) / 6).toFixed(2)}` +
        ` ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`,
    );
  }
  return out.join("");
}


export default video({
  duration: "6s",
  poster: "4.4s",
  fonts: [googleFont("IBM+Plex+Mono:wght@400;500;600"), googleFont("Inter:wght@400;500;600")],
  inlineCss: ["* { margin: 0; padding: 0; box-sizing: border-box; }", "body { overflow: hidden; }"],

  sample: {
    symbol: "AAPL",
    companyName: "Apple Inc.",
    price: 230.5,
    change: 2.5,
    changePercent: 1.09,
    high: 231.5,
    low: 229.2,
    sparkline: [228, 229.5, 230, 229.8, 230.5],
    upColor: "#3DDC97",
    downColor: "#FF5C7A",
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { symbol, companyName, price, change, changePercent, high, low, sparkline } = data;

    const t = ctx.director({
      land: "14%",
      count: "22%",
      tape: "22%",
      hold: "32%",
      exit: "10%",
    });

    const up = change >= 0;
    const accent = up ? data.upColor : data.downColor;
    const sign = up ? "+" : "−";

    // ── Card geometry ───────────────────────────────────────────────────────
    const cardW = 820;
    const cardH = 628;
    const pad = 56;
    const inner = cardW - pad * 2;
    const cardX = Math.round((width - cardW) / 2);
    const cardY = Math.round((height - cardH) / 2);

    // ── Motion ──────────────────────────────────────────────────────────────
    const cardIn = t.motion({
      id: "card",
      during: "land",
      at: "0%",
      for: "80%",
      y: 26,
      scale: 0.975,
      fromOpacity: 0,
      easing: "easeOutQuint",
      exit: { during: "exit", at: "0%", for: "80%", y: -14, scale: 0.99, easing: "easeInCubic" },
    });
    const identityIn = t.motion({
      id: "identity",
      during: "land",
      at: "35%",
      for: "65%",
      y: 10,
      fromOpacity: 0,
      easing: "easeOutCubic",
    });
    const deltaIn = t.motion({
      id: "delta",
      during: "count",
      at: "68%",
      for: "26%",
      scale: 0.86,
      fromOpacity: 0,
      easing: "snappy",
    });
    const footerIn = t.motion({
      id: "footer",
      during: "tape",
      at: "45%",
      for: "40%",
      y: 8,
      fromOpacity: 0,
      easing: "easeOutCubic",
    });

    // Accent hairline wipes across the card lip as it lands.
    const lipP = t.tween(0, 1, { id: "lip", during: "land", at: "18%", for: "70%", easing: "easeOutQuart" });

    // Price counts from the session open to the close, then sits still.
    const open = sparkline[0] ?? price;
    const shown = t.tween(open, price, {
      id: "price-count",
      during: "count",
      at: "0%",
      for: "82%",
      easing: "easeOutQuint",
    });
    // A single settle tick the instant the count lands — weight, not decoration.
    const settle = std.interpolate(t.in("count"), [0.78, 0.88, 1], [0, 1, 0], "easeOutCubic");

    // ── Tape (sparkline) ────────────────────────────────────────────────────
    const tapeW = inner;
    const tapeH = 148;
    const lo = Math.min(...sparkline, low);
    const hi = Math.max(...sparkline, high);
    const range = hi - lo || 1;
    const padTop = 18;
    const usable = tapeH - padTop - 14;
    const pts: Pt[] = sparkline.map((v, i) => ({
      x: (i / Math.max(1, sparkline.length - 1)) * tapeW,
      y: padTop + (1 - (v - lo) / range) * usable,
    }));

    const drawP = t.tween(0, 1, { id: "tape-draw", during: "tape", at: "0%", for: "88%", easing: "easeInOutCubic" });
    const line = tapePath(pts);
    const head = line ? std.svg.bezier.pointAt(line, drawP) : (pts[0] ?? { x: 0, y: tapeH / 2 });
    const area = line ? `${line}L${tapeW.toFixed(2)},${tapeH}L0,${tapeH}Z` : "";
    const revealW = Math.max(0.01, head.x);
    const dotOn = pts.length > 0 && drawP > 0.015 ? 1 : 0;

    const tapeSvg = `<svg width="${tapeW}" height="${tapeH}" viewBox="0 0 ${tapeW} ${tapeH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tape-wash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="tape-reveal"><rect x="0" y="0" width="${revealW.toFixed(2)}" height="${tapeH}"/></clipPath>
  </defs>
  <line x1="0" y1="${tapeH - 1}" x2="${tapeW}" y2="${tapeH - 1}" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>
  <g clip-path="url(#tape-reveal)">
    <path d="${area}" fill="url(#tape-wash)"/>
    <path d="${line}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g opacity="${dotOn}">
    <line x1="${head.x.toFixed(2)}" y1="${(head.y + 7).toFixed(2)}" x2="${head.x.toFixed(2)}" y2="${tapeH - 1}" stroke="${accent}" stroke-width="1" stroke-opacity="0.32"/>
    <circle cx="${head.x.toFixed(2)}" cy="${head.y.toFixed(2)}" r="11" fill="${accent}" fill-opacity="0.16"/>
    <circle cx="${head.x.toFixed(2)}" cy="${head.y.toFixed(2)}" r="4.5" fill="${accent}"/>
  </g>
</svg>`;

    // ── Day-range rail: where the close sits between low and high ───────────
    const railW = inner;
    const seat = std.math.clamp((price - low) / (high - low || 1), 0, 1);
    const railP = t.tween(0, 1, { id: "rail", during: "tape", at: "52%", for: "44%", easing: "easeOutCubic" });
    const knobX = seat * railW * railP;
    const railSvg = `<svg width="${railW}" height="16" viewBox="0 0 ${railW} 16" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="7" width="${railW}" height="2" rx="1" fill="rgba(255,255,255,0.10)"/>
  <rect x="0" y="7" width="${(seat * railW * railP).toFixed(2)}" height="2" rx="1" fill="${accent}" fill-opacity="0.55"/>
  <rect x="${(knobX - 1.5).toFixed(2)}" y="2" width="3" height="12" rx="1.5" fill="${accent}" opacity="${railP.toFixed(3)}"/>
</svg>`;

    function railTick(label: string, value: number, side: "left" | "right") {
      const align = side === "left" ? ("left" as const) : ("right" as const);
      return Stack(
        { width: 220, height: 46, gap: 5 },
        Text({ variant: "label", color: MUTED, size: 12, weight: 600, fontFamily: SANS, letterSpacing: 1.4, align }, label),
        Text({ variant: "label", color: "rgba(244,243,240,0.78)", size: 19, fontFamily: MONO, weight: 500, align }, `$${value.toFixed(2)}`),
      );
    }

    return Frame(
      { id: "stage", width, height },
      Fill({ color: INK }),
      Fill({
        gradient: { kind: "radial", at: "50% 34%", size: "62% 58%", stops: [std.color.alpha(accent, 0.13), "transparent"] },
      }),
      Fill({
        gradient: { kind: "radial", at: "50% 120%", size: "70% 60%", stops: ["rgba(255,255,255,0.05)", "transparent"] },
      }),

      Frame(
        { x: cardX, y: cardY, width: cardW, height: cardH, motion: cardIn },
        Surface(
          {
            id: "quote-card",
            width: cardW,
            height: cardH,
            radius: 26,
            pad: 0,
            overflow: "hidden",
            fill: `linear-gradient(158deg, ${GLASS_TOP}, ${GLASS_BOT})`,
            border: "1px solid rgba(255,255,255,0.10)",
            style: {
              boxShadow: `0 48px 120px rgba(0,0,0,0.62), 0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.09)`,
            },
          },
          // Accent lip along the top edge — wipes in as the card seats.
          Frame({
            width: cardW,
            height: 3,
            fill: accent,
            style: { transform: `scaleX(${lipP.toFixed(4)})`, transformOrigin: "left center" },
          }),

          Stack(
            { width: "fill", height: "fill", pad, gap: 0 },

            // Identity
            Stack(
              { direction: "row", width: "fill", height: 72, align: "start", justify: "space-between", motion: identityIn },
              Stack(
                { gap: 7 },
                Text({ variant: "title", color: CHALK, size: 34, weight: 600, fontFamily: MONO, letterSpacing: 3 }, symbol),
                Text({ variant: "caption", color: MUTED, size: 17, fontFamily: SANS }, companyName),
              ),
              Stack(
                { direction: "row", gap: 9, align: "center", height: 26 },
                Frame({
                  width: 7,
                  height: 7,
                  radius: 4,
                  fill: accent,
                  style: { boxShadow: `0 0 12px ${std.color.alpha(accent, 0.9)}` },
                }),
                Text({ variant: "label", color: MUTED, size: 12, weight: 600, fontFamily: SANS, letterSpacing: 2 }, "MARKET CLOSE"),
              ),
            ),

            Spacer({ height: 28 }),

            // Hero number + delta
            Stack(
              { direction: "row", width: "fill", height: 116, align: "end", justify: "space-between" },
              Text(
                {
                  id: "price",
                  variant: "display",
                  color: CHALK,
                  size: 92,
                  weight: 600,
                  fontFamily: MONO,
                  letterSpacing: -2,
                  style: {
                    fontVariantNumeric: "tabular-nums",
                    transform: `scale(${(1 + settle * 0.012).toFixed(4)})`,
                    transformOrigin: "left bottom",
                    lineHeight: 1,
                  },
                },
                `$${shown.toFixed(2)}`,
              ),
              Surface(
                {
                  id: "delta",
                  radius: 11,
                  pad: { x: 15, y: 9 },
                  fill: std.color.alpha(accent, 0.13),
                  border: `1px solid ${std.color.alpha(accent, 0.32)}`,
                  motion: deltaIn,
                },
                Stack(
                  { direction: "row", gap: 10, align: "center", height: 26 },
                  Text({ variant: "label", color: accent, size: 21, weight: 600, fontFamily: MONO }, `${sign}${Math.abs(change).toFixed(2)}`),
                  Frame({ width: 1, height: 16, fill: std.color.alpha(accent, 0.3) }),
                  Text({ variant: "label", color: accent, size: 21, weight: 600, fontFamily: MONO }, `${sign}${Math.abs(changePercent).toFixed(2)}%`),
                ),
              ),
            ),

            Spacer({ height: 24 }),
            Html({ id: "tape", width: tapeW, height: tapeH, html: tapeSvg }),
            Spacer(),

            // Day range
            Stack(
              { gap: 10, width: "fill", height: 72, motion: footerIn },
              Stack(
                { direction: "row", width: "fill", height: 46, justify: "space-between", align: "start" },
                railTick("LOW", low, "left"),
                railTick("HIGH", high, "right"),
              ),
              Html({ id: "rail", width: railW, height: 16, html: railSvg }),
            ),
          ),
        ),
      ),
    );
  },
});
