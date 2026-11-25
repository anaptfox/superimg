import { escapeHtml } from "@foxworth/superimg/stdlib/text";
// Countdown — a mechanical split-flap board counting down to a moment.
// Film: night station wall, bone flaps on ink cards, one vermillion signal.

import { video, Frame, Fill, Stack, Text, Html, googleFont } from "@foxworth/superimg";

export interface CountdownData extends Record<string, unknown> {
  /** Small line above the board — what we are counting toward. */
  eyebrow: string;
  /** How many flaps fall before the moment lands. */
  steps: number;
  /** The word the last flap settles on. */
  moment: string;
}

const WALL = "#141210";
const WALL_LOW = "#0B0A09";
const CARD = "#211E1A";
const CARD_LIP = "#2C2823";
const BONE = "#EFE7D6";
const DUST = "#8A8073";
const SIGNAL = "#D2472B";

/** Fraction of each countdown slot held before the flap starts falling. */
const FLIP_START = 0.34;

interface FaceOpts {
  width: number;
  height: number;
  radius: number;
  text: string;
}

function glyphSize(text: string, width: number, height: number): number {
  if (text.length <= 1) return height * 0.74;
  return Math.min(height * 0.42, (width * 0.84) / (text.length * 0.66));
}

/** One half of a flap card. `half` picks which slice of the glyph shows. */
function face(opts: FaceOpts, half: "top" | "bottom", extraStyle: string): string {
  const { width, height, radius, text } = opts;
  const isTop = half === "top";
  const size = glyphSize(text, width, height);
  const corners = isTop ? `${radius}px ${radius}px 0 0` : `0 0 ${radius}px ${radius}px`;
  const edge = isTop
    ? `border-top:1px solid ${CARD_LIP};`
    : `border-bottom:1px solid ${CARD_LIP};`;
  return `<div style="position:absolute;left:0;${isTop ? "top:0" : "bottom:0"};width:${width}px;height:${height / 2}px;overflow:hidden;background:${CARD};border-radius:${corners};${edge}${extraStyle}">
    <div style="position:absolute;left:0;${isTop ? "top:0" : "bottom:0"};width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;font-family:'Archivo',-apple-system,Helvetica,sans-serif;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:${text.length > 1 ? "0.02em" : "-0.03em"};font-size:${size.toFixed(1)}px;line-height:1;color:${BONE};">${escapeHtml(text)}</div>
  </div>`;
}

interface FlapOpts {
  width: number;
  height: number;
  current: string;
  next: string;
  /** 0 = current fully shown, 1 = next fully shown. */
  topFall: number;
  bottomRise: number;
}

function flapCard(o: FlapOpts): string {
  const radius = Math.round(o.width * 0.055);
  const box = { width: o.width, height: o.height, radius, text: "" };
  const cur = { ...box, text: o.current };
  const nxt = { ...box, text: o.next };

  const fallShade = 0.55 * o.topFall;
  const riseShade = 0.5 * (1 - o.bottomRise);

  return `<div style="position:absolute;inset:0;">
    ${face(nxt, "top", "")}
    ${face(cur, "bottom", "")}
    ${face(
      cur,
      "top",
      `transform-origin:50% 100%;transform:scaleY(${(1 - o.topFall).toFixed(4)});box-shadow:0 12px 24px rgba(0,0,0,${(0.35 * o.topFall).toFixed(3)});`,
    )}
    <div style="position:absolute;left:0;top:0;width:${o.width}px;height:${o.height / 2}px;background:#000;opacity:${fallShade.toFixed(3)};border-radius:${radius}px ${radius}px 0 0;transform-origin:50% 100%;transform:scaleY(${(1 - o.topFall).toFixed(4)});pointer-events:none;"></div>
    ${face(
      nxt,
      "bottom",
      `transform-origin:50% 0%;transform:scaleY(${o.bottomRise.toFixed(4)});`,
    )}
    <div style="position:absolute;left:0;bottom:0;width:${o.width}px;height:${o.height / 2}px;background:#000;opacity:${(o.bottomRise > 0 ? riseShade : 0).toFixed(3)};border-radius:0 0 ${radius}px ${radius}px;transform-origin:50% 0%;transform:scaleY(${o.bottomRise.toFixed(4)});pointer-events:none;"></div>
    <div style="position:absolute;left:0;top:${o.height / 2 - 2}px;width:${o.width}px;height:4px;background:${WALL_LOW};opacity:0.9;"></div>
    <div style="position:absolute;left:${o.width * 0.5 - 9}px;top:${o.height / 2 - 9}px;width:18px;height:18px;border-radius:50%;background:${WALL_LOW};"></div>
  </div>`;
}

export default video<CountdownData>({
  duration: "6s",
  size: { width: 1080, height: 1920 },
  poster: "5.2s",
  fonts: [googleFont("Archivo:wght@600;800"), googleFont("DM+Mono:wght@400;500")],
  sample: {
    eyebrow: "Doors open in",
    steps: 4,
    moment: "LIVE",
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    const steps = Math.max(1, Math.min(9, Math.round(Number.isFinite(data.steps) ? data.steps : 4)));
    const faces = [
      ...Array.from({ length: steps }, (_, i) => String(steps - i)),
      data.moment.toUpperCase(),
    ];

    const t = ctx.director({ count: "64%", land: "12%", hold: "24%" });

    const countP = t.in("count");
    const landP = t.in("land");
    const holdP = t.in("hold");
    const landed = landP > 0 || holdP > 0;

    const slot = countP * steps;
    const index = Math.min(steps - 1, Math.floor(slot));
    const local = slot - index;
    const rawFlip = local > FLIP_START ? (local - FLIP_START) / (1 - FLIP_START) : 0;
    const flip = countP >= 1 ? 1 : rawFlip;

    const current = landed ? faces[steps]! : faces[index]!;
    const next = landed ? faces[steps]! : faces[index + 1]!;
    const topFall = landed
      ? 1
      : std.interpolate(std.clamp01(flip / 0.5), [0, 1], [0, 1], "easeInQuad");
    const bottomRise = landed ? 1 : std.spring(0, 1, std.clamp01((flip - 0.5) / 0.5), "snappy");

    const cardW = Math.round(width * 0.62);
    const cardH = Math.round(cardW * 1.18);

    // The board takes a small mechanical knock when a flap lands.
    const knock = landed
      ? std.spring(0.965, 1, std.clamp01(landP / 0.6), "snappy")
      : 1 - 0.008 * std.clamp01((flip - 0.55) / 0.45) * (1 - flip);

    const boardMotion = t.motion({
      id: "board",
      during: "count",
      at: "0%",
      for: "14%",
      y: 34,
      scale: 0.97,
    });
    const eyebrowMotion = t.motion({
      id: "caption",
      during: "count",
      at: "4%",
      for: "12%",
      y: 14,
    });

    const tickW = Math.round((cardW - (steps - 1) * 14) / steps);
    const railProgress = landed ? steps : Math.min(steps, Math.floor(slot) + (flip > 0.5 ? 1 : 0));

    const underline = Math.round(
      cardW * std.interpolate(std.clamp01(landP / 0.75), [0, 1], [0, 1], "easeOutExpo"),
    );

    const signalGlow = landed
      ? 0.35 + 0.25 * Math.sin(std.clamp01(landP + holdP) * Math.PI * 2.2)
      : 0;

    return Frame(
      { id: "wall", width: "fill", height: "fill" },
      Fill({
        gradient: {
          kind: "radial",
          at: "50% 34%",
          size: "120% 90%",
          stops: [`${WALL} 0%`, `${WALL_LOW} 100%`],
        },
      }),
      Fill({ id: "grain", style: { background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.020) 0px, rgba(255,255,255,0.020) 1px, transparent 1px, transparent 7px)" } }),
      Stack(
        {
          id: "board",
          width: "fill",
          height: "fill",
          direction: "column",
          align: "center",
          justify: "center",
          gap: 46,
        },
        Stack(
          { id: "caption", width: cardW, height: 54, direction: "column", align: "center", gap: 14, motion: eyebrowMotion },
          Text(
            {
              variant: "label",
              size: 30,
              weight: 500,
              color: DUST,
              letterSpacing: 9,
              fontFamily: "'DM Mono', ui-monospace, monospace",
            },
            data.eyebrow.toUpperCase(),
          ),
          Frame({ width: 120, height: 2, fill: `${DUST}55` }),
        ),
        Frame(
          {
            id: "case",
            width: cardW + 56,
            height: cardH + 56,
            radius: 34,
            fill: "rgba(255,255,255,0.028)",
            style: {
              border: `1px solid rgba(239,231,214,0.10)`,
              boxShadow: `0 40px 90px rgba(0,0,0,0.55)`,
            },
            motion: boardMotion,
          },
          Html({
            id: "flap",
            x: 28,
            y: 28,
            width: cardW,
            height: cardH,
            html: `<div style="position:absolute;inset:0;transform:scale(${knock.toFixed(4)});">${flapCard(
              { width: cardW, height: cardH, current, next, topFall, bottomRise },
            )}</div>`,
          }),
        ),
        Frame(
          { width: cardW, height: 6 },
          Frame({
            x: Math.round((cardW - underline) / 2),
            y: 0,
            width: Math.max(1, underline),
            height: 6,
            radius: 3,
            fill: SIGNAL,
            style: {
              opacity: underline > 0 ? 1 : 0,
              boxShadow: `0 0 26px rgba(210,71,43,${signalGlow.toFixed(3)})`,
            },
          }),
        ),
        Stack(
          { id: "rail", width: cardW, height: 6, direction: "row", gap: 14, align: "center" },
          ...Array.from({ length: steps }, (_, i) =>
            Frame({
              key: i,
              width: tickW,
              height: 6,
              radius: 3,
              fill: i < railProgress ? SIGNAL : "rgba(239,231,214,0.14)",
            }),
          ),
        ),
      ),
    );
  },
});
