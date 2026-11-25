// Meetup Announcement — a two-ink risograph flyer that prints itself.
// Paper + halftone, a coral slab floods the lower half, the headline knocks in
// off-register, then the logistics arrive as a torn ticket stub.

import { video, Frame, Stack, Text, Fill, Html, type FrameProps, type RenderContext, googleFont } from "@foxworth/superimg";

export interface MeetupAnnouncementData extends Record<string, unknown> {
  hook: string;
  hookLine2: string;
  subheader: string;
  talkTitle: string;
  date: string;
  time: string;
  address: string;
  groupName: string;
  brandColor: string;
}

const PAPER = "#F4EFE4";
const INK = "#17140F";
const DISPLAY = "'Bebas Neue', Inter, sans-serif";

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "··";
  return words.slice(0, 3).map((w) => w[0]!.toUpperCase()).join("");
}

export default video<MeetupAnnouncementData>({
  duration: "12s",
  fps: 30,
  poster: "8.6s",
  fonts: [googleFont("Bebas Neue"), googleFont("Inter:wght@400;500;600;700;800")],
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
    hook: "OKC has a tech scene.",
    hookLine2: "We saved you a seat.",
    subheader: "Laptops welcome. Beginners too.",
    talkTitle: "Coworking at 8th Street Market",
    date: "March 18",
    time: "11 AM – 1 PM",
    address: "3 NE 8th St · Oklahoma City, OK",
    groupName: "OKC Coffee and Code",
    brandColor: "#F2542D",
  },

  render(ctx: RenderContext<MeetupAnnouncementData>) {
    const { std, width, height, data, isPortrait, isSquare } = ctx;
    const { hook, hookLine2, subheader, talkTitle, date, time, address, groupName } = data;
    const coral = data.brandColor;

    function pick<T>(o: { portrait: T; square: T; wide: T }): T {
      return isPortrait ? o.portrait : isSquare ? o.square : o.wide;
    }

    const s = Math.min(width, height) / 1080;
    const px = (n: number) => Math.round(n * s);

    const t = ctx.director({ press: "17%", hook: "27%", bill: "32%", stamp: "24%" });
    const press = t.in("press");
    const bill = t.in("bill");
    const stamp = t.in("stamp");

    const fold = Math.round(height * pick({ portrait: 0.54, square: 0.52, wide: 0.5 }));

    // ---- the two inks ----------------------------------------------------
    const flood = std.interpolate(press, [0.05, 0.95], [0, 1], "easeOutQuint");
    const slabDrop = (1 - flood) * (height - fold + px(40));
    const tilt = px(pick({ portrait: 34, square: 30, wide: 26 }));
    const inkSvg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <defs>
    <pattern id="riso-dots" width="${px(12)}" height="${px(12)}" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
      <circle cx="${px(3)}" cy="${px(3)}" r="${px(1.8)}" fill="${INK}" opacity="0.09" />
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#riso-dots)" />
  <g transform="translate(0 ${slabDrop.toFixed(1)})">
    <polygon points="0,${fold + tilt} ${width},${fold - tilt} ${width},${height + tilt} 0,${height + tilt}"
      fill="${coral}" opacity="0.94" />
    <polygon points="0,${fold + tilt} ${width},${fold - tilt} ${width},${fold - tilt + px(8)} 0,${fold + tilt + px(8)}"
      fill="${INK}" opacity="0.2" />
  </g>
</svg>`;

    const markR = px(24);
    const inset = px(48);
    const marks = std.interpolate(press, [0.3, 1], [0, 1], "easeOutCubic");
    const cross = (cx: number, cy: number, stroke: string) =>
      `<g opacity="${marks.toFixed(3)}">
        <line x1="${cx - markR}" y1="${cy}" x2="${cx + markR}" y2="${cy}" stroke="${stroke}" stroke-width="${px(2)}" />
        <line x1="${cx}" y1="${cy - markR}" x2="${cx}" y2="${cy + markR}" stroke="${stroke}" stroke-width="${px(2)}" />
        <circle cx="${cx}" cy="${cy}" r="${markR * 0.5}" stroke="${stroke}" stroke-width="${px(2)}" fill="none" />
      </g>`;
    const marksSvg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  ${cross(inset, inset, INK)}${cross(width - inset, inset, INK)}
  ${cross(inset, height - inset, PAPER)}${cross(width - inset, height - inset, PAPER)}
</svg>`;

    // ---- headline --------------------------------------------------------
    const hookSize = pick({ portrait: px(98), square: px(86), wide: px(118) });
    const lineH = Math.round(hookSize * 0.92);
    const line1 = t.motion({ id: "flyer.line1", during: "hook", at: "0%", for: "32%", y: px(26), easing: "easeOutQuint", exit: false });
    const line2 = t.motion({ id: "flyer.line2", during: "hook", at: "20%", for: "32%", y: px(26), easing: "easeOutQuint", exit: false });
    const subIn = t.motion({ id: "flyer.sub", during: "hook", at: "46%", for: "34%", y: px(12), exit: false });
    const badgeIn = t.motion({ id: "flyer.badge", during: "press", at: "50%", for: "50%", y: px(-14), exit: false });

    /** Ink pull with a coral plate a few thou off register — the riso tell. */
    function inkLine(text: string, motion: FrameProps["motion"], ghost: string) {
      return Frame(
        { width: "fill", height: lineH, style: motion },
        Text(
          {
            variant: "display", size: hookSize, lineHeight: 0.92, align: "center",
            color: ghost, fontFamily: DISPLAY, letterSpacing: px(1),
            style: { transform: `translate(${px(-4)}px, ${px(3)}px)`, opacity: 0.75 },
          },
          text,
        ),
        Text(
          {
            variant: "display", size: hookSize, lineHeight: 0.92, align: "center",
            color: INK, fontFamily: DISPLAY, letterSpacing: px(1),
          },
          text,
        ),
      );
    }

    // ---- ticket stub -----------------------------------------------------
    const stubIn = t.motion({ id: "flyer.stub", during: "bill", at: "8%", for: "30%", y: px(40), scale: 0.96, easing: "easeOutQuint", exit: false });
    const stubW = pick({
      portrait: Math.round(width * 0.84),
      square: Math.round(width * 0.82),
      wide: Math.round(width * 0.5),
    });
    const perfR = px(8);
    const perfW = stubW - px(76);
    const perfN = Math.max(8, Math.floor(perfW / px(30)));
    const perfSvg = `<svg width="${perfW}" height="${perfR * 2}" viewBox="0 0 ${perfW} ${perfR * 2}" fill="none">
  ${Array.from({ length: perfN }, (_, i) => {
    const cx = ((i + 0.5) / perfN) * perfW;
    return `<circle cx="${cx.toFixed(1)}" cy="${perfR}" r="${perfR * 0.4}" fill="${INK}" opacity="0.32" />`;
  }).join("")}
</svg>`;

    function detail(label: string, value: string, i: number) {
      const p = std.interpolate(bill, [0.32 + i * 0.1, 0.62 + i * 0.1], [0, 1], "easeOutCubic");
      return Stack(
        {
          gap: px(6),
          width: "fill",
          style: { opacity: p, transform: `translateY(${((1 - p) * px(14)).toFixed(1)}px)` },
        },
        Text({ variant: "label", size: px(14), weight: 700, letterSpacing: px(2.6), color: std.color.alpha(INK, 0.48) }, label),
        Text({ variant: "title", size: px(27), weight: 700, letterSpacing: px(-0.3), color: INK }, value),
      );
    }

    // ---- rubber stamp ----------------------------------------------------
    const thump = std.spring(0.72, 1, std.interpolate(stamp, [0, 0.35], [0, 1], "linear"), "snappy");
    const stampRot = std.interpolate(stamp, [0, 0.35], [-13, -5.5], "easeOutBack");
    const stampOp = std.interpolate(stamp, [0, 0.14], [0, 1], "easeOutCubic");
    const stampW = pick({ portrait: px(420), square: px(400), wide: px(440) });
    const stampH = px(78);

    return Frame(
      { id: "stage", width, height },
      Fill({ color: PAPER }),
      Html({ width, height, html: inkSvg }),
      Html({ width, height, html: marksSvg }),

      Frame(
        { x: 0, y: 0, width, height: fold },
        Stack(
          {
            width: "fill",
            height: "fill",
            justify: "center",
            align: "center",
            gap: px(6),
            pad: { x: px(64), top: px(40) },
          },
          Frame(
            { width: "fill", height: px(46), style: badgeIn },
            Stack(
              { width: "fill", height: "fill", align: "center", justify: "center" },
              Stack(
                { direction: "row", gap: px(14), align: "center", height: px(38) },
                Frame(
                  { width: px(34), height: px(34), radius: px(17), fill: coral },
                  Stack(
                    { width: "fill", height: "fill", align: "center", justify: "center" },
                    Text({ variant: "label", size: px(14), weight: 800, color: INK, letterSpacing: px(0.4) }, initials(groupName)),
                  ),
                ),
                Text(
                  { variant: "label", size: px(16), weight: 700, letterSpacing: px(3), color: std.color.alpha(INK, 0.78) },
                  groupName.toUpperCase(),
                ),
              ),
            ),
          ),
          Frame({ width: px(4), height: px(18) }),
          inkLine(hook, line1, coral),
          inkLine(hookLine2, line2, coral),
          Frame(
            { width: "fill", height: px(52), style: subIn },
            Stack(
              { width: "fill", height: "fill", align: "center", justify: "end" },
              Text(
                { variant: "body", size: px(27), weight: 500, align: "center", color: std.color.alpha(INK, 0.74) },
                subheader,
              ),
            ),
          ),
        ),
      ),

      Frame(
        { x: 0, y: fold, width, height: height - fold },
        Stack(
          { width: "fill", height: "fill", align: "center", justify: "center", gap: px(48), pad: { x: px(56), y: px(44) } },
          Stack(
            {
              width: stubW,
              gap: px(18),
              pad: { x: px(38), y: px(30) },
              radius: px(10),
              fill: PAPER,
              style: {
                ...(stubIn as object),
                boxShadow: `0 ${px(20)}px ${px(46)}px rgba(0,0,0,0.26), inset 0 0 0 ${px(2)}px ${INK}`,
              },
            },
            Text(
              { variant: "title", size: px(33), weight: 800, align: "center", letterSpacing: px(-0.6), color: INK, lineHeight: 1.15 },
              talkTitle,
            ),
            Html({ width: perfW, height: perfR * 2, html: perfSvg }),
            Stack(
              {
                direction: pick<"row" | "column">({ portrait: "column", square: "column", wide: "row" }),
                gap: px(20),
                width: "fill",
              },
              detail("WHEN", `${date} · ${time}`, 0),
              detail("WHERE", address, 1),
            ),
          ),
          Frame(
            {
              width: stampW,
              height: stampH,
              radius: px(6),
              style: {
                opacity: stampOp,
                transform: `rotate(${stampRot.toFixed(2)}deg) scale(${thump.toFixed(3)})`,
                boxShadow: `inset 0 0 0 ${px(4)}px ${std.color.alpha(PAPER, 0.92)}`,
              },
            },
            Stack(
              { width: "fill", height: "fill", align: "center", justify: "center" },
              Text(
                {
                  variant: "title", size: px(40), weight: 400, align: "center",
                  color: PAPER, fontFamily: DISPLAY, letterSpacing: px(5),
                },
                "YOUR SEAT'S WAITING",
              ),
            ),
          ),
        ),
      ),
    );
  },
});
