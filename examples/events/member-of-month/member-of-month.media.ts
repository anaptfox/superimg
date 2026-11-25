// Member of the Month — a gallery spotlight, not a headshot card.
// A monogram medallion is hung on a dark wall, lit, labelled, then quoted.
// The portrait is drawn geometry: rings + initials, so it ships with no photo.

import { video, Frame, Stack, Text, Fill, Html, type RenderContext, googleFont } from "@foxworth/superimg";

export interface MemberOfMonthData extends Record<string, unknown> {
  name: string;
  role: string;
  location: string;
  quote: string;
  ctaUrl: string;
  brandColor: string;
}

const WALL = "#191A21";
const PORCELAIN = "#F1EDE6";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "··";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

/** Stable per-name seed so every member gets their own ring rhythm. */
function seedOf(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export default video<MemberOfMonthData>({
  duration: "15s",
  fps: 30,
  poster: "13.5s",
  fonts: [googleFont("Inter:wght@400;500;600;700;800"), googleFont("Fraunces:opsz,wght@9..144,400;9..144,600")],
  audio: {
    id: "bed",
    src: "../../_assets/lofi-bg.mp3",
    role: "music",
    volume: 0.5,
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
    name: "Luigi Polvani",
    role: "Software Engineer",
    location: "Norman, OK",
    quote:
      "Luigi has made major contributions to the Norman tech scene through Coffee and Code meetups and Oklathon.",
    ctaUrl: "techlahoma.org/volunteer",
    brandColor: "#9FD8CB",
  },

  render(ctx: RenderContext<MemberOfMonthData>) {
    const { std, width, height, data, isPortrait, isSquare } = ctx;
    const { name, role, location, quote, ctaUrl } = data;
    const jade = data.brandColor;

    function pick<T>(o: { portrait: T; square: T; wide: T }): T {
      return isPortrait ? o.portrait : isSquare ? o.square : o.wide;
    }
    const s = Math.min(width, height) / 1080;
    const px = (n: number) => Math.round(n * s);
    const SERIF = "Fraunces, Georgia, serif";

    const t = ctx.director({ hang: "21%", name: "22%", quote: "33%", plaque: "24%" });
    const hang = t.in("hang");
    const plaque = t.in("plaque");

    // ---- the light -------------------------------------------------------
    const bloom = std.interpolate(hang, [0, 0.7], [0, 1], "easeOutCubic");
    // Focus tightens onto the plate for the last act.
    const coneW = std.interpolate(plaque, [0, 1], [78, 62], "easeInOutCubic");
    const coneY = pick({ portrait: 26, square: 30, wide: 34 });

    // ---- the medallion ---------------------------------------------------
    const medal = pick({ portrait: px(460), square: px(390), wide: px(470) });
    const seed = seedOf(name);
    const cx = medal / 2;
    const rings = [0.98, 0.86, 0.74, 0.6].map((k, i) => {
      const r = (medal / 2 - px(6)) * k;
      const p = std.interpolate(hang, [0.18 + i * 0.1, 0.62 + i * 0.1], [0, 1], "easeInOutCubic");
      const len = 2 * Math.PI * r;
      const dash = i === 1 ? `${len * 0.16} ${len * 0.06}` : `${len}`;
      return `<circle cx="${cx}" cy="${cx}" r="${r.toFixed(1)}" fill="none"
        stroke="${i === 0 ? jade : std.color.alpha(jade, 0.42 - i * 0.06)}"
        stroke-width="${px(i === 0 ? 4 : 2)}" stroke-linecap="round"
        stroke-dasharray="${dash}" stroke-dashoffset="${(len * (1 - p)).toFixed(1)}"
        transform="rotate(${(-90 + seed * 140 + i * 24).toFixed(1)} ${cx} ${cx})" />`;
    });
    const ticks = Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * Math.PI * 2;
      const r0 = medal / 2 - px(22);
      const r1 = r0 - px(i % 3 === 0 ? 13 : 7);
      const p = std.interpolate(hang, [0.3 + (i / 36) * 0.35, 0.5 + (i / 36) * 0.35], [0, 1], "easeOutCubic");
      return `<line x1="${(cx + Math.cos(a) * r0).toFixed(1)}" y1="${(cx + Math.sin(a) * r0).toFixed(1)}"
        x2="${(cx + Math.cos(a) * r1).toFixed(1)}" y2="${(cx + Math.sin(a) * r1).toFixed(1)}"
        stroke="${PORCELAIN}" stroke-width="${px(1.6)}" opacity="${(p * 0.3).toFixed(3)}" />`;
    });
    const discP = std.interpolate(hang, [0.1, 0.55], [0, 1], "easeOutCubic");
    const medalSvg = `<svg width="${medal}" height="${medal}" viewBox="0 0 ${medal} ${medal}" fill="none">
  <defs>
    <radialGradient id="disc" cx="32%" cy="22%" r="88%">
      <stop offset="0%" stop-color="${std.color.alpha(jade, 0.5)}" />
      <stop offset="46%" stop-color="rgba(255,255,255,0.12)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.42)" />
    </radialGradient>
    <linearGradient id="spec" x1="0%" y1="0%" x2="70%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.5)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </linearGradient>
  </defs>
  <circle cx="${cx}" cy="${cx}" r="${(medal / 2 - px(6)) * 0.6}" fill="url(#disc)" opacity="${discP.toFixed(3)}" />
  <path d="M ${cx} ${(cx - (medal / 2 - px(6)) * 0.6).toFixed(1)}
    A ${((medal / 2 - px(6)) * 0.6).toFixed(1)} ${((medal / 2 - px(6)) * 0.6).toFixed(1)} 0 0 0
    ${(cx - (medal / 2 - px(6)) * 0.6 * 0.72).toFixed(1)} ${(cx + (medal / 2 - px(6)) * 0.6 * 0.7).toFixed(1)}"
    fill="none" stroke="url(#spec)" stroke-width="${px(3)}" stroke-linecap="round"
    opacity="${(discP * 0.9).toFixed(3)}" />
  ${ticks.join("")}
  ${rings.join("")}
</svg>`;

    const medalIn = t.motion({
      id: "spotlight.medal",
      during: "hang",
      at: "0%",
      for: "44%",
      scale: 0.9,
      y: px(-26),
      easing: "gentle",
      exit: false,
    });
    const sway = Math.sin(ctx.timeline.seconds * 0.55 + seed * 6) * 0.35;

    // ---- copy ------------------------------------------------------------
    const nameIn = t.motion({ id: "spotlight.name", during: "name", at: "0%", for: "36%", y: px(26), exit: false });
    const roleIn = t.motion({ id: "spotlight.role", during: "name", at: "14%", for: "36%", y: px(16), exit: false });
    const ruleP = std.interpolate(t.in("name"), [0.06, 0.6], [0, 1], "easeInOutCubic");

    const quoteIn = t.motion({ id: "spotlight.quote", during: "quote", at: "6%", for: "26%", y: px(22), exit: false });
    const quoteDim = std.interpolate(plaque, [0, 0.6], [1, 0.62], "easeInOutCubic");

    const plateIn = t.motion({ id: "spotlight.plate", during: "plaque", at: "4%", for: "26%", scale: 0.94, y: px(14) });
    const ctaIn = t.motion({ id: "spotlight.cta", during: "plaque", at: "34%", for: "26%", y: px(10) });

    const wide = !isPortrait && !isSquare;
    const copyW = wide ? Math.round(width * 0.45) : Math.round(width * 0.84);
    const nameSize = pick({ portrait: px(66), square: px(54), wide: px(64) });
    const quoteSize = pick({ portrait: px(30), square: px(25), wide: px(29) });

    const copy = Stack(
      {
        width: copyW,
        gap: px(18),
        align: wide ? "start" : "center",
      },
      Text(
        {
          variant: "display",
          size: nameSize,
          weight: 800,
          letterSpacing: px(-1.8),
          color: PORCELAIN,
          align: wide ? "left" : "center",
          motion: nameIn,
        },
        name,
      ),
      Stack(
        { direction: "row", gap: px(14), align: "center", height: px(26), style: roleIn },
        Frame({
          width: px(46),
          height: px(3),
          fill: jade,
          style: { transformOrigin: "left center", transform: `scaleX(${ruleP.toFixed(3)})` },
        }),
        Text(
          { variant: "title", size: px(23), weight: 500, letterSpacing: px(0.6), color: std.color.alpha(PORCELAIN, 0.66) },
          `${role} · ${location}`,
        ),
      ),
      Frame(
        {
          width: "fill",
          height: pick({ portrait: px(250), square: px(215), wide: px(210) }),
          style: { ...(quoteIn as object), opacity: (quoteIn as { opacity: number }).opacity * quoteDim },
        },
        Frame(
          { x: wide ? px(-8) : Math.round(copyW / 2) - px(170), y: px(4), width: px(88), height: px(92) },
          Text(
            { variant: "display", size: px(112), weight: 400, color: std.color.alpha(jade, 0.5), fontFamily: SERIF, lineHeight: 1 },
            "\u201C",
          ),
        ),
        Frame(
          { x: 0, y: px(78), width: "fill", height: pick({ portrait: px(170), square: px(150), wide: px(140) }) },
          Text(
            {
              variant: "body",
              size: quoteSize,
              weight: 400,
              lineHeight: 1.55,
              fontFamily: SERIF,
              color: std.color.alpha(PORCELAIN, 0.92),
              align: wide ? "left" : "center",
              maxWidth: copyW,
            },
            quote,
          ),
        ),
      ),
      Stack(
        {
          direction: "row",
          gap: px(16),
          align: "center",
          height: px(66),
          pad: { x: px(28) },
          radius: px(4),
          fill: std.color.alpha(jade, 0.13),
          style: { ...(plateIn as object), boxShadow: `inset 0 0 0 ${px(2)}px ${std.color.alpha(jade, 0.6)}` },
        },
        Frame({ width: px(10), height: px(10), radius: px(5), fill: jade }),
        Frame(
          { width: px(310), height: px(26) },
          Text(
            { variant: "label", size: px(20), weight: 700, letterSpacing: px(4), color: jade },
            "MEMBER OF THE MONTH",
          ),
        ),
      ),
      Text(
        {
          variant: "label",
          size: px(18),
          weight: 500,
          letterSpacing: px(1.4),
          color: std.color.alpha(PORCELAIN, 0.5),
          style: ctaIn,
        },
        ctaUrl,
      ),
    );

    const portrait = Frame(
      {
        width: medal,
        height: medal,
        style: {
          ...(medalIn as object),
          transform: `${(medalIn as { transform: string }).transform} rotate(${sway.toFixed(2)}deg)`,
        },
      },
      Frame({
        x: px(10),
        y: px(20),
        width: medal - px(20),
        height: medal - px(20),
        radius: "50%",
        style: { boxShadow: `0 ${px(40)}px ${px(80)}px rgba(0,0,0,0.55)` },
      }),
      Html({ width: medal, height: medal, html: medalSvg }),
      Frame(
        { x: 0, y: 0, width: medal, height: medal },
        Stack(
          { width: "fill", height: "fill", align: "center", justify: "center" },
          Text(
            {
              variant: "display",
              size: Math.round(medal * 0.3),
              weight: 600,
              align: "center",
              letterSpacing: px(-2),
              fontFamily: SERIF,
              color: PORCELAIN,
              style: { opacity: std.interpolate(hang, [0.34, 0.8], [0, 1], "easeOutCubic") },
            },
            initials(name),
          ),
        ),
      ),
    );

    return Frame(
      { id: "stage", width, height },
      Fill({ color: WALL }),
      // Wide warm wash: the room.
      Fill({
        gradient: {
          kind: "radial",
          at: `${wide ? 30 : 50}% ${coneY}%`,
          size: `${coneW * 1.4}% ${coneW * 1.15}%`,
          stops: [
            std.color.alpha("#FFE6BE", 0.3 * bloom),
            std.color.alpha("#FFE6BE", 0.09 * bloom),
            "transparent",
          ],
        },
      }),
      // Tight hot spot: the light actually on the piece.
      Fill({
        gradient: {
          kind: "radial",
          at: `${wide ? 27 : 50}% ${coneY + (wide ? 12 : 4)}%`,
          size: `${coneW * 0.5}% ${coneW * 0.62}%`,
          stops: [
            std.color.alpha("#FFF2DC", 0.34 * bloom),
            std.color.alpha("#FFF2DC", 0.05 * bloom),
            "transparent",
          ],
        },
      }),
      Fill({
        gradient: {
          kind: "linear",
          angle: "180deg",
          stops: ["rgba(0,0,0,0.42)", "transparent 30%", "transparent 58%", "rgba(0,0,0,0.58)"],
        },
      }),
      Stack(
        {
          direction: wide ? "row" : "column",
          width: "fill",
          height: "fill",
          align: "center",
          justify: "center",
          gap: pick({ portrait: px(56), square: px(38), wide: px(80) }),
          pad: { x: pick({ portrait: px(70), square: px(60), wide: px(120) }), y: px(76) },
        },
        portrait,
        copy,
      ),
    );
  },
});
