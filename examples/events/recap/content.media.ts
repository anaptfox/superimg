// Recap · scene 2 — the night itself: what it added up to, then what it looked like.

import { video, Frame, Text, Html, type RenderContext } from "@foxworth/superimg";
import { chrome, picture, CREAM, PINK, SUN, DISPLAY, MONO, RECAP_CSS, RECAP_FONTS } from "./recap-kit.js";

export interface RecapStat {
  value: string;
  label: string;
}

export interface RecapContentData extends Record<string, unknown> {
  statsHeading: string;
  stats: RecapStat[];
  momentsHeading: string;
  moments: string[];
  reel: string;
}

function numberOf(value: string): number | undefined {
  const m = /^(\d+)/.exec(value.trim());
  return m ? Number(m[1]) : undefined;
}

export default video<RecapContentData>({
  duration: "8s",
  fps: 30,
  fonts: RECAP_FONTS,
  inlineCss: RECAP_CSS,
  sample: {
    statsHeading: "The night in numbers",
    stats: [
      { value: "42", label: "Neighbors showed up" },
      { value: "3", label: "Lightning talks" },
      { value: "11", label: "First-timers" },
    ],
    momentsHeading: "What it looked like",
    moments: [
      "Doors at 11, laptops by 11:05",
      "Standing room before the first talk",
      "Someone shipped during the demo",
      "Two job offers in the hallway",
      "Last table packed up at 2",
    ],
    reel: "REEL 03 · 2026",
  },

  render(ctx: RenderContext<RecapContentData>) {
    const { std, width, height, data } = ctx;
    const stats = data.stats ?? [];
    const moments = data.moments ?? [];
    const s = Math.min(width, height) / 1080;
    const px = (n: number) => Math.round(n * s);
    const alpha = (c: string, a: number) => std.color.alpha(c, a);

    const t = ctx.director({ count: "46%", turn: "8%", sheet: "46%" });
    const count = t.in("count");
    const turn = t.in("turn");
    const sheet = t.in("sheet");
    const onSheet = std.interpolate(turn, [0, 1], [0, 1], "easeInOutCubic");

    const inset = px(38) + px(58);
    const colGap = px(48);
    const colW = Math.round((width - inset * 2 - colGap * (Math.max(1, stats.length) - 1)) / Math.max(1, stats.length));
    const headY = Math.round(height * 0.30);

    // ---- act one: the numbers --------------------------------------------
    const statCols = stats.map((stat, i) => {
      const p = std.interpolate(count, [0.12 + i * 0.14, 0.62 + i * 0.14], [0, 1], "easeOutQuint");
      const num = numberOf(stat.value);
      const shown =
        num === undefined ? stat.value : String(Math.round(std.interpolate(p, [0, 1], [0, num]))) + stat.value.replace(/^\d+/, "");
      const ink = [CREAM, PINK, SUN][i % 3]!;
      return Frame(
        {
          x: inset + i * (colW + colGap),
          y: headY + px(96),
          width: colW,
          height: px(320),
          style: {
            opacity: (1 - onSheet) * std.interpolate(p, [0, 0.3], [0, 1], "easeOutCubic"),
            transform: `translateY(${((1 - p) * px(40) + onSheet * px(-60)).toFixed(1)}px)`,
          },
        },
        Frame({
          x: 0,
          y: 0,
          width: colW,
          height: px(4),
          fill: alpha(ink, 0.55),
          style: { transformOrigin: "left center", transform: `scaleX(${p.toFixed(3)})` },
        }),
        Frame(
          { x: 0, y: px(26), width: colW, height: px(206) },
          Text(
            {
              variant: "display",
              size: px(200),
              weight: 400,
              letterSpacing: px(-8),
              lineHeight: 1,
              fontFamily: DISPLAY,
              color: ink,
            },
            shown,
          ),
        ),
        Frame(
          { x: 0, y: px(244), width: colW, height: px(70) },
          Text(
            {
              variant: "title",
              size: px(28),
              weight: 500,
              lineHeight: 1.25,
              color: alpha(CREAM, 0.68),
            },
            stat.label,
          ),
        ),
      );
    });

    // ---- act two: the contact sheet ---------------------------------------
    const tileW = px(430);
    const tileH = px(300);
    const tileGap = px(22);
    const span = tileW + tileGap;
    // Each picture gets a reading hold; the final beat stays centred.
    const beat = moments.length > 0
      ? t.beats({ during: "sheet", of: moments.map((_, i) => `moment-${i}`), cross: "22%" })
      : undefined;
    const focus = beat
      ? beat.index + (beat.crossing ? std.interpolate(beat.mix, [0, 1], [0, 1], "easeInOutCubic") : 0)
      : 0;
    const scrollX = Math.round(width / 2 - tileW / 2 - focus * span);
    const sheetY = Math.round(height * 0.34);

    const tiles = moments.map((caption, i) => {
      const near = Math.max(0, 1 - Math.abs(focus - i));
      const enter = std.interpolate(onSheet, [0, 1], [px(70), 0], "easeOutCubic");
      return Frame(
        {
          x: scrollX + i * span,
          y: sheetY + Math.round(enter) + Math.round((1 - near) * px(26)),
          width: tileW,
          height: tileH,
          radius: px(4),
          style: {
            opacity: onSheet * (0.5 + 0.5 * near),
            transformOrigin: "center center",
            transform: `scale(${(0.92 + 0.12 * near).toFixed(3)})`,
            boxShadow: `0 ${px(24)}px ${px(52)}px rgba(0,0,0,${(0.36 * near).toFixed(2)})`,
          },
        },
        Html({ width: tileW, height: tileH, html: picture(`moment-${i}-${caption.length}`, tileW, tileH) }),
        Frame({
          x: 0,
          y: 0,
          width: tileW,
          height: tileH,
          fill: alpha("#0B302F", 0.4 * (1 - near)),
        }),
        Frame(
          { x: px(16), y: tileH - px(34), width: tileW - px(32), height: px(20) },
          Text(
            { variant: "label", size: px(15), weight: 600, letterSpacing: px(2.2), fontFamily: MONO, color: alpha("#0B302F", 0.62) },
            `FRAME ${String(i + 1).padStart(2, "0")}`,
          ),
        ),
      );
    });

    const caption = moments[Math.max(0, Math.min(moments.length - 1, Math.round(focus)))] ?? "";
    const captionStep = Math.round(focus);
    const captionLocal = Math.abs(focus - captionStep);
    const captionIn = std.interpolate(Math.min(1, captionLocal / 0.42), [0, 1], [1, 0], "easeInOutCubic");

    return Frame(
      { id: "stage", width, height },
      ...chrome({
        width,
        height,
        px,
        alpha,
        sceneNo: "02",
        sceneLabel: onSheet > 0.5 ? "CONTACT SHEET" : "THE COUNT",
        reel: data.reel,
        progress: 0.26 + ctx.timeline.progress * 0.55,
        reveal: 1,
      }),
      // heading swaps once, on the turn
      Frame(
        {
          x: inset,
          y: headY,
          width: Math.round(width * 0.7),
          height: px(70),
          style: { opacity: 1 - onSheet, transform: `translateY(${(onSheet * px(-40)).toFixed(1)}px)` },
        },
        Text(
          { variant: "display", size: px(56), weight: 400, letterSpacing: px(-1.6), fontFamily: DISPLAY, color: CREAM },
          data.statsHeading.toUpperCase(),
        ),
      ),
      Frame(
        {
          x: inset,
          y: Math.round(height * 0.14),
          width: Math.round(width * 0.7),
          height: px(70),
          style: { opacity: onSheet, transform: `translateY(${((1 - onSheet) * px(30)).toFixed(1)}px)` },
        },
        Text(
          { variant: "display", size: px(56), weight: 400, letterSpacing: px(-1.6), fontFamily: DISPLAY, color: CREAM },
          data.momentsHeading.toUpperCase(),
        ),
      ),
      ...statCols,
      ...tiles,
      // the caption for the frame under the playhead
      Frame(
        {
          x: inset,
          y: sheetY + tileH + px(96),
          width: width - inset * 2,
          height: px(90),
          style: { opacity: onSheet * captionIn },
        },
        Frame({ x: 0, y: 0, width: px(60), height: px(4), fill: PINK }),
        Frame(
          { x: 0, y: px(24), width: width - inset * 2, height: px(60) },
          Text(
            { variant: "title", size: px(42), weight: 600, letterSpacing: px(-0.8), color: CREAM },
            caption,
          ),
        ),
      ),
      // playhead
      Frame({
        x: Math.round(width / 2 - px(1)),
        y: sheetY - px(26),
        width: px(2),
        height: tileH + px(52),
        fill: alpha(PINK, 0.5 * onSheet),
      }),
    );
  },
});
