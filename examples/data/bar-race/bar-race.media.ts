// Bar race — a four-act broadcast segment, not a chart demo.
//   I. Title card · II. The race · III. The upset (found in the data, played in slow motion)
//   IV. Final standings with the season delta.
// Bars are drawn by hand in SVG so the film owns its own easing, ranking, and callouts.

import { video, Frame, Stack, Text, Fill, Html, googleFont } from "@foxworth/superimg";
import {
  AXIS_MAX,
  BRAND,
  CROSS_TIME,
  FINAL_LEADER,
  LABELS,
  OPENING_LEADER,
  RACE_END,
  RACE_START,
  lanesAt,
  leaderAt,
  valuesAt,
} from "./race.js";

const DISPLAY = "'Archivo', 'Inter Tight', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const STUDIO = {
  bg: "#0B0B0E",
  ink: "#F5F4F0",
  faint: "rgba(245,244,240,0.42)",
  rule: "rgba(245,244,240,0.12)",
  live: "#FF3B30",
  up: "#3DDC97",
  down: "#FF6B6B",
} as const;

export default video({
  duration: "16s",
  poster: "14s",
  fonts: [googleFont("Archivo:wght@600;700;800;900"), googleFont("IBM+Plex+Mono:wght@400;500;600")],
  inlineCss: ["* { margin: 0; padding: 0; box-sizing: border-box; }", "body { overflow: hidden; }"],

  sample: {
    kicker: "US STREAMING",
    title: "One quarter changed the order",
    season: "Q1 → Q4 2025",
    unit: "Subscribers (M) · illustrative",
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const kicker = String(data.kicker);
    const title = String(data.title);
    const season = String(data.season);
    const unit = String(data.unit);

    const t = ctx.director({
      title: "13%",
      race: "48%",
      verdict: "10%",
      standings: "21%",
      exit: "8%",
    });

    // ── Time warp: the crossover plays roughly 2.5× slower than the rest ────
    // Grow in, run, then drop into slow motion for the pass and settle out of it.
    const raceP = t.in("race");
    const cross = CROSS_TIME ?? RACE_END * 0.8;
    const raceTime =
      t.in("standings") > 0 || t.in("verdict") > 0
        ? RACE_END
        : std.interpolate(
            raceP,
            [0, 0.2, 0.54, 0.86, 1],
            [-1.5, 0, Math.max(0.2, cross - 1), Math.min(RACE_END, cross + 0.5), RACE_END],
            "linear",
          );

    const values = valuesAt(raceTime);
    const finalValues = valuesAt(RACE_END);
    const openValues = valuesAt(RACE_START);

    // ── Act mixing ──────────────────────────────────────────────────────────
    const pTitle = t.in("title");
    const pStand = t.in("standings");
    const titleOp = pStand > 0 ? 0 : 1 - std.interpolate(pTitle, [0.76, 1], [0, 1], "easeInCubic");
    const chartOp =
      std.interpolate(pTitle, [0.7, 1], [0, 1], "easeOutCubic") *
      (1 - std.interpolate(pStand, [0, 0.16], [0, 1], "easeInCubic"));
    const standOp = std.interpolate(pStand, [0.04, 0.24], [0, 1], "easeOutCubic");
    const sheetOp = 1 - std.interpolate(t.in("exit"), [0, 1], [0, 1], "easeInCubic");

    // ── Plot geometry ───────────────────────────────────────────────────────
    const plotX = 430;
    const plotY = 306;
    const plotW = width - plotX - 210;
    const rowH = 106;
    const barH = 66;
    const plotH = rowH * LABELS.length;

    const leader = leaderAt(raceTime);
    const upset =
      CROSS_TIME === null ? 0 : std.clamp01((raceTime - CROSS_TIME) / 0.34);
    const flash = CROSS_TIME === null ? 0 : Math.max(0, 1 - Math.abs(raceTime - CROSS_TIME) / 0.4);

    const quarter = Math.max(1, Math.min(4, Math.floor(Math.max(0, raceTime) / 1.5) + 1));
    const quarterFrac = raceTime >= RACE_END ? 1 : std.clamp01((Math.max(0, raceTime) % 1.5) / 1.5);

    // ── The chart ───────────────────────────────────────────────────────────
    const ticks = [0, 25, 50, 75, 100]
      .map((v) => {
        const x = (v / AXIS_MAX) * plotW;
        const on = std.clamp01((chartOp - 0.2) / 0.5);
        return `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${plotH}" stroke="${STUDIO.rule}" stroke-width="1" opacity="${on.toFixed(3)}"/>
<text x="${x.toFixed(1)}" y="${plotH + 34}" text-anchor="middle" font-family="${MONO}" font-size="15" fill="${STUDIO.faint}" opacity="${on.toFixed(3)}">${v}</text>`;
      })
      .join("\n");

    const bars = lanesAt(raceTime, rowH, barH, RACE_END).map(({ label, y }) => {
      const value = values.get(label) ?? 0;
      const w = Math.max(0, (value / AXIS_MAX) * plotW);
      const color = BRAND[label] ?? "#8892A6";
      const isLeader = label === leader;
      const involved = flash > 0 && (label === FINAL_LEADER || label === OPENING_LEADER);
      const lit = involved ? flash : 0;

      return `<g>
  <rect x="0" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${barH}" rx="6" fill="${color}" opacity="${isLeader ? 1 : 0.82}"/>
  <rect x="0" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${barH}" rx="6" fill="url(#bar-sheen)"/>
  ${lit > 0 ? `<rect x="-3" y="${(y - 3).toFixed(2)}" width="${(w + 6).toFixed(2)}" height="${barH + 6}" rx="8" fill="none" stroke="${STUDIO.ink}" stroke-width="2" opacity="${(lit * 0.85).toFixed(3)}"/>` : ""}
  <text x="${-26}" y="${(y + barH / 2 + 9).toFixed(2)}" text-anchor="end" font-family="${DISPLAY}" font-size="30" font-weight="${isLeader ? 800 : 600}"
        fill="${isLeader ? STUDIO.ink : "rgba(245,244,240,0.72)"}">${label}</text>
  <text x="${(w + 22).toFixed(2)}" y="${(y + barH / 2 + 10).toFixed(2)}" font-family="${MONO}" font-size="30" font-weight="600"
        fill="${isLeader ? color : "rgba(245,244,240,0.62)"}">${value.toFixed(1)}</text>
  ${isLeader && w > 160 ? `<rect x="${(w - 96).toFixed(2)}" y="${(y + 12).toFixed(2)}" width="80" height="26" rx="13" fill="rgba(0,0,0,0.34)"/>
  <text x="${(w - 56).toFixed(2)}" y="${(y + 30).toFixed(2)}" text-anchor="middle" font-family="${MONO}" font-size="13" font-weight="600" letter-spacing="2" fill="${STUDIO.ink}">LEAD</text>` : ""}
</g>`;
    }).join("\n");

    const chartSvg = `<svg width="${plotW + 60}" height="${plotH + 56}" viewBox="0 0 ${plotW + 60} ${plotH + 56}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
  <defs>
    <linearGradient id="bar-sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.18"/>
      <stop offset="52%" stop-color="#fff" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.14"/>
    </linearGradient>
  </defs>
${ticks}
${bars}
</svg>`;

    // ── Quarter clock ───────────────────────────────────────────────────────
    const clockSvg = `<svg width="230" height="8" viewBox="0 0 230 8" xmlns="http://www.w3.org/2000/svg">
${[0, 1, 2, 3]
  .map((i) => {
    const w = 50;
    const x = i * 60;
    const done = i + 1 < quarter ? 1 : i + 1 === quarter ? quarterFrac : 0;
    return `<rect x="${x}" y="3" width="${w}" height="2" rx="1" fill="${STUDIO.rule}"/><rect x="${x}" y="2" width="${(w * done).toFixed(1)}" height="4" rx="2" fill="${STUDIO.live}"/>`;
  })
  .join("")}
</svg>`;

    // ── Final standings ─────────────────────────────────────────────────────
    const finalOrder = [...LABELS].sort((a, b) => (finalValues.get(b) ?? 0) - (finalValues.get(a) ?? 0));
    const standRows = finalOrder.map((label, i) => {
      const p = std.interpolate(std.clamp01((pStand - 0.12 - i * 0.055) / 0.3), [0, 1], [0, 1], "easeOutQuint");
      const value = finalValues.get(label) ?? 0;
      const delta = value - (openValues.get(label) ?? 0);
      const color = BRAND[label] ?? "#8892A6";
      const rowW = 1180;
      const win = i === 0;

      return Frame(
        {
          x: 0,
          y: i * 104,
          width: rowW,
          height: 92,
          style: { opacity: p, transform: `translateY(${((1 - p) * 22).toFixed(2)}px)` },
        },
        Frame({
          width: rowW,
          height: 92,
          radius: 12,
          fill: win ? std.color.alpha(color, 0.14) : "rgba(255,255,255,0.035)",
          style: { border: `1px solid ${win ? std.color.alpha(color, 0.5) : STUDIO.rule}` },
        }),
        Frame({ x: 0, y: 0, width: 5, height: 92, radius: 3, fill: color }),
        Frame(
          { x: 34, y: 0, width: rowW - 68, height: 92 },
          Stack(
            { direction: "row", width: rowW - 68, height: 92, gap: 30, align: "center" },
            Frame(
              { width: 54, height: 44 },
              Stack(
                { width: 54, height: 44, justify: "center" },
                Text({ variant: "title", color: win ? color : STUDIO.faint, size: 34, weight: 800, fontFamily: MONO }, String(i + 1)),
              ),
            ),
            Frame(
              { width: 470, height: 44 },
              Stack(
                { width: 470, height: 44, justify: "center" },
                Text({ variant: "title", color: STUDIO.ink, size: 34, weight: win ? 800 : 600, fontFamily: DISPLAY, letterSpacing: -0.8 }, label),
              ),
            ),
            Frame(
              { width: 220, height: 44 },
              Stack(
                { width: 220, height: 44, justify: "center" },
                Text({ variant: "title", color: STUDIO.ink, size: 36, weight: 600, fontFamily: MONO, align: "right" }, value.toFixed(0)),
              ),
            ),
            Frame(
              { width: 190, height: 44 },
              Stack(
                { width: 190, height: 44, justify: "center" },
                Text(
                  {
                    variant: "label",
                    color: delta >= 0 ? STUDIO.up : STUDIO.down,
                    size: 25,
                    weight: 600,
                    fontFamily: MONO,
                    align: "right",
                  },
                  `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(0)}`,
                ),
              ),
            ),
          ),
        ),
      );
    });

    const verdict =
      CROSS_TIME === null
        ? `${FINAL_LEADER} holds the lead all year`
        : `${FINAL_LEADER} overtakes ${OPENING_LEADER} in Q4`;

    // ── Act I: title card ───────────────────────────────────────────────────
    const tk = std.interpolate(pTitle, [0.02, 0.3], [0, 1], "easeOutQuint");
    const tt = std.interpolate(pTitle, [0.12, 0.5], [0, 1], "easeOutQuint");
    const ts = std.interpolate(pTitle, [0.3, 0.66], [0, 1], "easeOutCubic");

    return Frame(
      { id: "broadcast", width, height },
      Fill({ color: STUDIO.bg }),
      Fill({ gradient: { kind: "radial", at: "50% 0%", size: "78% 52%", stops: ["rgba(255,255,255,0.055)", "transparent"] } }),
      Fill({ gradient: { kind: "linear", angle: "180deg", stops: ["transparent", "rgba(0,0,0,0.55) 100%"] } }),

      Frame(
        { x: 0, y: 0, width, height, style: { opacity: sheetOp } },

        // ── Act I ─────────────────────────────────────────────────────
        titleOp > 0.001
          ? Frame(
              { id: "title-card", x: 0, y: 0, width, height, style: { opacity: titleOp } },
              Frame(
                { x: 210, y: 372, width: width - 420, height: 340 },
                Stack(
                  { width: width - 420, gap: 26 },
                  Stack(
                    { direction: "row", height: 28, gap: 18, align: "center", style: { opacity: tk, transform: `translateY(${((1 - tk) * 12).toFixed(2)}px)` } },
                    Frame({ width: 44, height: 4, fill: STUDIO.live }),
                    Text({ variant: "label", color: STUDIO.live, size: 17, weight: 600, fontFamily: MONO, letterSpacing: 7 }, kicker.toUpperCase()),
                    Text({ variant: "label", color: STUDIO.faint, size: 17, weight: 500, fontFamily: MONO, letterSpacing: 4 }, season),
                  ),
                  Text(
                    {
                      variant: "display",
                      color: STUDIO.ink,
                      size: 108,
                      weight: 900,
                      fontFamily: DISPLAY,
                      letterSpacing: -4.5,
                      maxWidth: width - 500,
                      style: {
                        lineHeight: 1.02,
                        opacity: tt,
                        transform: `translateY(${((1 - tt) * 26).toFixed(2)}px)`,
                      },
                    },
                    title,
                  ),
                  Text(
                    {
                      variant: "body",
                      color: STUDIO.faint,
                      size: 26,
                      fontFamily: DISPLAY,
                      style: { opacity: ts },
                    },
                    unit,
                  ),
                ),
              ),
            )
          : null,

        // ── Acts II + III ─────────────────────────────────────────────
        chartOp > 0.001
          ? Frame(
              { id: "race", x: 0, y: 0, width, height, style: { opacity: chartOp } },

              // Broadcast bug
              Frame(
                { x: 210, y: 128, width: 900, height: 106 },
                Stack(
                  { width: 900, gap: 14 },
                  Stack(
                    { direction: "row", height: 24, gap: 16, align: "center" },
                    Frame({ width: 10, height: 10, radius: 5, fill: STUDIO.live, style: { boxShadow: `0 0 14px ${STUDIO.live}` } }),
                    Text({ variant: "label", color: STUDIO.live, size: 15, weight: 600, fontFamily: MONO, letterSpacing: 5 }, kicker.toUpperCase()),
                    Text({ variant: "label", color: STUDIO.faint, size: 15, weight: 500, fontFamily: MONO, letterSpacing: 3 }, unit),
                  ),
                  Text({ variant: "display", color: STUDIO.ink, size: 54, weight: 800, fontFamily: DISPLAY, letterSpacing: -1.8 }, `Q${quarter} 2025`),
                ),
              ),

              // Quarter clock, top right
              Frame(
                { x: width - 210 - 230, y: 136, width: 230, height: 66 },
                Stack(
                  { width: 230, gap: 14 },
                  Text({ variant: "label", color: STUDIO.faint, size: 13, weight: 600, fontFamily: MONO, letterSpacing: 4, align: "right" }, "SEASON"),
                  Html({ width: 230, height: 8, html: clockSvg }),
                ),
              ),

              // Lead-change callout — appears the frame the data flips
              upset > 0.001
                ? Frame(
                    {
                      id: "callout",
                      x: plotX,
                      y: plotY - 82,
                      width: 760,
                      height: 46,
                      style: {
                        opacity: std.clamp01(upset * 2),
                        transform: `translateX(${((1 - std.interpolate(upset, [0, 1], [0, 1], "easeOutQuint")) * -26).toFixed(2)}px)`,
                      },
                    },
                    Stack(
                      { direction: "row", height: 46, gap: 16, align: "center" },
                      Frame(
                        { width: 168, height: 34, radius: 4, fill: STUDIO.live },
                        Stack(
                          { width: 168, height: 34, align: "center", justify: "center" },
                          Text({ variant: "label", color: "#fff", size: 14, weight: 700, fontFamily: MONO, letterSpacing: 3 }, "LEAD CHANGE"),
                        ),
                      ),
                      Text({ variant: "title", color: STUDIO.ink, size: 27, weight: 700, fontFamily: DISPLAY }, `${FINAL_LEADER} passes ${OPENING_LEADER}`),
                    ),
                  )
                : null,

              // A whisper of a push-in on the pass — broadcast weight, not a zoom.
              Frame(
                {
                  x: plotX,
                  y: plotY,
                  width: plotW + 60,
                  height: plotH + 56,
                  style: { transform: `scale(${(1 + flash * 0.011).toFixed(4)})`, transformOrigin: "0% 50%" },
                },
                Html({ id: "chart", width: plotW + 60, height: plotH + 56, html: chartSvg }),
              ),
            )
          : null,

        // ── Act IV ────────────────────────────────────────────────────
        standOp > 0.001
          ? Frame(
              { id: "standings", x: 0, y: 0, width, height, style: { opacity: standOp } },
              Frame(
                { x: 370, y: 118, width: 1180, height: 96 },
                Stack(
                  { width: 1180, gap: 14 },
                  Stack(
                    { direction: "row", height: 24, gap: 16, align: "center" },
                    Frame({ width: 34, height: 3, fill: STUDIO.live }),
                    Text({ variant: "label", color: STUDIO.live, size: 15, weight: 600, fontFamily: MONO, letterSpacing: 5 }, "FINAL STANDINGS"),
                    Text({ variant: "label", color: STUDIO.faint, size: 15, weight: 500, fontFamily: MONO, letterSpacing: 3 }, season),
                  ),
                  Text({ variant: "display", color: STUDIO.ink, size: 52, weight: 800, fontFamily: DISPLAY, letterSpacing: -1.8 }, verdict),
                ),
              ),
              Frame({ x: 370, y: 258, width: 1180, height: 520 }, ...standRows),
              Frame(
                { x: 370, y: 806, width: 1180, height: 30, style: { opacity: std.clamp01((pStand - 0.55) / 0.25) } },
                Stack(
                  { direction: "row", height: 30, gap: 14, align: "center" },
                  Text({ variant: "label", color: STUDIO.faint, size: 16, fontFamily: MONO, letterSpacing: 2 }, "Δ vs Q1"),
                  Frame({ width: 1, height: 16, fill: STUDIO.rule }),
                  Text({ variant: "label", color: STUDIO.faint, size: 16, fontFamily: MONO, letterSpacing: 2 }, unit),
                ),
              ),
            )
          : null,
      ),
    );
  },
});
