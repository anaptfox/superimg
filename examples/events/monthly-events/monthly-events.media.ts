// A month of meetups — the actual month grid, filled one date at a time.
// UTC calendar arithmetic derives weekdays from the month and year, including
// empty months and Gregorian leap years; event labels never shift the grid.

import { video, Frame, Stack, Text, Fill, type RenderContext, googleFont } from "@foxworth/superimg";

export interface MonthlyEvent {
  date: string;
  day: string;
  time: string;
  group: string;
  title: string;
  location: string;
  color: string;
}

export interface MonthlyEventsData extends Record<string, unknown> {
  month: string;
  year: string;
  hookLine1: string;
  hookLine2: string;
  tagline: string;
  cta: string;
  ctaUrl: string;
  events: MonthlyEvent[];
}

const SAND = "#E8E2D4";
const ESPRESSO = "#241E18";
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_DAYS: Record<string, number> = {
  jan: 31, feb: 28, mar: 31, apr: 30, may: 31, jun: 30,
  jul: 31, aug: 31, sep: 30, oct: 31, nov: 30, dec: 31,
};
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

function dayNumber(date: string): number {
  const m = /(\d{1,2})/.exec(date);
  return m ? Number(m[1]) : 1;
}

export function daysInMonth(month: string, year: string): number {
  const key = month.slice(0, 3).toLowerCase();
  const base = MONTH_DAYS[key] ?? 31;
  const y = Number(year);
  if (key === "feb" && y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) return 29;
  return base;
}

/** Gregorian weekday in UTC, independent of the viewer's locale/time zone. */
export function firstWeekdayOfMonth(month: string, year: string): number {
  const monthIndex = Object.keys(MONTH_DAYS).indexOf(month.slice(0, 3).toLowerCase());
  const monthStart = new Date(0);
  monthStart.setUTCFullYear(Number(year), Math.max(0, monthIndex), 1);
  return monthStart.getUTCDay();
}

export default video<MonthlyEventsData>({
  duration: "15s",
  fps: 30,
  poster: "13.8s",
  fonts: [googleFont("Inter:wght@400;500;600;700;800"), googleFont("IBM Plex Mono:wght@400;500;600")],
  audio: {
    id: "bed",
    src: "../../_assets/lofi-bg.mp3",
    role: "music",
    volume: 0.6,
    fadeIn: "0.5s",
    fadeOut: "1.5s",
    loop: true,
  },
  inlineCss: [
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { overflow: hidden; font-family: Inter, system-ui, sans-serif; }",
  ],

  editions: {
    landscape: { size: { width: 1920, height: 1080 } },
    square: { size: { width: 1080, height: 1080 } },
    story: { size: { width: 1080, height: 1920 } },
  },

  sample: {
    month: "March",
    year: "2026",
    hookLine1: "5 meetups.",
    hookLine2: "This month.",
    tagline: "Find your people.",
    cta: "All free. All welcome.",
    ctaUrl: "meetup.com/techlahoma",
    events: [
      { date: "Mar 4", day: "WED", time: "11 AM", group: "OKC Coffee & Code", title: "Coworking Session", location: "8th Street Market", color: "#D0463B" },
      { date: "Mar 7", day: "SAT", time: "6:30 PM", group: "Tulsa Web Devs", title: "React 19 Deep Dive", location: "36 Degrees North", color: "#1F6F8B" },
      { date: "Mar 12", day: "THU", time: "6 PM", group: "OKC Python", title: "Intro to FastAPI", location: "Tailwind HQ", color: "#2F7D4F" },
      { date: "Mar 18", day: "WED", time: "7 PM", group: "Techlahoma Foundation", title: "Monthly Board Meeting", location: "Virtual", color: "#6C4BB6" },
      { date: "Mar 25", day: "WED", time: "6 PM", group: "OKC Design+Dev", title: "Design Systems Workshop", location: "Starspace46", color: "#C77C1E" },
    ],
  },

  render(ctx: RenderContext<MonthlyEventsData>) {
    const { std, width, height, data, isPortrait, isSquare } = ctx;
    const { month, year, hookLine1, hookLine2, tagline, cta, ctaUrl } = data;
    const events = data.events ?? [];
    const n = events.length;

    const wide = !isPortrait && !isSquare;
    function pick<T>(o: { portrait: T; square: T; wide: T }): T {
      return isPortrait ? o.portrait : isSquare ? o.square : o.wide;
    }
    const s = Math.min(width, height) / 1080;
    const px = (v: number) => Math.round(v * s);

    const t = ctx.director({ open: "18%", fill: "44%", sweep: "14%", cta: "24%" });
    const open = t.in("open");
    const sweep = t.in("sweep");
    const ctaP = t.in("cta");

    // ---- calendar maths --------------------------------------------------
    const total = daysInMonth(month, year);
    const firstWeekday = firstWeekdayOfMonth(month, year);
    const rows = Math.ceil((firstWeekday + total) / 7);
    const eventByDay = new Map<number, number>();
    events.forEach((e, i) => eventByDay.set(dayNumber(e.date), i));

    // ---- the walk through the month --------------------------------------
    const beat = n > 0 ? t.beats({ during: "fill", of: events.map((_, i) => `e${i}`), cross: "16%" }) : undefined;
    const focus = beat
      ? beat.crossing
        ? beat.index + std.interpolate(beat.mix, [0, 1], [0, 1], "easeInOutCubic")
        : beat.index
      : 0;
    const walking = t.in("fill") > 0 && sweep <= 0;

    // ---- layout ----------------------------------------------------------
    const padX = pick({ portrait: px(64), square: px(56), wide: px(88) });
    const padY = pick({ portrait: px(72), square: px(56), wide: px(64) });
    const headerH = pick({ portrait: px(230), square: px(164), wide: px(184) });
    const gap = px(9);
    const gridW = wide ? Math.round(width * 0.57) : width - padX * 2;
    const cellW = Math.floor((gridW - gap * 6) / 7);
    const cellH = pick({ portrait: px(104), square: px(64), wide: px(100) });
    const gridX = padX;
    const gridY = padY + headerH;
    const dowH = px(30);
    const footerY = height - padY - px(34);

    const railX = wide ? gridX + gridW + px(72) : padX;
    const railW = wide ? width - railX - padX : width - padX * 2;
    const railY = wide ? gridY : gridY + dowH + px(14) + rows * (cellH + gap) + pick({ portrait: px(40), square: px(28), wide: px(40) });
    const railH = wide
      ? dowH + px(14) + rows * (cellH + gap)
      : Math.max(px(200), footerY - railY - px(40));

    // ---- header ----------------------------------------------------------
    const titleIn = t.motion({ id: "cal.title", during: "open", at: "0%", for: "46%", y: px(22), exit: false });
    const hookIn = t.motion({ id: "cal.hook", during: "open", at: "18%", for: "46%", y: px(16), exit: false });

    const header = Frame(
      { x: padX, y: padY, width: width - padX * 2, height: headerH },
      Frame(
        { x: 0, y: 0, width: Math.round(width * 0.6), height: px(96), style: titleIn },
        Text(
          {
            variant: "display",
            size: pick({ portrait: px(96), square: px(82), wide: px(104) }),
            weight: 800,
            letterSpacing: px(-4),
            lineHeight: 1,
            color: ESPRESSO,
          },
          `${month.toUpperCase()} ${year}`,
        ),
      ),
      Frame({
        x: 0,
        y: pick({ portrait: px(118), square: px(96), wide: px(118) }),
        width: gridW,
        height: px(4),
        fill: ESPRESSO,
        style: {
          transformOrigin: "left center",
          transform: `scaleX(${std.interpolate(open, [0.12, 0.7], [0, 1], "easeInOutCubic").toFixed(3)})`,
        },
      }),
      Frame(
        {
          x: 0,
          y: pick({ portrait: px(140), square: px(116), wide: px(138) }),
          width: Math.round(width * 0.6),
          height: px(40),
          style: hookIn,
        },
        Text(
          { variant: "title", size: px(30), weight: 600, letterSpacing: px(-0.4), color: std.color.alpha(ESPRESSO, 0.62) },
          `${hookLine1} ${hookLine2}`,
        ),
      ),
    );

    // ---- weekday rail ----------------------------------------------------
    const dowRow = DOW.map((d, i) =>
      Frame(
        { x: i * (cellW + gap), y: 0, width: cellW, height: dowH },
        Text(
          {
            variant: "label",
            size: px(15),
            weight: 600,
            letterSpacing: px(2.4),
            fontFamily: MONO,
            color: std.color.alpha(ESPRESSO, std.interpolate(open, [0.1 + i * 0.04, 0.4 + i * 0.04], [0, 0.58], "easeOutCubic")),
          },
          d,
        ),
      ),
    );

    // ---- the grid --------------------------------------------------------
    const cells = [];
    for (let d = 1; d <= total; d++) {
      const idx = firstWeekday + d - 1;
      const col = idx % 7;
      const row = Math.floor(idx / 7);
      const ei = eventByDay.get(d);
      const cellIn = std.interpolate(open, [0.16 + idx * 0.009, 0.5 + idx * 0.009], [0, 1], "easeOutCubic");
      const landed = ei === undefined ? 0 : std.interpolate(focus - ei, [-0.9, 0], [0, 1], "easeOutCubic");
      const near = ei === undefined ? 0 : Math.max(0, 1 - Math.abs(focus - ei) * 1.6);
      const lit = ei === undefined ? 0 : walking ? near : Math.max(0, landed) * 0.42;
      const color = ei === undefined ? ESPRESSO : events[ei]!.color;
      const bg =
        ei === undefined
          ? std.color.alpha(ESPRESSO, 0.045 * cellIn)
          : std.interpolateColor(lit, [0, 1], [std.color.alpha(color, 0.16 * landed), color]);
      const numColor =
        ei === undefined
          ? std.color.alpha(ESPRESSO, 0.34 * cellIn)
          : std.interpolateColor(lit, [0, 1], [std.color.alpha(ESPRESSO, 0.75), SAND]);

      cells.push(
        Frame(
          {
            x: col * (cellW + gap),
            y: dowH + px(14) + row * (cellH + gap),
            width: cellW,
            height: cellH,
            radius: px(5),
            fill: bg,
            style: {
              opacity: cellIn,
              transformOrigin: "center center",
              transform: `translateY(${((1 - cellIn) * px(10)).toFixed(1)}px) scale(${(1 + 0.05 * near).toFixed(3)})`,
              boxShadow:
                ei === undefined
                  ? `inset 0 0 0 1px ${std.color.alpha(ESPRESSO, 0.07 * cellIn)}`
                  : `inset 0 0 0 ${px(2)}px ${std.color.alpha(color, 0.45 + 0.45 * lit)}, 0 ${px(10)}px ${px(
                      24,
                    )}px ${std.color.alpha(color, 0.3 * lit)}`,
            },
          },
          Frame(
            { x: px(11), y: px(9), width: cellW - px(20), height: px(24) },
            Text(
              { variant: "label", size: px(19), weight: 600, fontFamily: MONO, color: numColor },
              String(d),
            ),
          ),
          ...(ei === undefined
            ? []
            : [
                Frame({
                  x: px(11),
                  y: cellH - px(16),
                  width: cellW - px(22),
                  height: px(6),
                  radius: px(3),
                  fill: std.interpolateColor(lit, [0, 1], [color, SAND]),
                  style: {
                    transformOrigin: "left center",
                    transform: `scaleX(${Math.max(0, landed).toFixed(3)})`,
                  },
                }),
              ]),
        ),
      );
    }

    const grid = Frame(
      { x: gridX, y: gridY, width: gridW, height: dowH + px(14) + rows * (cellH + gap) },
      ...dowRow,
      ...cells,
    );

    // ---- detail rail -----------------------------------------------------
    const cur = n > 0 ? events[Math.min(n - 1, Math.round(focus))]! : undefined;
    const curIdx = n > 0 ? Math.min(n - 1, Math.round(focus)) : 0;
    const railFade = 1 - std.interpolate(sweep, [0, 0.55], [0, 1], "easeInOutCubic");
    const cardEnter = beat && !beat.crossing ? std.interpolate(beat.local, [0, 0.16], [0, 1], "easeOutCubic") : 1;
    const railIn = std.interpolate(t.in("open"), [0.4, 1], [0, 1], "easeOutCubic");
    const railTop = wide ? px(150) : isSquare ? px(6) : Math.max(px(6), Math.round((railH - px(320)) / 2));
    // Square reserves a compact information rail even when the month has six rows.
    const dateY = isSquare ? px(28) : px(44);
    const groupY = isSquare ? px(72) : px(104);
    const eventTitleY = isSquare ? px(104) : px(146);
    const eventTitleH = pick({ portrait: px(150), square: px(70), wide: px(170) });
    const eventMetaY = isSquare ? px(188) : px(176) + eventTitleH;

    const detail = cur
      ? Frame(
          {
            x: railX,
            y: railY,
            width: railW,
            height: railH,
            style: { opacity: railFade * railIn * (walking || t.in("fill") > 0 ? 1 : 0.001) },
          },
          Frame({
            x: 0,
            y: 0,
            width: px(4),
            height: railH,
            fill: std.color.alpha(cur.color, 0.35),
          }),
          Frame({
            x: 0,
            y: Math.round((railH / Math.max(1, n)) * curIdx),
            width: px(4),
            height: Math.round(railH / Math.max(1, n)),
            fill: cur.color,
            style: { transition: "none" },
          }),
          Frame(
            {
              x: px(34),
              y: railTop,
              width: railW - px(34),
              height: railH - px(12),
              style: {
                opacity: cardEnter,
                transform: `translateY(${std.interpolate(cardEnter, [0, 1], [px(18), 0]).toFixed(1)}px)`,
              },
            },
            Frame(
              { x: 0, y: 0, width: railW - px(34), height: px(22) },
              Text(
                { variant: "label", size: px(15), weight: 600, letterSpacing: px(3), fontFamily: MONO, color: std.color.alpha(ESPRESSO, 0.45) },
                `${String(curIdx + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`,
              ),
            ),
            Frame(
              { x: 0, y: dateY, width: railW - px(34), height: px(46) },
              Text(
                { variant: "title", size: isSquare ? px(30) : px(38), weight: 800, letterSpacing: px(-1), color: cur.color },
                `${cur.date.toUpperCase()} · ${cur.day}`,
              ),
            ),
            Frame(
              { x: 0, y: groupY, width: railW - px(34), height: px(26) },
              Text(
                { variant: "label", size: isSquare ? px(17) : px(19), weight: 600, letterSpacing: px(1.6), color: std.color.alpha(ESPRESSO, 0.6) },
                cur.group,
              ),
            ),
            Frame(
              { x: 0, y: eventTitleY, width: railW - px(34), height: eventTitleH },
              Text(
                {
                  variant: "display",
                  size: pick({ portrait: px(52), square: px(34), wide: px(54) }),
                  weight: 800,
                  letterSpacing: px(-1.6),
                  lineHeight: 1.08,
                  color: ESPRESSO,
                  maxWidth: railW - px(40),
                },
                cur.title,
              ),
            ),
            Frame({
              x: 0,
              y: eventTitleY + eventTitleH,
              width: px(74),
              height: px(3),
              fill: std.color.alpha(ESPRESSO, 0.25),
            }),
            Frame(
              {
                x: 0,
                y: eventMetaY,
                width: railW - px(34),
                height: px(28),
              },
              Text(
                { variant: "body", size: isSquare ? px(18) : px(22), weight: 500, fontFamily: MONO, color: std.color.alpha(ESPRESSO, 0.62) },
                `${cur.time} · ${cur.location}`,
              ),
            ),
          ),
        )
      : undefined;

    // ---- closing rail ----------------------------------------------------
    const closeIn = std.interpolate(sweep, [0.55, 1], [0, 1], "easeOutCubic");
    const ctaIn = std.interpolate(ctaP, [0.05, 0.5], [0, 1], "easeOutCubic");
    const closing = Frame(
      {
        x: railX,
        y: railY,
        width: railW,
        height: railH,
        style: { opacity: closeIn },
      },
      Frame(
        { x: 0, y: railTop, width: railW, height: px(300) },
        Frame(
          { x: 0, y: 0, width: railW, height: pick({ portrait: px(210), square: px(130), wide: px(230) }) },
          Text(
            {
              variant: "display",
              size: pick({ portrait: px(82), square: px(52), wide: px(64) }),
              weight: 800,
              letterSpacing: px(-2.4),
              lineHeight: 1.06,
              color: ESPRESSO,
              maxWidth: railW,
              style: { transform: `translateY(${std.interpolate(closeIn, [0, 1], [px(20), 0]).toFixed(1)}px)` },
            },
            tagline,
          ),
        ),
        Frame({
          x: 0,
          y: pick({ portrait: px(210), square: px(130), wide: px(230) }),
          width: px(84),
          height: px(4),
          fill: std.color.alpha(ESPRESSO, 0.3),
          style: { transformOrigin: "left center", transform: `scaleX(${closeIn.toFixed(3)})` },
        }),
        n > 0 ? Frame(
          {
            x: 0,
            y: pick({ portrait: px(250), square: px(166), wide: px(270) }),
            width: railW,
            height: px(18),
            style: { opacity: ctaIn },
          },
          Stack(
            { direction: "row", gap: px(9), align: "center", height: px(18) },
            ...events.map((e) =>
              Frame({ width: px(34), height: px(9), radius: px(5), fill: e.color }),
            ),
          ),
        ) : undefined,
      ),
    );

    // ---- persistent footer ----------------------------------------------
    const footerIn = std.interpolate(open, [0.5, 1], [0, 1], "easeOutCubic");
    const footer = Frame(
      { x: padX, y: footerY, width: width - padX * 2, height: px(34), style: { opacity: footerIn } },
      Frame({
        x: 0,
        y: 0,
        width: width - padX * 2,
        height: px(2),
        fill: std.color.alpha(ESPRESSO, 0.14),
        style: { transformOrigin: "left center", transform: `scaleX(${footerIn.toFixed(3)})` },
      }),
      Frame(
        { x: 0, y: px(14), width: Math.round(width * 0.4), height: px(24) },
        Text(
          {
            variant: "label",
            size: px(19),
            weight: 600,
            letterSpacing: px(1.2),
            fontFamily: MONO,
            color: std.color.alpha(ESPRESSO, 0.7),
          },
          ctaUrl,
        ),
      ),
      Frame(
        {
          x: Math.round((width - padX * 2) * 0.62),
          y: px(14),
          width: Math.round(width * 0.38),
          height: px(24),
          style: { opacity: std.interpolate(ctaP, [0, 0.4], [0.45, 1], "easeOutCubic") },
        },
        Text(
          { variant: "label", size: px(19), weight: 600, letterSpacing: px(1.6), color: std.color.alpha(ESPRESSO, 0.7) },
          cta,
        ),
      ),
    );

    return Frame(
      { id: "stage", width, height },
      Fill({ color: SAND }),
      Fill({
        gradient: {
          kind: "radial",
          at: "18% 8%",
          size: "90% 80%",
          stops: ["rgba(255,255,255,0.5)", "rgba(255,255,255,0.12)", "transparent"],
        },
      }),
      Fill({
        gradient: {
          kind: "linear",
          angle: "160deg",
          stops: ["transparent", "transparent 58%", "rgba(36,30,24,0.07)"],
        },
      }),
      header,
      grid,
      ...(detail ? [detail] : []),
      closing,
      footer,
    );
  },
});
