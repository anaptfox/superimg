// Timeline — a roadmap you travel rather than scroll. The marker rides a rail from
// station to station and the sky warms as the journey lands. The background is the progress bar.

import { video, Frame, Stack, Text, Fill, Html, googleFont } from "@foxworth/superimg";

export interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  icon?: string;
  accentColor?: string;
}

export type TimelineTheme = "minimalist" | "tech" | "corporate" | "playful";

export interface TimelineVideoData extends Record<string, unknown> {
  title: string;
  subtitle?: string;
  events: TimelineEvent[];
  mode?: "dark" | "light";
  theme?: TimelineTheme;
}

const DISPLAY = "'Archivo', 'Inter', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

/** Each theme is a different time of day, not a different set of grey boxes. */
const SKIES: Record<TimelineTheme, { dawn: [string, string]; dusk: [string, string]; sun: string; rail: string }> = {
  minimalist: { dawn: ["#1A1A1C", "#2E2E31"], dusk: ["#3A3A3F", "#D8D4CC"], sun: "#F5F1E8", rail: "#F5F1E8" },
  tech: { dawn: ["#0B1230", "#141C4A"], dusk: ["#123055", "#2FD9C5"], sun: "#5FF3DC", rail: "#8FB7FF" },
  corporate: { dawn: ["#08132C", "#122246"], dusk: ["#28325E", "#F0B457"], sun: "#FFD089", rail: "#BFD0EE" },
  playful: { dawn: ["#1E0B33", "#3A1252"], dusk: ["#63216B", "#FF8A5B"], sun: "#FFB27A", rail: "#FFC7E0" },
};

export default video<TimelineVideoData>({
  duration: "11s",
  poster: "9.2s",
  fonts: [googleFont("Archivo:wght@500;600;700;800"), googleFont("Inter:wght@400;500"), googleFont("IBM+Plex+Mono:wght@500;600")],
  inlineCss: ["* { margin: 0; padding: 0; box-sizing: border-box; }", "body { overflow: hidden; }"],

  sample: {
    title: "Product Roadmap",
    subtitle: "What is next for our company",
    events: [
      { date: "Q1 2025", title: "Launch v2.0", description: "The rewrite ships to everyone", icon: "▲" },
      { date: "Q2 2025", title: "Mobile app", description: "iOS and Android, one codebase", icon: "◆" },
      { date: "Q3 2025", title: "Enterprise", description: "SSO, audit logs, and seats", icon: "●" },
    ],
    theme: "corporate",
    mode: "dark",
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { title, subtitle, events } = data;
    const theme: TimelineTheme = data.theme ?? "corporate";
    const sky = SKIES[theme] ?? SKIES.corporate;
    const light = data.mode === "light";

    if (events.length === 0) {
      return Frame(
        { id: "empty-state", width, height, fill: light ? "#F6F4F0" : "#08132C" },
        Stack(
          { width: "fill", height: "fill", align: "center", justify: "center", gap: 24, pad: 96 },
          Text({ variant: "title", size: 52, color: light ? "#12131A" : "#F6F4F0" }, title),
          Text({ variant: "body", size: 30, color: light ? "#12131A" : "#F6F4F0" }, "No milestones scheduled"),
        ),
      );
    }

    const ink = light ? "#12131A" : "#F6F4F0";
    const faint = light ? "rgba(18,19,26,0.55)" : "rgba(246,244,240,0.55)";
    const n = Math.max(1, events.length);

    const t = ctx.director({
      depart: "16%",
      travel: "62%",
      arrive: "14%",
      exit: "8%",
    });

    // ── Where are we on the line ────────────────────────────────────────────
    const beat = t.beats({ during: "travel", of: events.map((_e, i) => `stop-${i}`), cross: "16%" });
    const arrived = t.in("arrive") > 0;

    const stationIndex = arrived ? n - 1 : beat.index;
    const crossMix = arrived ? 0 : beat.crossing ? std.interpolate(beat.mix, [0, 1], [0, 1], "easeInOutCubic") : 0;
    const journey = n > 1 ? Math.min(1, (stationIndex + crossMix) / (n - 1)) : 1;

    // Sky warms with the journey; departure fades the whole thing up.
    const departP = t.in("depart");
    const skyTop = std.interpolateColor(journey, [0, 1], [sky.dawn[0], sky.dusk[0]], "easeInOutCubic");
    const skyBottom = std.interpolateColor(journey, [0, 1], [sky.dawn[1], sky.dusk[1]], "easeInOutCubic");

    // ── Rail geometry ───────────────────────────────────────────────────────
    const railY = 742;
    const railX0 = 250;
    const railX1 = width - 250;
    const railW = railX1 - railX0;
    const stationX = (i: number) => (n > 1 ? railX0 + (i / (n - 1)) * railW : railX0 + railW / 2);
    const markerX = stationX(stationIndex) + crossMix * (stationX(Math.min(n - 1, stationIndex + 1)) - stationX(stationIndex));

    const railDraw = std.interpolate(departP, [0.25, 1], [0, 1], "easeOutQuart");
    const stationPop = (i: number) => std.clamp01((departP * 1.5 - 0.4 - i * 0.09) / 0.4);

    // ── Card follows the marker, clamped to stay fully on the sheet ─────────
    const cardW = 1180;
    const cardH = 322;
    const cardY = 268;
    const cardX = std.math.clamp(markerX - cardW / 2, 120, width - 120 - cardW);

    const event = events[stationIndex] ?? events[0]!;
    const accent = event.accentColor ?? sky.sun;

    // Content swaps on the cut: out fast, in on the far side of the crossing.
    const swap = beat.crossing && !arrived ? beat.mix : 0;
    const contentOp = swap > 0 ? Math.abs(swap - 0.5) * 2 : 1;
    const nextSide = swap > 0.5;
    const shown = nextSide && stationIndex + 1 < n ? events[stationIndex + 1]! : event;
    const shownAccent = shown.accentColor ?? sky.sun;
    const contentY = swap > 0 ? (nextSide ? (1 - contentOp) * 16 : -(1 - contentOp) * 16) : 0;

    const departOp = std.interpolate(departP, [0, 0.5], [0, 1], "easeOutCubic");
    const cardOp = std.clamp01((departP - 0.45) / 0.4);
    const exitOp = 1 - std.interpolate(t.in("exit"), [0, 1], [0, 1], "easeInCubic");

    // ── Arrival flare on the last station ───────────────────────────────────
    const flare = arrived ? std.interpolate(t.in("arrive"), [0, 0.45], [0, 1], "easeOutQuart") : 0;

    // ── Rail, stations, marker: one SVG so the glow and ticks stay together ─
    const svgH = 150;
    const railLocalY = 52;
    const stations = events
      .map((e, i) => {
        const p = stationPop(i);
        if (p <= 0.001) return "";
        const x = stationX(i) - railX0;
        const past = i < stationIndex || (i === stationIndex && crossMix === 0) || arrived;
        const isHere = i === stationIndex;
        const r = 12 * p;
        const fill = past ? sky.rail : std.color.alpha(sky.rail, 0.18);
        return `<g opacity="${p.toFixed(3)}">
  <circle cx="${x.toFixed(2)}" cy="${railLocalY}" r="${r.toFixed(2)}" fill="${fill}" stroke="${sky.rail}" stroke-width="2"/>
  ${isHere ? `<circle cx="${x.toFixed(2)}" cy="${railLocalY}" r="${(r + 12).toFixed(2)}" fill="none" stroke="${std.color.alpha(accent, 0.5)}" stroke-width="1.5"/>` : ""}
  <text x="${x.toFixed(2)}" y="${railLocalY + 48}" text-anchor="middle" font-family="${MONO}" font-size="17" font-weight="600"
        letter-spacing="2.5" fill="${past || isHere ? ink : faint}" opacity="${past || isHere ? 1 : 0.6}">${std.text.escapeHtml(e.date.toUpperCase())}</text>
</g>`;
      })
      .join("\n");

    const railSvg = `<svg width="${railW}" height="${svgH}" viewBox="0 0 ${railW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
  <defs>
    <filter id="marker-glow" x="-120%" y="-120%" width="340%" height="340%">
      <feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <line x1="0" y1="${railLocalY}" x2="${railW}" y2="${railLocalY}" stroke="${std.color.alpha(sky.rail, 0.2)}" stroke-width="3" stroke-linecap="round"/>
  <line x1="0" y1="${railLocalY}" x2="${(railW * railDraw).toFixed(2)}" y2="${railLocalY}" stroke="${std.color.alpha(sky.rail, 0.55)}" stroke-width="3" stroke-linecap="round"/>
  <line x1="0" y1="${railLocalY}" x2="${(markerX - railX0).toFixed(2)}" y2="${railLocalY}" stroke="${accent}" stroke-width="4" stroke-linecap="round" opacity="${std.clamp01((railDraw - 0.72) / 0.28).toFixed(3)}"/>
${stations}
  <g filter="url(#marker-glow)" opacity="${std.clamp01((railDraw - 0.6) / 0.3).toFixed(3)}">
    <circle cx="${(markerX - railX0).toFixed(2)}" cy="${railLocalY}" r="${(9 + flare * 6).toFixed(2)}" fill="${accent}"/>
  </g>
  ${flare > 0 ? `<circle cx="${(markerX - railX0).toFixed(2)}" cy="${railLocalY}" r="${(18 + flare * 46).toFixed(2)}" fill="none" stroke="${std.color.alpha(accent, 0.55 * (1 - flare))}" stroke-width="${(3 * (1 - flare) + 0.5).toFixed(2)}"/>` : ""}
</svg>`;

    // Leader from the card down to the station the marker is sitting on.
    const leaderTop = cardY + cardH;
    const leaderH = railY - 14 - leaderTop;

    return Frame(
      { id: "stage", width, height },
      Fill({ gradient: { kind: "linear", angle: "180deg", stops: [skyTop, `${skyBottom} 100%`] } }),
      // Sun tracks the journey and swells on arrival.
      Fill({
        gradient: {
          kind: "radial",
          at: `${(12 + journey * 76).toFixed(1)}% ${(96 - journey * 22).toFixed(1)}%`,
          size: `${(30 + journey * 34).toFixed(0)}% ${(24 + journey * 26).toFixed(0)}%`,
          stops: [std.color.alpha(sky.sun, 0.1 + journey * 0.3), "transparent"],
        },
      }),
      // Horizon haze so the rail has ground to sit on.
      Frame({
        x: 0,
        y: railY + 96,
        width,
        height: height - railY - 96,
        fill: light ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.30)",
      }),
      Frame({ x: 0, y: railY + 96, width, height: 1, fill: std.color.alpha(sky.rail, 0.25) }),

      Frame(
        { x: 0, y: 0, width, height, style: { opacity: exitOp } },

        // Masthead
        Frame(
          { x: 120, y: 96, width: 900, height: 110, style: { opacity: departOp, transform: `translateY(${((1 - departOp) * 16).toFixed(2)}px)` } },
          Stack(
            { width: 900, gap: 12 },
            Text({ variant: "display", color: ink, size: 52, weight: 800, fontFamily: DISPLAY, letterSpacing: -1.6 }, title),
            subtitle ? Text({ variant: "caption", color: faint, size: 22, fontFamily: DISPLAY }, subtitle) : null,
          ),
        ),

        // Journey counter, top right
        Frame(
          { x: width - 320, y: 104, width: 200, height: 56, style: { opacity: departOp } },
          Stack(
            { width: 200, height: 56, gap: 6 },
            Text({ variant: "label", color: faint, size: 12, weight: 600, fontFamily: MONO, letterSpacing: 4, align: "right" }, "STOP"),
            Text({ variant: "label", color: ink, size: 26, weight: 600, fontFamily: MONO, align: "right" }, `${String(stationIndex + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`),
          ),
        ),

        // Leader line
        leaderH > 0
          ? Frame({
              x: markerX,
              y: leaderTop,
              width: 1,
              height: leaderH,
              fill: std.color.alpha(accent, 0.45),
              style: { opacity: cardOp },
            })
          : null,

        // ── The station card ────────────────────────────────────────────
        Frame(
          { id: "stop-card", x: cardX, y: cardY, width: cardW, height: cardH, style: { opacity: cardOp } },
          Frame({
            width: cardW,
            height: cardH,
            radius: 20,
            fill: light ? "rgba(255,255,255,0.62)" : "rgba(10,12,24,0.42)",
            style: {
              border: `1px solid ${std.color.alpha(sky.rail, 0.22)}`,
              backdropFilter: "blur(14px)",
              boxShadow: light ? "0 26px 70px rgba(10,20,40,0.18)" : "0 30px 80px rgba(0,0,0,0.42)",
            },
          }),
          Frame(
            {
              x: 52,
              y: 48,
              width: cardW - 104,
              height: cardH - 96,
              style: { opacity: contentOp, transform: `translateY(${contentY.toFixed(2)}px)` },
            },
            Stack(
              { width: cardW - 104, gap: 18 },
              Stack(
                { direction: "row", height: 34, gap: 16, align: "center" },
                shown.icon
                  ? Frame(
                      { width: 34, height: 34, radius: 9, fill: std.color.alpha(shownAccent, 0.2) },
                      Stack(
                        { width: 34, height: 34, align: "center", justify: "center" },
                        Text({ variant: "label", color: shownAccent, size: 16 }, shown.icon),
                      ),
                    )
                  : null,
                Text({ variant: "label", color: shownAccent, size: 16, weight: 600, fontFamily: MONO, letterSpacing: 4 }, shown.date.toUpperCase()),
              ),
              Text(
                {
                  variant: "display",
                  color: ink,
                  size: 72,
                  weight: 800,
                  fontFamily: DISPLAY,
                  letterSpacing: -2.4,
                  maxWidth: cardW - 120,
                  style: { lineHeight: 1.05 },
                },
                shown.title,
              ),
              shown.description
                ? Text({ variant: "body", color: faint, size: 27, fontFamily: DISPLAY, maxWidth: cardW - 160 }, shown.description)
                : null,
            ),
          ),
        ),

        // ── Rail ────────────────────────────────────────────────────────
        Frame(
          { x: railX0, y: railY - railLocalY, width: railW, height: svgH },
          Html({ id: "rail", width: railW, height: svgH, html: railSvg }),
        ),
      ),
    );
  },
});
