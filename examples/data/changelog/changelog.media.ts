// Changelog — a release note as printed matter: paper stock, crop marks, riso inks.
// The version presses in like a rubber stamp, a rule draws, then the sections set themselves.

import { video, Frame, Stack, Text, Fill, Html, Spacer, type MediaElement, googleFont } from "@foxworth/superimg";

export type ChangelogKind = "added" | "changed" | "fixed" | "removed" | "security" | "deprecated";

export interface ChangelogSection {
  type: ChangelogKind;
  items: string[];
}

export interface ChangelogVideoData extends Record<string, unknown> {
  version: string;
  date: string;
  title: string;
  sections: ChangelogSection[];
  theme: "dark" | "light";
  accentColor: string;
}

const SERIF = "'Fraunces', Georgia, serif";
const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

/** Riso ink pairs — one for paper stock, one for the ink-negative press run. */
const INKS: Record<ChangelogKind, { light: string; dark: string; mark: string; label: string }> = {
  added: { light: "#2C7A4B", dark: "#5FCB8B", mark: "+", label: "Added" },
  changed: { light: "#1F5FA8", dark: "#6BA8E8", mark: "~", label: "Changed" },
  fixed: { light: "#C0670F", dark: "#F0A868", mark: "*", label: "Fixed" },
  removed: { light: "#B4302C", dark: "#F07A70", mark: "–", label: "Removed" },
  security: { light: "#6C3FA0", dark: "#B08CE0", mark: "!", label: "Security" },
  deprecated: { light: "#6E6A60", dark: "#A5A196", mark: "·", label: "Deprecated" },
};

export default video<ChangelogVideoData>({
  duration: "7.5s",
  poster: "5.2s",
  fonts: [googleFont("Fraunces:opsz,wght@9..144,600;9..144,700"), googleFont("Inter:wght@400;500;600"), googleFont("IBM+Plex+Mono:wght@400;500")],
  inlineCss: ["* { margin: 0; padding: 0; box-sizing: border-box; }", "body { overflow: hidden; }"],

  sample: {
    version: "2.0.0",
    date: "2025-01-15",
    title: "Major Release",
    sections: [
      { type: "added", items: ["Real-time analytics dashboard", "System-wide dark mode"] },
      { type: "changed", items: ["Cold start cut by 50%"] },
      { type: "fixed", items: ["Safari login redirect loop"] },
    ],
    theme: "light",
    accentColor: "#B4302C",
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { version, date, title, sections, theme, accentColor } = data;

    const press = theme === "dark";
    const paper = press ? "#14120E" : "#F2EDE1";
    const ink = press ? "#F2EDE1" : "#17150F";
    const faint = press ? "rgba(242,237,225,0.42)" : "rgba(23,21,15,0.46)";
    const hair = press ? "rgba(242,237,225,0.20)" : "rgba(23,21,15,0.20)";
    const inkOf = (k: ChangelogKind) => (press ? INKS[k].dark : INKS[k].light);

    const t = ctx.director({
      stamp: "11%",
      rule: "7%",
      set: "42%",
      hold: "30%",
      lift: "10%",
    });

    const margin = 96;
    const railW = 400;
    const bodyX = margin + railW + 64;
    const bodyW = width - bodyX - margin;

    // ── Stamp: the version presses down and settles ─────────────────────────
    const stampP = t.in("stamp");
    const stampScale = std.spring(1.09, 1, stampP, "snappy");
    const stampTilt = std.interpolate(stampP, [0, 1], [-2.2, 0], "easeOutQuint");
    const stampOp = std.interpolate(stampP, [0, 0.28], [0, 1], "easeOutCubic");

    // Rule draws left→right beneath the masthead.
    const ruleP = t.in("rule");

    // ── Flatten sections into typeset rows so the cascade reads top-to-bottom ─
    type Row =
      | { kind: "head"; section: ChangelogSection; index: number }
      | { kind: "item"; section: ChangelogSection; text: string };
    const rows: Row[] = [];
    sections.forEach((section, index) => {
      rows.push({ kind: "head", section, index });
      for (const text of section.items) rows.push({ kind: "item", section, text });
    });

    // A weighted stack gives section heads a longer beat and guarantees that
    // every row lands, even when the release has more items than the sample.
    const typesetting = std.stack(rows, {
      id: "release-rows",
      itemIds: rows.map((_row, i) => `release-row-${i}`),
      during: t.in("set"),
      lead: 0,
      trail: 0.05,
      enter: 0.8,
      weights: rows.map((row) => row.kind === "head" ? 1.7 : 1),
    });
    const rowP = (i: number) => typesetting.state(i).enter;

    const lift = t.in("lift");
    const pageOp = 1 - std.interpolate(lift, [0, 1], [0, 1], "easeInCubic");
    const pageY = std.interpolate(lift, [0, 1], [0, -22], "easeInCubic");

    // ── Paper: crop marks, tooth, and a soft press shadow ───────────────────
    const m = 44;
    const arm = 34;
    const cropSvg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="tooth" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" filter="url(#tooth)" opacity="${press ? 0.05 : 0.07}"/>
  <g stroke="${hair}" stroke-width="1.5" fill="none">
    <path d="M${m} ${m - 14}V${m}H${m - 14} M${m} ${m}h${arm} M${m} ${m}v${arm}"/>
    <path d="M${width - m} ${m - 14}V${m}H${width - m + 14} M${width - m} ${m}h${-arm} M${width - m} ${m}v${arm}"/>
    <path d="M${m} ${height - m + 14}V${height - m}H${m - 14} M${m} ${height - m}h${arm} M${m} ${height - m}v${-arm}"/>
    <path d="M${width - m} ${height - m + 14}V${height - m}H${width - m + 14} M${width - m} ${height - m}h${-arm} M${width - m} ${height - m}v${-arm}"/>
  </g>
</svg>`;

    const ruleSvg = `<svg width="${railW}" height="4" viewBox="0 0 ${railW} 4" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${(railW * ruleP).toFixed(2)}" height="4" fill="${accentColor}"/>
</svg>`;

    // ── Rows ────────────────────────────────────────────────────────────────
    function headRow(row: Extract<Row, { kind: "head" }>, i: number) {
      const p = rowP(i);
      const color = inkOf(row.section.type);
      const count = row.section.items.length;
      const ruleLen = std.interpolate(p, [0, 1], [0, 1], "easeOutQuart");
      return Stack(
        {
          direction: "row",
          width: "fill",
          height: 46,
          gap: 18,
          align: "center",
          style: { opacity: p, transform: `translateX(${((1 - p) * 14).toFixed(2)}px)` },
        },
        Frame(
          { width: 34, height: 34, radius: 3, fill: color },
          Stack(
            { width: 34, height: 34, align: "center", justify: "center" },
            Text({ variant: "label", color: paper, size: 20, weight: 600, fontFamily: MONO }, INKS[row.section.type].mark),
          ),
        ),
        Text({ variant: "title", color: ink, size: 34, weight: 600, fontFamily: SERIF, letterSpacing: -0.3 }, INKS[row.section.type].label),
        Frame(
          { width: "fill", height: 1 },
          Frame({
            width: "fill",
            height: 1,
            fill: hair,
            style: { transform: `scaleX(${ruleLen.toFixed(3)})`, transformOrigin: "left center" },
          }),
        ),
        Text({ variant: "label", color: faint, size: 17, fontFamily: MONO }, String(count).padStart(2, "0")),
      );
    }

    function itemRow(row: Extract<Row, { kind: "item" }>, i: number) {
      const p = rowP(i);
      const color = inkOf(row.section.type);
      return Stack(
        {
          direction: "row",
          width: "fill",
          height: 44,
          gap: 18,
          align: "center",
          style: { opacity: p, transform: `translateX(${((1 - p) * 18).toFixed(2)}px)` },
        },
        Frame({ width: 34, height: 44 }, Frame({ x: 14, y: 20, width: 7, height: 3, fill: color })),
        Text({ variant: "body", color: ink, size: 27, fontFamily: SANS, lineHeight: 1.3 }, row.text),
      );
    }

    const bodyRows = rows.map((row, i) =>
      row.kind === "head" ? headRow(row, i) : itemRow(row, i),
    );
    // Breathe between groups without inventing a nested container per section.
    const spaced: MediaElement[] = [];
    rows.forEach((row, i) => {
      if (row.kind === "head" && i > 0) spaced.push(Spacer({ height: 30 }));
      spaced.push(bodyRows[i]!);
    });

    return Frame(
      { id: "sheet", width, height },
      Fill({ color: paper }),
      Fill({
        gradient: {
          kind: "radial",
          at: "22% 12%",
          size: "78% 70%",
          stops: [press ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)", "transparent"],
        },
      }),
      Html({ id: "crop", width, height, html: cropSvg }),

      Frame(
        { x: 0, y: 0, width, height, style: { opacity: pageOp, transform: `translateY(${pageY.toFixed(2)}px)` } },

        // ── Masthead rail ─────────────────────────────────────────────────
        Frame(
          { x: margin, y: 168, width: railW, height: 460 },
          Stack(
            { width: railW, gap: 0 },
            Text({ variant: "label", color: faint, size: 14, weight: 600, fontFamily: MONO, letterSpacing: 4 }, "RELEASE NOTE"),
            Spacer({ height: 20 }),
            Frame(
              {
                width: railW,
                height: 132,
                style: {
                  opacity: stampOp,
                  transform: `scale(${stampScale.toFixed(4)}) rotate(${stampTilt.toFixed(2)}deg)`,
                  transformOrigin: "left center",
                },
              },
              Text(
                {
                  id: "version",
                  variant: "display",
                  color: accentColor,
                  size: 118,
                  weight: 700,
                  fontFamily: SERIF,
                  letterSpacing: -4,
                  style: { lineHeight: 1 },
                },
                `v${version}`,
              ),
            ),
            Spacer({ height: 14 }),
            Html({ id: "rule", width: railW, height: 4, html: ruleSvg }),
            Spacer({ height: 26 }),
            Text(
              {
                variant: "title",
                color: ink,
                size: 36,
                weight: 600,
                fontFamily: SERIF,
                maxWidth: railW,
                style: { opacity: std.clamp01(ruleP * 1.4) },
              },
              title,
            ),
            Spacer({ height: 12 }),
            Text(
              {
                variant: "caption",
                color: faint,
                size: 19,
                fontFamily: MONO,
                style: { opacity: std.clamp01(ruleP * 1.4) },
              },
              date,
            ),
          ),
        ),

        // Gutter hairline between rail and body.
        Frame({
          x: bodyX - 34,
          y: 168,
          width: 1,
          height: 744,
          fill: hair,
          style: { transform: `scaleY(${std.interpolate(ruleP, [0, 1], [0, 1], "easeOutCubic").toFixed(3)})`, transformOrigin: "center top" },
        }),

        // ── Typeset body ──────────────────────────────────────────────────
        Frame(
          { x: bodyX, y: 172, width: bodyW, height: 736 },
          Stack({ width: bodyW, gap: 6 }, ...spaced),
        ),
      ),
    );
  },
});
