// Schedule — the week drafted on a blueprint. Grid lines rule themselves in, blocks are
// laid down like tape, then a dimension line measures how much of the week is real work.

import { video, Frame, Stack, Text, Fill, Html, googleFont } from "@foxworth/superimg";

export interface ScheduleBlock {
  start: number;
  duration: number;
  type: "deep" | "meeting";
  label: string;
}

export interface ScheduleVideoData extends Record<string, unknown> {
  schedule: Record<string, ScheduleBlock[]>;
  theme: "dark" | "light";
}

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16] as const;

/** Blueprint (diazo negative) and whiteprint (positive) — same drawing, two press runs. */
const SHEETS = {
  dark: {
    paper: "#072B45",
    glow: "#0E4468",
    rule: "rgba(160,220,245,0.20)",
    ruleBold: "rgba(160,220,245,0.42)",
    ink: "#E8F4FA",
    faint: "rgba(232,244,250,0.52)",
    deep: "#4FC7EE",
    meet: "#F0A055",
  },
  light: {
    paper: "#E9EFF2",
    glow: "#FFFFFF",
    rule: "rgba(7,43,69,0.16)",
    ruleBold: "rgba(7,43,69,0.38)",
    ink: "#072B45",
    faint: "rgba(7,43,69,0.55)",
    deep: "#12708F",
    meet: "#B8611A",
  },
} as const;



export default video<ScheduleVideoData>({
  duration: "9s",
  poster: "6.4s",
  fonts: [googleFont("IBM+Plex+Mono:wght@400;500;600"), googleFont("Inter:wght@400;500;600")],
  inlineCss: ["* { margin: 0; padding: 0; box-sizing: border-box; }", "body { overflow: hidden; }"],

  sample: {
    schedule: {
      Mon: [
        { start: 9, duration: 2, type: "deep", label: "Deep work" },
        { start: 14, duration: 1, type: "meeting", label: "Standup" },
      ],
      Tue: [{ start: 14, duration: 1, type: "meeting", label: "Code review" }],
      Wed: [
        { start: 11, duration: 2, type: "deep", label: "Sprint planning" },
        { start: 15, duration: 1, type: "meeting", label: "1:1" },
      ],
      Thu: [{ start: 10, duration: 3, type: "deep", label: "Feature build" }],
      Fri: [{ start: 13, duration: 2, type: "meeting", label: "Demo day" }],
    },
    theme: "dark",
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { schedule, theme } = data;
    const sheet = theme === "light" ? SHEETS.light : SHEETS.dark;

    const t = ctx.director({
      rule: "16%",
      label: "9%",
      lay: "26%",
      measure: "14%",
      hold: "26%",
      exit: "9%",
    });

    // ── Sheet geometry ──────────────────────────────────────────────────────
    const margin = 84;
    const gutter = 96;
    const gridX = margin + gutter;
    const gridW = width - gridX - margin;
    const gridY = 288;
    const rowH = 74;
    const gridH = rowH * HOURS.length;
    const colW = gridW / DAYS.length;

    // ── Blocks in reading order so the cascade sweeps the week ──────────────
    const laid = DAYS.flatMap((day, dayIndex) =>
      (schedule[day] ?? []).map((block) => ({ block, dayIndex })),
    ).sort((a, b) => a.dayIndex - b.dayIndex || a.block.start - b.block.start);

    const deepHours = laid.reduce((n, e) => n + (e.block.type === "deep" ? e.block.duration : 0), 0);
    const meetHours = laid.reduce((n, e) => n + (e.block.type === "meeting" ? e.block.duration : 0), 0);
    const bookedHours = deepHours + meetHours;

    // ── Ruling: verticals first, then horizontals — the way a sheet is set up ─
    const ruleP = t.in("rule");
    const vLine = (i: number) => std.clamp01((ruleP * 1.9 - i * 0.075) / 0.5);
    const hLine = (i: number) => std.clamp01((ruleP * 1.9 - 0.42 - i * 0.055) / 0.5);

    const labelP = t.in("label");
    const layP = t.in("lay");
    const blockReveal = std.stagger.ms(laid, layP, {
      windowSeconds: ctx.timeline.durationSeconds * 0.26,
      eachMs: 100,
      capMs: 1000,
      easing: "easeOutQuart",
    });
    const blockP = (i: number) => blockReveal[i]!.progress;

    const measureP = t.in("measure");
    const dimP = std.interpolate(measureP, [0, 0.8], [0, 1], "easeOutQuart");
    const shownDeep = std.interpolate(measureP, [0.1, 0.9], [0, deepHours], "easeOutCubic");
    const shownMeet = std.interpolate(measureP, [0.2, 1], [0, meetHours], "easeOutCubic");

    const exitP = t.in("exit");
    const sheetOp = 1 - std.interpolate(exitP, [0, 1], [0, 1], "easeInCubic");

    // ── The drawing: one SVG, ruled and taped ───────────────────────────────
    const verticals = DAYS.map((_d, i) => {
      const x = (i * colW).toFixed(2);
      const p = vLine(i);
      const bold = i === 0;
      return `<line x1="${x}" y1="0" x2="${x}" y2="${(gridH * p).toFixed(2)}" stroke="${bold ? sheet.ruleBold : sheet.rule}" stroke-width="${bold ? 1.6 : 1}"/>`;
    })
      .concat(
        `<line x1="${gridW.toFixed(2)}" y1="0" x2="${gridW.toFixed(2)}" y2="${(gridH * vLine(DAYS.length)).toFixed(2)}" stroke="${sheet.ruleBold}" stroke-width="1.6"/>`,
      )
      .join("\n");

    const horizontals = HOURS.map((_h, i) => {
      const y = (i * rowH).toFixed(2);
      const p = hLine(i);
      // Lunch band gets a dashed construction line instead of a solid rule.
      const noon = HOURS[i] === 12;
      return `<line x1="0" y1="${y}" x2="${(gridW * p).toFixed(2)}" y2="${y}" stroke="${sheet.rule}" stroke-width="1"${noon ? ' stroke-dasharray="6 7"' : ""}/>`;
    })
      .concat(
        `<line x1="0" y1="${gridH}" x2="${(gridW * hLine(HOURS.length)).toFixed(2)}" y2="${gridH}" stroke="${sheet.ruleBold}" stroke-width="1.6"/>`,
      )
      .join("\n");

    const blocks = laid
      .map(({ block, dayIndex }, i) => {
        const p = blockP(i);
        if (p <= 0.001) return "";
        const tint = block.type === "deep" ? sheet.deep : sheet.meet;
        const x = dayIndex * colW + 8;
        const w = colW - 16;
        const fullH = block.duration * rowH - 12;
        const y = (block.start - HOURS[0]) * rowH + 6;
        const h = Math.max(0.5, fullH * p);
        const textOp = std.clamp01((p - 0.5) / 0.35);
        const hours = block.duration;
        return `<g>
  <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="4"
        fill="${std.color.alpha(tint, theme === "light" ? 0.18 : 0.22)}" stroke="${std.color.alpha(tint, 0.85)}" stroke-width="1.2"/>
  <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="4" height="${h.toFixed(2)}" rx="2" fill="${tint}"/>
  <g opacity="${textOp.toFixed(3)}">
    <text x="${(x + 18).toFixed(2)}" y="${(y + 30).toFixed(2)}" font-family="Inter, sans-serif" font-size="19" font-weight="600" fill="${sheet.ink}">${std.text.escapeHtml(block.label)}</text>
    <text x="${(x + 18).toFixed(2)}" y="${(y + 54).toFixed(2)}" font-family="${MONO}" font-size="14" fill="${std.color.alpha(sheet.ink, 0.6)}">${block.start}:00 · ${hours}h</text>
  </g>
</g>`;
      })
      .join("\n");

    const gridSvg = `<svg width="${gridW}" height="${gridH}" viewBox="0 0 ${gridW} ${gridH}" xmlns="http://www.w3.org/2000/svg">
${verticals}
${horizontals}
${blocks}
</svg>`;

    // ── Dimension line: how the week actually splits ────────────────────────
    const dimH = 84;
    const barY = 34;
    const deepW = bookedHours > 0 ? (deepHours / bookedHours) * gridW : 0;
    const meetW = bookedHours > 0 ? (meetHours / bookedHours) * gridW : 0;
    const tick = (x: number) =>
      `<line x1="${x.toFixed(2)}" y1="${barY - 9}" x2="${x.toFixed(2)}" y2="${barY + 21}" stroke="${sheet.faint}" stroke-width="1"/>`;
    const dimSvg = `<svg width="${gridW}" height="${dimH}" viewBox="0 0 ${gridW} ${dimH}" xmlns="http://www.w3.org/2000/svg">
  <g opacity="${dimP.toFixed(3)}">
    ${tick(0)}${tick(deepW)}${tick(deepW + meetW)}
    <rect x="0" y="${barY}" width="${(deepW * dimP).toFixed(2)}" height="12" rx="2" fill="${sheet.deep}"/>
    <rect x="${deepW.toFixed(2)}" y="${barY}" width="${(meetW * dimP).toFixed(2)}" height="12" rx="2" fill="${std.color.alpha(sheet.meet, 0.9)}"/>
    <text x="0" y="${barY - 16}" font-family="${MONO}" font-size="15" font-weight="600" fill="${sheet.deep}" letter-spacing="2">DEEP ${shownDeep.toFixed(0)}H</text>
    <text x="${(deepW + 10).toFixed(2)}" y="${barY - 16}" font-family="${MONO}" font-size="15" font-weight="600" fill="${sheet.meet}" letter-spacing="2">MEETINGS ${shownMeet.toFixed(0)}H</text>
    <text x="${gridW}" y="${barY + 40}" text-anchor="end" font-family="${MONO}" font-size="14" fill="${sheet.faint}" letter-spacing="1.5">${bookedHours}H BOOKED OF ${HOURS.length * DAYS.length}H</text>
  </g>
</svg>`;

    // ── Hour gutter + day heads ─────────────────────────────────────────────
    const hourRows = HOURS.map((hour, i) => {
      const op = std.clamp01((labelP * 1.7 - i * 0.05) / 0.4);
      return Frame(
        { x: 0, y: i * rowH - 9, width: gutter - 22, height: 18, style: { opacity: op } },
        Text({ variant: "label", color: sheet.faint, size: 15, fontFamily: MONO, align: "right" }, `${hour}:00`),
      );
    });

    const dayHeads = DAYS.map((day, i) => {
      const op = std.clamp01((labelP * 1.7 - i * 0.07) / 0.4);
      const y = std.interpolate(op, [0, 1], [8, 0], "easeOutCubic");
      return Frame(
        { x: i * colW, y: 0, width: colW, height: 30, style: { opacity: op, transform: `translateY(${y.toFixed(2)}px)` } },
        Stack(
          { width: colW, height: 30, align: "center", justify: "center" },
          Text({ variant: "label", color: sheet.ink, size: 18, weight: 600, fontFamily: MONO, letterSpacing: 3 }, day.toUpperCase()),
        ),
      );
    });

    function fieldCell(label: string, value: string, w: number) {
      return Stack(
        { width: w, height: 44, gap: 5 },
        Text({ variant: "label", color: sheet.faint, size: 11, fontFamily: MONO, letterSpacing: 2 }, label),
        Text({ variant: "label", color: sheet.ink, size: 16, weight: 600, fontFamily: MONO }, value),
      );
    }

    return Frame(
      { id: "sheet", width, height },
      Fill({ color: sheet.paper }),
      Fill({
        gradient: { kind: "radial", at: "26% 6%", size: "80% 70%", stops: [std.color.alpha(sheet.glow, theme === "light" ? 0.9 : 0.55), "transparent"] },
      }),

      Frame(
        { x: 0, y: 0, width, height, style: { opacity: sheetOp } },

        // Sheet border
        Frame({ x: 44, y: 44, width: width - 88, height: height - 88, radius: 2, style: { border: `1px solid ${sheet.rule}` } }),

        // Masthead
        Frame(
          { x: gridX, y: 120, width: gridW, height: 96 },
          Stack(
            { width: gridW, gap: 14 },
            Stack(
              { direction: "row", height: 22, gap: 14, align: "center" },
              Frame({ width: 26, height: 2, fill: sheet.deep }),
              Text({ variant: "label", color: sheet.deep, size: 13, weight: 600, fontFamily: MONO, letterSpacing: 5 }, "SHEET 01 — WEEK PLAN"),
            ),
            Text({ variant: "display", color: sheet.ink, size: 46, weight: 600, fontFamily: MONO, letterSpacing: -1 }, "Where the week goes"),
          ),
        ),

        Frame({ x: gridX, y: gridY - 46, width: gridW, height: 30 }, ...dayHeads),
        Frame({ x: margin, y: gridY, width: gutter, height: gridH }, ...hourRows),
        Frame({ x: gridX, y: gridY, width: gridW, height: gridH }, Html({ id: "grid", width: gridW, height: gridH, html: gridSvg })),
        Frame({ x: gridX, y: gridY + gridH + 30, width: gridW, height: dimH }, Html({ id: "dim", width: gridW, height: dimH, html: dimSvg })),

        // Title block, bottom-left, like any real drawing
        Frame(
          { x: margin, y: height - 128, width: 560, height: 52, style: { opacity: std.clamp01(labelP * 1.3) } },
          Stack(
            { direction: "row", width: 560, height: 52, gap: 34, align: "start" },
            fieldCell("SCALE", "1H = 74PX", 150),
            fieldCell("BLOCKS", String(laid.length).padStart(2, "0"), 90),
            fieldCell("REV", "A", 60),
          ),
        ),
      ),
    );
  },
});
