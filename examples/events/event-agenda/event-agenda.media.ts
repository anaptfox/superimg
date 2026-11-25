// Event Agenda — the conference day as a rail departure board.
// Split-flap time cells, a drawn rail, and one lit "now" row walking the schedule.

import {
  video,
  Frame,
  Stack,
  Text,
  Fill,
  Vector,
  vector,
  type FrameProps,
  type MediaChild,
  type MediaElement,
  type RenderContext,
  googleFont,
} from "@foxworth/superimg";

export interface EventSession {
  time: string;
  title: string;
  speaker: string;
}

export interface EventAgendaData extends Record<string, unknown> {
  eventName: string;
  date: string;
  sessions: EventSession[];
  theme: "dark" | "light" | "neon";
  accentColor: string;
}

interface Board {
  bg: string;
  wash: string;
  panel: string;
  panelLit: string;
  flap: string;
  ink: string;
  dim: string;
  rule: string;
  /** Multiplier on accent bloom — light boards want almost none. */
  bloom: number;
}

const BOARDS: Record<EventAgendaData["theme"], Board> = {
  dark: {
    bg: "#080B14",
    wash: "rgba(120,150,220,0.10)",
    panel: "#0E1524",
    panelLit: "#18203A",
    flap: "#050810",
    ink: "#EEF1F7",
    dim: "rgba(238,241,247,0.42)",
    rule: "rgba(238,241,247,0.11)",
    bloom: 0.55,
  },
  light: {
    bg: "#EFEAE0",
    wash: "rgba(120,100,70,0.10)",
    panel: "#FBF8F3",
    panelLit: "#FFFFFF",
    flap: "#20242C",
    ink: "#151820",
    dim: "rgba(21,24,32,0.52)",
    rule: "rgba(21,24,32,0.14)",
    bloom: 0.12,
  },
  neon: {
    bg: "#04050A",
    wash: "rgba(60,220,255,0.12)",
    panel: "#080D18",
    panelLit: "#0E1A30",
    flap: "#02030699",
    ink: "#E9F7FF",
    dim: "rgba(233,247,255,0.44)",
    rule: "rgba(233,247,255,0.12)",
    bloom: 1,
  },
};

const MONO = "'JetBrains Mono', ui-monospace, monospace";

type AgendaPanelProps = Omit<FrameProps, "style"> & {
  style?: Record<string, string | number | undefined>;
};

/** A departure-board row is product composition, not a universal media primitive. */
function AgendaPanel(props: AgendaPanelProps, ...children: MediaChild[]): MediaElement {
  return Frame({ radius: 16, pad: 20, fill: "rgba(255,255,255,0.06)", ...props }, ...children);
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "··";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

/** Deterministic hue per speaker so chips read as distinct people, not decoration. */
function chipHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export default video<EventAgendaData>({
  duration: "14s",
  fps: 30,
  poster: "9s",
  fonts: [googleFont("Inter:wght@400;500;600;700;800"), googleFont("JetBrains Mono:wght@400;500;700")],
  inlineCss: [
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { overflow: hidden; font-family: Inter, system-ui, sans-serif; }",
  ],

  sample: {
    eventName: "DevConf 2025",
    date: "March 15, 2025",
    sessions: [
      { time: "9:00 AM", title: "Opening Keynote", speaker: "Sarah Chen" },
      { time: "10:30 AM", title: "The Future of Web", speaker: "Alex Rivera" },
      { time: "1:00 PM", title: "Building at Scale", speaker: "Jordan Lee" },
      { time: "3:30 PM", title: "Lightning Talks", speaker: "Various Speakers" },
    ],
    theme: "dark",
    accentColor: "#FFB020",
  },

  render(ctx: RenderContext<EventAgendaData>) {
    const { std, width, height, data } = ctx;
    const { eventName, date, accentColor } = data;
    const sessions = data.sessions.length > 0 ? data.sessions : [
      { time: "—", title: "Schedule to come", speaker: "TBA" },
    ];
    const board = BOARDS[data.theme] ?? BOARDS.dark;
    const accent = accentColor;

    const t = ctx.director({ board: "16%", run: "66%", settle: "18%" });
    const s = Math.min(width, height) / 1080;
    const px = (n: number) => Math.round(n * s);

    // ---- geometry -------------------------------------------------------
    const padX = px(96);
    const padY = px(72);
    const n = sessions.length;
    const gap = px(14);
    const headerH = px(196);
    const footerH = px(64);
    const boardH = Math.max(px(200), height - padY * 2 - headerH - footerH - px(48));
    const rowH = Math.max(px(72), Math.round((boardH - gap * (n - 1)) / n));
    const gridH = rowH * n + gap * (n - 1);
    const timeW = px(210);
    const railW = px(64);
    const flapH = Math.min(rowH - px(24), px(70));

    // ---- the walking focus ---------------------------------------------
    const beat = t.beats({
      during: "run",
      of: sessions.map((_, i) => `s${i}`),
      cross: "18%",
    });
    const settle = t.in("settle");
    const focus = beat.crossing
      ? beat.index + std.interpolate(beat.mix, [0, 1], [0, 1], "easeInOutCubic")
      : beat.index;
    const running = t.in("board") >= 1 && settle <= 0;

    /** 1 on the focused row, falling off to its neighbours; released on settle. */
    function litOf(i: number): number {
      const near = Math.max(0, 1 - Math.abs(i - focus));
      const walk = t.in("board") < 1 ? 0 : near;
      return std.interpolate(settle, [0, 1], [walk, 0.62], "easeInOutCubic");
    }

    const entered = std.stagger.ms(
      sessions.map((_, i) => i),
      t.in("board"),
      { windowSeconds: t.clip({ during: "board" }).durationSeconds, eachMs: 70, capMs: 480, from: "start" },
    );

    // ---- rail overlay ---------------------------------------------------
    const yOf = (i: number) => Math.round(i * (rowH + gap) + rowH / 2);
    const first = yOf(0);
    const last = yOf(n - 1);
    const railDraw = std.interpolate(t.in("board"), [0.1, 1], [0, 1], "easeInOutCubic");
    const railLen = Math.max(1, last - first);
    const dotY = (() => {
      const lo = Math.floor(focus);
      const hi = Math.min(n - 1, lo + 1);
      return yOf(lo) + (yOf(hi) - yOf(lo)) * (focus - lo);
    })();
    const headY = settle > 0 ? last : dotY;
    const fillLen = Math.max(0, headY - first) * railDraw;
    const dotR = px(9) * (running ? 1 + 0.06 * Math.sin(ctx.timeline.seconds * 3.2) : 1);
    const rail = Vector({ id: "rail", x: timeW, width: railW, height: gridH },
      vector.path({ id: "rail-base", d: `M ${railW / 2} ${first} V ${first + railLen}`,
        fill: "none", stroke: board.rule, strokeWidth: px(2), strokeLinecap: "round",
        strokeDasharray: railLen, strokeDashoffset: railLen * (1 - railDraw) }),
      vector.path({ id: "rail-fill", d: `M ${railW / 2} ${first} V ${first + railLen}`,
        fill: "none", stroke: accent, strokeWidth: px(2), strokeLinecap: "round", opacity: fillLen > 0 ? 0.85 : 0,
        strokeDasharray: railLen, strokeDashoffset: railLen - fillLen }),
      ...sessions.map((_, i) => vector.path({
        id: `stop-${i}`, d: std.svg.shape.circle(railW / 2, yOf(i), px(5)),
        fill: board.bg, stroke: i <= focus + 0.001 || settle > 0 ? accent : board.rule,
        strokeWidth: px(2), opacity: entered[i]?.progress ?? 0,
      })),
      vector.path({ id: "glow", d: std.svg.shape.circle(railW / 2, headY, dotR * 3), fill: accent, opacity: 0.3 * board.bloom * railDraw }),
      vector.path({ id: "head", d: std.svg.shape.circle(railW / 2, headY, dotR), fill: accent, opacity: railDraw }),
    );

    // ---- pieces ---------------------------------------------------------
    function timeCell(session: EventSession, i: number) {
      const lit = litOf(i);
      const p = entered[i]?.progress ?? 0;
      return Frame(
        { width: timeW, height: rowH },
        Frame(
          {
            x: 0,
            y: Math.round((rowH - flapH) / 2),
            width: timeW - px(28),
            height: flapH,
            radius: px(8),
            fill: board.flap,
            overflow: "hidden",
            style: {
              opacity: p,
              transform: `translateX(${((1 - p) * -px(26)).toFixed(1)}px)`,
              boxShadow: `inset 0 0 0 1px ${board.rule}`,
            },
          },
          Stack(
            { width: "fill", height: "fill", align: "center", justify: "center" },
            Text(
              {
                variant: "title",
                size: px(30),
                weight: 700,
                fontFamily: MONO,
                letterSpacing: px(1),
                color: std.interpolateColor(lit, [0, 1], [board.dim, accent]),
              },
              session.time,
            ),
          ),
          Frame({
            x: 0,
            y: Math.round(flapH / 2) - 1,
            width: timeW - px(28),
            height: 2,
            fill: board.bg,
            style: { opacity: 0.9 },
          }),
        ),
      );
    }

    function speakerChip(name: string, lit: number) {
      const hue = chipHue(name);
      return Frame(
        {
          width: px(30),
          height: px(30),
          radius: px(15),
          fill: `hsl(${hue} 62% ${board.bloom > 0.3 ? 28 : 84}%)`,
          style: { boxShadow: `inset 0 0 0 1.5px hsl(${hue} 70% ${50 + lit * 14}%)` },
        },
        Stack(
          { width: "fill", height: "fill", align: "center", justify: "center" },
          Text(
            {
              variant: "label",
              size: px(12),
              weight: 700,
              letterSpacing: px(0.6),
              color: `hsl(${hue} 75% ${board.bloom > 0.3 ? 78 : 26}%)`,
            },
            initials(name),
          ),
        ),
      );
    }

    function row(session: EventSession, i: number) {
      const lit = litOf(i);
      const p = entered[i]?.progress ?? 0;
      const rest = 0.34 + lit * 0.66;
      return Stack(
        { direction: "row", width: "fill", height: rowH, align: "center" },
        timeCell(session, i),
        Frame({ width: railW, height: rowH }),
        AgendaPanel(
          {
            width: "fill",
            height: rowH,
            radius: px(14),
            pad: 0,
            overflow: "hidden",
            fill: std.interpolateColor(lit, [0, 1], [board.panel, board.panelLit]),
            style: {
              opacity: p,
              transform: `translateX(${((1 - p) * -px(46)).toFixed(1)}px)`,
              boxShadow: `inset 0 0 0 1px ${board.rule}, 0 ${px(14)}px ${px(38)}px rgba(0,0,0,${(0.22 + lit * 0.16).toFixed(2)}), 0 0 ${px(30)}px ${std.color.alpha(accent, lit * 0.18 * board.bloom)}`,
            },
          },
          Frame({
            x: 0,
            y: 0,
            width: px(5),
            height: rowH,
            fill: accent,
            style: { opacity: (0.18 + lit * 0.82).toFixed(3) },
          }),
          Stack(
            {
              width: "fill",
              height: "fill",
              justify: "center",
              gap: px(10),
              pad: { left: px(34), right: px(30) },
            },
            Text(
              {
                variant: "title",
                size: px(34),
                weight: 700,
                letterSpacing: px(-0.4),
                color: std.interpolateColor(rest, [0, 1], [board.dim, board.ink]),
              },
              session.title,
            ),
            Stack(
              { direction: "row", gap: px(12), align: "center", height: px(30) },
              speakerChip(session.speaker, lit),
              Text(
                {
                  variant: "body",
                  size: px(19),
                  weight: 500,
                  color: board.dim,
                  style: { opacity: (0.55 + lit * 0.45).toFixed(3) },
                },
                session.speaker,
              ),
            ),
          ),
        ),
      );
    }

    // ---- header / footer -------------------------------------------------
    const titleIn = t.motion({ id: "agenda.title", during: "board", at: "0%", for: "42%", y: px(22), exit: false });
    const dateIn = t.motion({ id: "agenda.date", during: "board", at: "10%", for: "42%", y: px(14), exit: false });
    const idx = Math.min(n, Math.round(focus) + 1);
    const counter = settle > 0
      ? `${String(n).padStart(2, "0")} / ${String(n).padStart(2, "0")}`
      : `${String(idx).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;

    return Frame(
      { id: "stage", width, height },
      Fill({ color: board.bg }),
      Fill({
        gradient: {
          kind: "radial",
          at: "18% 0%",
          size: "70% 60%",
          stops: [board.wash, "transparent"],
        },
      }),
      Fill({
        gradient: {
          kind: "linear",
          angle: "180deg",
          stops: ["transparent", "transparent 62%", "rgba(0,0,0,0.28)"],
        },
      }),
      Stack(
        {
          width: "fill",
          height: "fill",
          pad: { x: padX, y: padY },
          justify: "space-between",
        },
        Stack(
          { direction: "row", width: "fill", height: headerH, align: "end", justify: "space-between" },
          Stack(
            { gap: px(14) },
            Text(
              {
                variant: "label",
                size: px(15),
                weight: 700,
                letterSpacing: px(4),
                fontFamily: MONO,
                color: accent,
                motion: titleIn,
              },
              "TODAY'S AGENDA",
            ),
            Text(
              {
                variant: "display",
                size: px(76),
                weight: 800,
                letterSpacing: px(-2.4),
                color: board.ink,
                motion: titleIn,
              },
              eventName,
            ),
          ),
          Stack(
            { gap: px(12), align: "end" },
            Text(
              {
                variant: "title",
                size: px(24),
                weight: 500,
                fontFamily: MONO,
                letterSpacing: px(1),
                color: board.dim,
                motion: dateIn,
              },
              date,
            ),
            Frame(
              {
                width: px(150),
                height: px(44),
                radius: px(22),
                fill: std.color.alpha(accent, 0.14),
                style: { boxShadow: `inset 0 0 0 1px ${std.color.alpha(accent, 0.4)}` },
              },
              Stack(
                { width: "fill", height: "fill", align: "center", justify: "center" },
                Text(
                  { variant: "label", size: px(17), weight: 700, fontFamily: MONO, color: accent },
                  counter,
                ),
              ),
            ),
          ),
        ),
        Frame(
          { id: "board", width: "fill", height: gridH },
          Stack({ width: "fill", height: "fill", gap }, ...sessions.map(row)),
          rail,
        ),
        Frame(
          { width: "fill", height: footerH },
          Frame({ x: 0, y: 0, width: "fill", height: 2, fill: board.rule }),
          Stack(
            {
              direction: "row",
              width: "fill",
              height: "fill",
              align: "center",
              justify: "space-between",
              pad: { top: px(18) },
            },
            Text(
              { variant: "label", size: px(15), weight: 600, letterSpacing: px(3), color: board.dim },
              `${n} SESSIONS`,
            ),
            Text(
              { variant: "label", size: px(15), weight: 600, letterSpacing: px(3), fontFamily: MONO, color: board.dim },
              settle > 0 ? "SEE YOU THERE" : "DOORS OPEN",
            ),
          ),
        ),
      ),
      Frame({
        x: 0,
        y: 0,
        width,
        height: px(3),
        fill: accent,
        style: {
          transformOrigin: "left center",
          transform: `scaleX(${ctx.timeline.progress.toFixed(4)})`,
          opacity: 0.7,
        },
      }),
    );
  },
});
