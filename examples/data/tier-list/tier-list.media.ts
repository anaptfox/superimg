// Tier list — a fighting-game character select. Rows unroll, picks slam in with hard
// offset shadows, and the S row gets crowned at the end.

import { video, Frame, Stack, Text, Fill, Html, googleFont } from "@foxworth/superimg";

export type Tier = "S" | "A" | "B" | "C" | "D" | "F";
export type TierTheme = "dark" | "light" | "neon";

export interface TierItem {
  id: string;
  name: string;
  tier: Tier;
}

export interface TierListVideoData extends Record<string, unknown> {
  title: string;
  items: TierItem[];
  theme: TierTheme;
  showTierLabels: boolean;
}

const DISPLAY = "'Archivo', 'Inter Tight', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const TIERS: readonly Tier[] = ["S", "A", "B", "C", "D", "F"];

/** Saturated arcade inks, not the pastel default tier palette. */
const TIER_INK: Record<Tier, string> = {
  S: "#FF4757",
  A: "#FF9F43",
  B: "#FFD32A",
  C: "#2ED573",
  D: "#3DA9FC",
  F: "#8E7CC3",
};

const CABINETS: Record<TierTheme, { bg: string; hatch: string; track: string; chipInk: string; ink: string; faint: string }> = {
  dark: { bg: "#0A0A0B", hatch: "#1A1A20", track: "#141418", chipInk: "#0A0A0B", ink: "#F5F3EF", faint: "rgba(245,243,239,0.42)" },
  light: { bg: "#EEE9E0", hatch: "#DCD5C8", track: "#DAD3C6", chipInk: "#141212", ink: "#141212", faint: "rgba(20,18,18,0.5)" },
  neon: { bg: "#08001A", hatch: "#1B0640", track: "#150430", chipInk: "#08001A", ink: "#F2E9FF", faint: "rgba(242,233,255,0.5)" },
};



export default video<TierListVideoData>({
  duration: "8.5s",
  poster: "7s",
  fonts: [googleFont("Archivo:wght@700;800;900"), googleFont("IBM+Plex+Mono:wght@500;600")],
  inlineCss: ["* { margin: 0; padding: 0; box-sizing: border-box; }", "body { overflow: hidden; }"],

  sample: {
    title: "Programming Languages",
    items: [
      { id: "1", name: "TypeScript", tier: "S" },
      { id: "2", name: "Rust", tier: "S" },
      { id: "3", name: "Python", tier: "A" },
      { id: "4", name: "Go", tier: "A" },
      { id: "5", name: "JavaScript", tier: "B" },
      { id: "6", name: "Java", tier: "C" },
      { id: "7", name: "PHP", tier: "D" },
      { id: "8", name: "COBOL", tier: "F" },
    ],
    theme: "dark",
    showTierLabels: true,
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { title, items, theme, showTierLabels } = data;
    const cab = CABINETS[theme] ?? CABINETS.dark;

    const t = ctx.director({
      slam: "9%",
      unroll: "13%",
      draft: "40%",
      crown: "17%",
      hold: "13%",
      exit: "8%",
    });

    // ── Cabinet geometry ────────────────────────────────────────────────────
    const margin = 70;
    const headH = 178;
    const gap = 8;
    const rowH = Math.floor((height - headH - margin - gap * (TIERS.length - 1)) / TIERS.length);
    const plateW = showTierLabels ? 148 : 0;
    const trackX = margin + plateW;
    const trackW = width - margin - trackX;

    const chipH = rowH - 26;
    const chipGap = 12;
    const shadow = 7;
    const maxRoster = Math.max(1, ...TIERS.map((tier) => items.filter((item) => item.tier === tier).length));
    const chipW = Math.min(192, Math.floor((trackW - 36 - shadow - (maxRoster - 1) * chipGap) / maxRoster));

    // Draft order is the author's order — the reveal reads like a draft board.
    const orderOf = new Map(items.map((item, i) => [item.id, i] as const));
    const byTier = new Map<Tier, TierItem[]>(TIERS.map((tier) => [tier, []]));
    for (const item of items) byTier.get(item.tier)?.push(item);

    const slamP = t.in("slam");
    const titleScale = std.spring(1.14, 1, slamP, "snappy");
    const titleOp = std.interpolate(slamP, [0, 0.3], [0, 1], "easeOutCubic");

    const unrollP = t.in("unroll");
    const rowUnroll = (i: number) =>
      std.interpolate(std.clamp01((unrollP * 1.6 - i * 0.1) / 0.5), [0, 1], [0, 1], "easeOutQuart");

    const draftP = t.in("draft");
    const pickP = (order: number) => {
      const step = 1 / (items.length + 2.2);
      return std.clamp01((draftP - order * step * 0.92) / (step * 2.1));
    };

    const crownP = t.in("crown");
    const crown = std.interpolate(crownP, [0, 0.4], [0, 1], "easeOutQuart");
    const crownPulse = crownP > 0 ? 1 + Math.sin(crownP * Math.PI * 3) * 0.035 * (1 - crownP) : 1;

    const exitOp = 1 - std.interpolate(t.in("exit"), [0, 1], [0, 1], "easeInCubic");

    // ── Cabinet backdrop: diagonal hatch + scanlines ────────────────────────
    const backdropSvg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
      <rect width="14" height="14" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="14" stroke="${cab.hatch}" stroke-width="6"/>
    </pattern>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="2" fill="rgba(0,0,0,0.16)"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#hatch)" opacity="0.55"/>
  <rect width="${width}" height="${height}" fill="url(#scan)" opacity="${theme === "light" ? 0.18 : 0.4}"/>
</svg>`;

    // ── Rows ────────────────────────────────────────────────────────────────
    const rows = TIERS.map((tier, tierIndex) => {
      const ink = TIER_INK[tier];
      const roster = byTier.get(tier) ?? [];
      const y = headH + tierIndex * (rowH + gap);
      const unroll = rowUnroll(tierIndex);
      if (unroll <= 0.001) return null;

      const isS = tier === "S";
      const lift = isS ? crown * 6 : 0;
      const rowScale = isS ? crownPulse : 1;

      const chips = roster.map((item, seat) => {
        const p = pickP(orderOf.get(item.id) ?? seat);
        if (p <= 0.001) return null;
        const scale = std.spring(1.5, 1, p, "playful");
        const op = std.clamp01(p * 3);
        const x = seat * (chipW + chipGap);

        return Frame(
          {
            id: `pick-${item.id}`,
            x,
            y: 13,
            width: chipW,
            height: chipH,
            style: {
              opacity: op,
              transform: `scale(${scale.toFixed(4)})`,
              transformOrigin: "center center",
            },
          },
          // Hard offset shadow — arcade, not soft UI blur.
          Frame({ x: shadow, y: shadow, width: chipW, height: chipH, radius: 4, fill: std.color.alpha(ink, 0.3) }),
          Frame({ width: chipW, height: chipH, radius: 4, fill: ink }),
          Frame({ x: 0, y: 0, width: chipW, height: 5, fill: "rgba(255,255,255,0.45)" }),
          Frame(
            { x: 0, y: 0, width: chipW, height: chipH },
            Stack(
              { width: chipW, height: chipH, align: "center", justify: "center", pad: { x: 12 } },
              Text(
                {
                  variant: "title",
                  color: cab.chipInk,
                  size: 25,
                  weight: 900,
                  fontFamily: DISPLAY,
                  align: "center",
                  letterSpacing: -0.6,
                  maxWidth: chipW - 24,
                },
                item.name,
              ),
            ),
          ),
        );
      });

      return Frame(
        {
          id: `tier-${tier}`,
          x: 0,
          y: y - lift,
          width,
          height: rowH,
          style: { transform: `scale(${rowScale.toFixed(4)})`, transformOrigin: "left center" },
        },

        // Tier plate
        showTierLabels
          ? Frame(
              {
                x: margin,
                y: 0,
                width: plateW,
                height: rowH,
                radius: 4,
                fill: ink,
                style: {
                  transform: `scaleX(${unroll.toFixed(3)})`,
                  transformOrigin: "left center",
                  boxShadow: isS && crown > 0 ? `0 0 ${(38 * crown).toFixed(0)}px ${std.color.alpha(ink, 0.75)}` : "none",
                },
              },
              Stack(
                { width: plateW, height: rowH, align: "center", justify: "center" },
                Text({ variant: "display", color: cab.chipInk, size: rowH * 0.56, weight: 900, fontFamily: DISPLAY, letterSpacing: -3 }, tier),
              ),
            )
          : null,

        // Roster track
        Frame(
          {
            x: trackX,
            y: 0,
            width: trackW,
            height: rowH,
            radius: 4,
            fill: cab.track,
            overflow: "hidden",
            style: {
              transform: `scaleX(${unroll.toFixed(3)})`,
              transformOrigin: "left center",
              border: `1px solid ${std.color.alpha(ink, isS && crown > 0 ? 0.55 : 0.16)}`,
            },
          },
          Frame({ x: 0, y: 0, width: 3, height: rowH, fill: std.color.alpha(ink, 0.7) }),
          Frame({ x: 18, y: 0, width: trackW - 18, height: rowH }, ...chips),
          roster.length === 0
            ? Frame(
                { x: 32, y: 0, width: 240, height: rowH },
                Stack(
                  { width: 240, height: rowH, justify: "center" },
                  Text({ variant: "label", color: cab.faint, size: 15, fontFamily: MONO, letterSpacing: 4 }, "— EMPTY —"),
                ),
              )
            : null,
        ),
      );
    });

    const sCount = (byTier.get("S") ?? []).length;

    return Frame(
      { id: "cabinet", width, height },
      Fill({ color: cab.bg }),
      Html({ id: "backdrop", width, height, html: backdropSvg }),
      Fill({
        gradient: { kind: "radial", at: "50% 0%", size: "70% 46%", stops: [std.color.alpha(TIER_INK.S, theme === "light" ? 0.1 : 0.16), "transparent"] },
      }),

      Frame(
        { x: 0, y: 0, width, height, style: { opacity: exitOp } },

        // Marquee
        Frame(
          {
            x: margin,
            y: 46,
            width: width - margin * 2,
            height: 104,
            style: { opacity: titleOp, transform: `scale(${titleScale.toFixed(4)})`, transformOrigin: "left center" },
          },
          Stack(
            { width: width - margin * 2, gap: 10 },
            Stack(
              { direction: "row", height: 20, gap: 14, align: "center" },
              Frame({ width: 26, height: 3, fill: TIER_INK.S }),
              Text({ variant: "label", color: TIER_INK.S, size: 14, weight: 600, fontFamily: MONO, letterSpacing: 6 }, "TIER LIST"),
              Text({ variant: "label", color: cab.faint, size: 14, weight: 500, fontFamily: MONO, letterSpacing: 3 }, `${items.length} PICKS`),
            ),
            Text(
              {
                variant: "display",
                color: cab.ink,
                size: 62,
                weight: 900,
                fontFamily: DISPLAY,
                letterSpacing: -2.6,
                style: { textTransform: "uppercase", lineHeight: 1 },
              },
              title,
            ),
          ),
        ),

        ...rows,

        // Verdict — the crown beat's payoff
        crown > 0
          ? Frame(
              {
                x: margin,
                y: headH - 40,
                width: width - margin * 2,
                height: 26,
                style: { opacity: crown, transform: `translateX(${((1 - crown) * -12).toFixed(2)}px)` },
              },
              Stack(
                { direction: "row", height: 26, gap: 12, align: "center" },
                Frame({ width: 8, height: 8, radius: 4, fill: TIER_INK.S }),
                Text({ variant: "label", color: TIER_INK.S, size: 15, weight: 600, fontFamily: MONO, letterSpacing: 4 }, `S TIER LOCKED — ${sCount} PICK${sCount === 1 ? "" : "S"}`),
              ),
            )
          : null,
      ),
    );
  },
});
