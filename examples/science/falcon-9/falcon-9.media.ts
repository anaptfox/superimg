// People beside a ship, then the years.
// Facts: Falcon 9 first flight 4 June 2010, first landing 22 December 2015,
// and the first tower catch of a ship back from orbit, Starship Ship 42,
// 14 November 2026. The booster on that flight was not caught.
// Lines are the people at each moment. The ship is what they stand next to.
// Horizons after the catch are projections counted from November 2026.
// The reel edition is a different stage, same clock.

import { Vector, googleFont, vector, video } from "@foxworth/superimg";

const NIGHT = "#07090f";
const BONE = "#F4EFE4";
const DIM = "#C5CDD8";
const QUIET = "#9AA6B5";
const COPPER = "#E2A45C";
const EARTH = "#121824";
const LIMB = "#2A3548";
const BAND = "#D9D2C4";
const ENGINE = "#C9C2B4";

const HORIZONS = [
  { id: "y1", mark: "+1", year: "2027", line: "A neighbor stops looking up." },
  { id: "y5", mark: "+5", year: "2031", line: "A clerk sells the first tank." },
  { id: "y10", mark: "+10", year: "2036", line: "Launch day is a Tuesday." },
  { id: "y20", mark: "+20", year: "2046", line: "A child of that night calls the count." },
  { id: "y50", mark: "+50", year: "2076", line: "A granddaughter asks why we cheered." },
  { id: "y250", mark: "+250", year: "2276", line: "Someone still walks that pier." },
] as const;

type HorizonId = (typeof HORIZONS)[number]["id"];

interface Stage {
  w: number;
  h: number;
  ground: number;
  nosePad: number;
  noseSky: number;
  xFlight: number;
  xPark: number;
  typeX: number;
  typeAnchor: "start" | "middle";
  earth: { cx: number; cy: number; rx: number; ry: number };
  padX0: number;
  padX1: number;
  rulerX: number;
  rulerY0: number;
  rulerY1: number;
  tickY0: number;
  tickGap: number;
  tickLabelX: number;
  sparkX0: number;
  sparkGap: number;
  depot: { cx: number; cy: number; rx: number; ry: number; tankX: number; tankY: number };
  pierX0: number;
  pierGap: number;
  gen: { cx: number; cy: number; rx: number; ry: number };
  stars: { x0: number; y0: number; w: number; h: number };
  armLen: number;
  armOpen: number;
  people: {
    crowd: readonly number[];
    stayed: readonly number[];
    clerkX: number;
    pier: readonly number[];
    elderX: number;
    childX: number;
    grandX: number;
  };
  type: {
    kickerY: number;
    kickerSize: number;
    flightY: number;
    flightSize: number;
    columnY: number;
    columnSize: number;
    backY: number;
    backSize: number;
    dateY: number;
    dateSize: number;
    caughtY: number;
    caughtSize: number;
    caughtDateY: number;
    caughtDateSize: number;
    thesisY: number;
    thesisSize: number;
    eyebrowY: number;
    eyebrowSize: number;
    markY: number;
    markSize: number;
    mythSize: number;
    yearDy: number;
    yearSize: number;
    saidDy: number;
    saidSize: number;
  };
}

const LAND: Stage = {
  w: 1920,
  h: 1080,
  ground: 900,
  nosePad: 582,
  noseSky: 168,
  xFlight: 640,
  xPark: 500,
  typeX: 1020,
  typeAnchor: "start",
  earth: { cx: 960, cy: 1280, rx: 1700, ry: 380 },
  padX0: 300,
  padX1: 1560,
  rulerX: 210,
  rulerY0: 210,
  rulerY1: 860,
  tickY0: 230,
  tickGap: 104,
  tickLabelX: 228,
  sparkX0: 820,
  sparkGap: 90,
  depot: { cx: 500, cy: 390, rx: 168, ry: 48, tankX: 656, tankY: 378 },
  pierX0: 760,
  pierGap: 52,
  gen: { cx: 500, cy: 602, rx: 210, ry: 92 },
  stars: { x0: 70, y0: 36, w: 1780, h: 820 },
  armLen: 200,
  armOpen: 260,
  people: {
    crowd: [320, 362, 404],
    stayed: [760, 820, 880],
    clerkX: 700,
    pier: [1100, 1180, 1260],
    elderX: 620,
    childX: 658,
    grandX: 694,
  },
  type: {
    kickerY: 430,
    kickerSize: 60,
    flightY: 492,
    flightSize: 28,
    columnY: 500,
    columnSize: 48,
    backY: 470,
    backSize: 68,
    dateY: 530,
    dateSize: 28,
    caughtY: 470,
    caughtSize: 64,
    caughtDateY: 540,
    caughtDateSize: 28,
    thesisY: 500,
    thesisSize: 46,
    eyebrowY: 300,
    eyebrowSize: 15,
    markY: 500,
    markSize: 120,
    mythSize: 132,
    yearDy: 56,
    yearSize: 26,
    saidDy: 112,
    saidSize: 32,
  },
};

/** 9:16. Words in the upper safe third. People on the ground. The ship in the tall sky. */
const REEL: Stage = {
  w: 1080,
  h: 1920,
  ground: 1520,
  nosePad: 1212,
  noseSky: 740,
  xFlight: 540,
  xPark: 480,
  typeX: 540,
  typeAnchor: "middle",
  earth: { cx: 540, cy: 1900, rx: 1500, ry: 380 },
  padX0: 160,
  padX1: 920,
  rulerX: 200,
  rulerY0: 760,
  rulerY1: 1460,
  tickY0: 800,
  tickGap: 108,
  tickLabelX: 218,
  sparkX0: 396,
  sparkGap: 72,
  depot: { cx: 480, cy: 900, rx: 140, ry: 40, tankX: 600, tankY: 888 },
  pierX0: 360,
  pierGap: 40,
  gen: { cx: 480, cy: 1232, rx: 170, ry: 80 },
  stars: { x0: 36, y0: 48, w: 1008, h: 1420 },
  armLen: 150,
  armOpen: 120,
  people: {
    crowd: [250, 300, 350],
    stayed: [760, 820, 880],
    clerkX: 900,
    pier: [300, 860, 930],
    elderX: 640,
    childX: 678,
    grandX: 714,
  },
  type: {
    kickerY: 400,
    kickerSize: 52,
    flightY: 468,
    flightSize: 26,
    columnY: 450,
    columnSize: 36,
    backY: 440,
    backSize: 52,
    dateY: 508,
    dateSize: 26,
    caughtY: 440,
    caughtSize: 52,
    caughtDateY: 516,
    caughtDateSize: 24,
    thesisY: 450,
    thesisSize: 38,
    eyebrowY: 300,
    eyebrowSize: 14,
    markY: 500,
    markSize: 100,
    mythSize: 116,
    yearDy: 52,
    yearSize: 22,
    saidDy: 108,
    saidSize: 26,
  },
};

function unit(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function starsFor(stage: Stage) {
  const box = stage.stars;
  return Array.from({ length: 64 }, (_, i) => ({
    id: `star-${i}`,
    x: box.x0 + unit(i + 1) * box.w,
    y: box.y0 + unit(i + 80) * box.h,
    r: unit(i + 50) > 0.94 ? 2.15 : unit(i + 50) > 0.78 ? 1.45 : 0.85,
    mag: 0.28 + unit(i + 7) * 0.5,
    phase: unit(i + 3) * Math.PI * 2,
  }));
}

/** Card presence. Exit is shorter than the entrance. Last card holds. */
function cardOpacity(
  p: number,
  leave: boolean,
  easeOut: (n: number) => number,
  easeIn: (n: number) => number,
): number {
  const enter = easeOut(Math.min(1, p / 0.2));
  if (!leave) return enter;
  const exitT = p <= 0.85 ? 0 : Math.min(1, (p - 0.85) / 0.15);
  return enter * (1 - easeIn(exitT));
}

/** Rises to 1, then settles to a quiet remainder instead of vanishing. */
function markOpacity(p: number, rest: number, easeOut: (n: number) => number, easeInOut: (n: number) => number): number {
  if (p <= 0) return 0;
  const enter = easeOut(Math.min(1, p / 0.16));
  if (p >= 1) return rest;
  const settle = 1 - (1 - rest) * easeInOut(Math.max(0, (p - 0.72) / 0.28));
  return Math.min(enter, settle);
}

function rocketBody(
  prefix: string,
  x: number,
  y: (local: number) => number,
  legs: number,
  fill: string,
) {
  const foot = 16 + legs * 58;
  const nose = `M ${x} ${y(8)} C ${x + 15} ${y(32)}, ${x + 18} ${y(66)}, ${x + 17} ${y(80)} L ${x - 17} ${y(80)} C ${x - 18} ${y(66)}, ${x - 15} ${y(32)}, ${x} ${y(8)} Z`;
  const body = `M ${x - 17} ${y(80)} H ${x + 17} V ${y(250)} H ${x - 17} Z`;
  const band = `M ${x - 17} ${y(132)} H ${x + 17} V ${y(142)} H ${x - 17} Z`;
  const finL = `M ${x - 17} ${y(102)} L ${x - 40} ${y(96)} L ${x - 42} ${y(114)} L ${x - 17} ${y(118)} Z`;
  const finR = `M ${x + 17} ${y(102)} L ${x + 40} ${y(96)} L ${x + 42} ${y(114)} L ${x + 17} ${y(118)} Z`;
  const bell = `M ${x - 12} ${y(250)} L ${x + 12} ${y(250)} L ${x + 17} ${y(286)} L ${x - 17} ${y(286)} Z`;
  const legL = `M ${x - 12} ${y(232)} L ${x - foot} ${y(308)} L ${x - (foot - 7)} ${y(316)} L ${x - 8} ${y(246)} Z`;
  const legR = `M ${x + 12} ${y(232)} L ${x + foot} ${y(308)} L ${x + (foot - 7)} ${y(316)} L ${x + 8} ${y(246)} Z`;
  const parts: Array<[string, string, string]> = [
    ["nose", nose, fill],
    ["body", body, fill],
    ["band", band, BAND],
    ["fin-l", finL, fill],
    ["fin-r", finR, fill],
    ["bell", bell, ENGINE],
    ["leg-l", legL, fill],
    ["leg-r", legR, fill],
  ];
  return parts.map(([name, d, paint]) =>
    vector.path({ id: `${prefix}-${name}`, d, fill: paint }),
  );
}

/** A person at the pad. Small on purpose: the ship is the tall thing beside them. */
function person(id: string, x: number, ground: number, height: number, opacity: number) {
  const headR = Math.max(2.1, height * 0.16);
  const headY = ground - height;
  return [
    vector.circle({
      id: `${id}-head`,
      cx: x,
      cy: headY,
      r: headR,
      fill: BONE,
      opacity,
    }),
    vector.path({
      id: `${id}-body`,
      d: `M ${x} ${headY + headR} L ${x} ${ground - 1}`,
      fill: "none",
      stroke: BONE,
      strokeWidth: 1.6,
      opacity,
    }),
  ];
}

function plate(ctx: { std: any; director: any; seconds?: number }, stage: Stage) {
  const { std } = ctx;
  const d = ctx.director({
    acts: {
      night: [0, 7.4],
      ascent: [5.8, 14.8],
      return: [13.0, 24.7],
      horizon: [24.1, 54],
    },
    cues: {
      pad: [0.25, 1.15],
      draw: [1.05, 3.9],
      title: [2.5, 6.7],
      ignite: [6.2, 7.35],
      clear: [7.2, 8.1],
      column: [8.2, 12.0],
      sep: [11.35, 12.25],
      fall: [14.35, 15.3],
      legs: [14.55, 15.9],
      dust: [15.3, 16.9],
      back: [15.85, 20.15],
      caught: [20.2, 24.6],
      thesis: [24.35, 27.55],
      park: [24.05, 25.05],
      y1: [27.15, 31.3],
      y5: [30.75, 34.9],
      y10: [34.35, 38.5],
      y20: [37.95, 42.1],
      y50: [41.55, 45.95],
      y250: [45.4, 54],
    },
  });

  const easeOut = (n: number) => std.interpolate(n, [0, 1], [0, 1], "easeOutCubic");
  const easeIn = (n: number) => std.interpolate(n, [0, 1], [0, 1], "easeInCubic");
  const easeInOut = (n: number) => std.interpolate(n, [0, 1], [0, 1], "easeInOutCubic");

  const built = easeOut(d.span("draw"));
  const legs = easeOut(d.span("legs"));
  const up = std.interpolate(d.span("clear"), [0, 1], [0, 1], "easeOutExpo");
  const down = easeIn(d.span("fall"));
  const parked = easeInOut(d.span("park"));
  const myth = std.interpolate(d.span("y250"), [0.22, 0.5], [0, 1], "easeInOutCubic");
  const catchP = easeOut(d.span("caught"));

  const rocketX = stage.xFlight + (stage.xPark - stage.xFlight) * parked;
  const noseY = stage.nosePad + (stage.noseSky - stage.nosePad) * up * (1 - down);
  const yMain = (local: number) => noseY + local;

  const lit = easeOut(d.span("ignite"));
  const choke = easeIn(d.span("sep"));
  const relight = std.interpolate(d.span("fall"), [0, 0.4], [0, 1], "easeOutCubic");
  const kill = std.interpolate(d.span("dust"), [0.12, 0.62], [0, 1], "easeInCubic");
  const throttle = Math.max(lit * (1 - choke) * 0.94, relight * (1 - kill) * 0.62);
  const flicker = 0.9 + 0.1 * Math.sin(d.seconds * 36);

  const sepP = d.inSpan("sep") ? d.span("sep") : 0;
  const sepFlash = Math.sin(sepP * Math.PI);
  const dustP = d.inSpan("dust") ? d.span("dust") : 0;
  const pinchP = d.inSpan("caught") ? Math.max(0, (d.span("caught") - 0.7) / 0.3) : 0;
  const pinch = Math.sin(Math.min(1, pinchP) * Math.PI);

  const spans: Record<HorizonId, number> = {
    y1: d.span("y1"),
    y5: d.span("y5"),
    y10: d.span("y10"),
    y20: d.span("y20"),
    y50: d.span("y50"),
    y250: d.span("y250"),
  };

  const titleP = cardOpacity(d.span("title"), true, easeOut, easeIn);
  const columnP = cardOpacity(d.span("column"), true, easeOut, easeIn);
  const backP = cardOpacity(d.span("back"), true, easeOut, easeIn);
  const caughtP = cardOpacity(d.span("caught"), true, easeOut, easeIn);
  const thesisP = cardOpacity(d.span("thesis"), true, easeOut, easeIn);
  const eyebrow = std.interpolate(d.span("thesis"), [0.55, 0.95], [0, 1], "easeOutCubic");
  const rulerP = easeOut(d.span("park"));
  const padP = easeOut(d.span("pad"));
  const reflect = markOpacity(spans.y50, 0.22, easeOut, easeInOut) * (1 - myth) * 0.55;
  const arrived = easeOut(d.span("title"));
  const thin = easeOut(Math.min(1, spans.y1 / 0.4));
  const crowdOp = arrived * (1 - 0.78 * thin);
  const stayedOp = markOpacity(d.span("caught"), 0.62, easeOut, easeInOut) * (1 - 0.45 * thin);
  const clerkOp = markOpacity(spans.y5, 0.72, easeOut, easeInOut);
  const pierPeopleOp = markOpacity(spans.y10, 0.5, easeOut, easeInOut);
  const kinOp = markOpacity(spans.y20, 0.8, easeOut, easeInOut);
  const grandOp = markOpacity(spans.y50, 0.85, easeOut, easeInOut);
  const arms = markOpacity(d.span("caught"), 0.42, easeOut, easeInOut) * (1 - myth);

  const revealTop = yMain(320) - 332 * built;
  const revealH = Math.max(0.5, 340 * built);

  const flameH = 36 + throttle * 150 * flicker;
  const flameW = (10 + throttle * 8) * flicker;
  const flame = `M ${rocketX} ${yMain(286)} C ${rocketX + flameW} ${yMain(286) + flameH * 0.35}, ${rocketX + flameW * 0.55} ${yMain(286) + flameH * 0.78}, ${rocketX} ${yMain(286) + flameH} C ${rocketX - flameW * 0.55} ${yMain(286) + flameH * 0.78}, ${rocketX - flameW} ${yMain(286) + flameH * 0.35}, ${rocketX} ${yMain(286)} Z`;

  const trailTop = yMain(286);
  const trail = up * (1 - down) * (1 - Math.max(parked, myth));
  const open = stage.armOpen * (1 - catchP);
  const armY = yMain(160);

  const mythPts = [
    { id: "nose", lx: 0, ly: 16 },
    { id: "fin-l", lx: -36, ly: 104 },
    { id: "fin-r", lx: 36, ly: 104 },
    { id: "heart", lx: 0, ly: 176 },
    { id: "bell", lx: 0, ly: 270 },
    { id: "foot-l", lx: -62, ly: 308 },
    { id: "foot-r", lx: 62, ly: 308 },
  ];
  const mythEdges: Array<[string, number, number, number, number]> = [
    ["spine-a", 0, 16, 0, 176],
    ["spine-b", 0, 176, 0, 270],
    ["fin-a", 0, 104, -36, 104],
    ["fin-b", 0, 104, 36, 104],
    ["foot-a", 0, 250, -62, 308],
    ["foot-b", 0, 250, 62, 308],
  ];

  const typeShift = (p: number) => std.interpolate(p, [0, 0.2], [16, 0], "easeOutCubic");
  const t = stage.type;

  const line = (
    id: string,
    text: string,
    x: number,
    y: number,
    size: number,
    opacity: number,
    opts: { family?: string; weight?: number; fill?: string; spacing?: number; anchor?: "start" | "middle" } = {},
  ) =>
    vector.text(
      {
        id,
        x,
        y: y + (opacity <= 0 ? 16 : 0),
        family: opts.family ?? "Inter, sans-serif",
        size,
        weight: opts.weight ?? 400,
        fill: opts.fill ?? BONE,
        opacity,
        letterSpacing: opts.spacing,
        anchor: opts.anchor ?? stage.typeAnchor,
      },
      text,
    );

  const padD = `M ${stage.padX0} ${stage.ground} H ${stage.padX1}`;
  const rulerD = `M ${stage.rulerX} ${stage.rulerY0} V ${stage.rulerY1}`;
  const stars = starsFor(stage);

  return Vector(
    {
      id: "plate",
      width: stage.w,
      height: stage.h,
      viewBox: { x: 0, y: 0, width: stage.w, height: stage.h },
      fit: "fill",
    },
    vector.defs(
      vector.linearGradient(
        { id: "sky", x1: "0", y1: "0", x2: "0", y2: "1" },
        vector.stop({ offset: "0%", stopColor: "#07090f" }),
        vector.stop({ offset: "62%", stopColor: "#0c121c" }),
        vector.stop({ offset: "100%", stopColor: "#141b28" }),
      ),
      vector.linearGradient(
        { id: "flame", x1: "0", y1: "0", x2: "0", y2: "1" },
        vector.stop({ offset: "0%", stopColor: "#fff6e4" }),
        vector.stop({ offset: "28%", stopColor: "#ffb15a" }),
        vector.stop({ offset: "70%", stopColor: "#ff5a1f" }),
        vector.stop({ offset: "100%", stopColor: "#ff5a1f", stopOpacity: 0 }),
      ),
      vector.clip(
        { id: "ship-reveal" },
        vector.rect({ x: rocketX - 130, y: revealTop, width: 260, height: revealH, fill: "#fff" }),
      ),
    ),
    vector.rect({ id: "sky-plate", x: 0, y: 0, width: stage.w, height: stage.h, fill: "sky" }),
    ...stars.map((s) => {
      const tw = 0.72 + 0.28 * Math.sin(d.seconds * 1.15 + s.phase);
      return vector.circle({
        id: s.id,
        cx: s.x,
        cy: s.y,
        r: s.r,
        fill: BONE,
        opacity: s.mag * tw,
      });
    }),
    vector.ellipse({ id: "earth", cx: stage.earth.cx, cy: stage.earth.cy, rx: stage.earth.rx, ry: stage.earth.ry, fill: EARTH }),
    vector.ellipse({
      id: "limb",
      cx: stage.earth.cx,
      cy: stage.earth.cy,
      rx: stage.earth.rx,
      ry: stage.earth.ry,
      fill: "none",
      stroke: LIMB,
      strokeWidth: 1.5,
    }),
    vector.group(
      { id: "reflection", opacity: reflect },
      ...rocketBody("ghost", rocketX, (local) => 2 * stage.ground - noseY - local, legs, BONE),
    ),
    vector.path({
      id: "pad",
      d: padD,
      fill: "none",
      stroke: LIMB,
      strokeWidth: 1.5,
      opacity: 0.35 + 0.65 * padP,
      ...std.svg.draw(padD, padP),
    }),
    vector.path({
      id: "trail",
      d: `M ${rocketX} ${stage.ground} L ${rocketX} ${trailTop}`,
      fill: "none",
      stroke: COPPER,
      strokeWidth: 1.25,
      opacity: trail * 0.45,
    }),
    vector.path({
      id: "plume",
      d: flame,
      fill: "flame",
      opacity: Math.min(1, throttle * 1.35),
    }),
    vector.group(
      { id: "ship", clip: "ship-reveal", opacity: 1 - myth },
      ...rocketBody("ship", rocketX, yMain, legs, BONE),
    ),
    vector.rect({
      id: "arm-l",
      x: rocketX - 22 - stage.armLen - open,
      y: armY,
      width: stage.armLen,
      height: 14,
      fill: COPPER,
      opacity: arms,
    }),
    vector.rect({
      id: "arm-r",
      x: rocketX + 22 + open,
      y: armY,
      width: stage.armLen,
      height: 14,
      fill: COPPER,
      opacity: arms,
    }),
    vector.path({
      id: "pinch",
      d: `M ${rocketX} ${armY - 10} V ${armY + 24}`,
      fill: "none",
      stroke: BONE,
      strokeWidth: 1.5,
      opacity: pinch * 0.9,
    }),
    vector.path({
      id: "sep-flash",
      d: `M ${rocketX - 90} ${yMain(148)} H ${rocketX + 90}`,
      fill: "none",
      stroke: BONE,
      strokeWidth: 1.5,
      opacity: sepFlash * 0.85,
    }),
    vector.circle({
      id: "dust",
      cx: rocketX,
      cy: stage.ground,
      r: 18 + dustP * 210,
      fill: "none",
      stroke: COPPER,
      strokeWidth: 1.5,
      opacity: dustP <= 0 ? 0 : (1 - dustP) * 0.7,
    }),
    ...stage.people.crowd.flatMap((x, i) => person(`crowd-${i}`, x, stage.ground, 34, crowdOp)),
    ...stage.people.stayed.flatMap((x, i) => person(`stayed-${i}`, x, stage.ground, 34, stayedOp)),
    ...person("clerk", stage.people.clerkX, stage.ground, 34, clerkOp),
    ...stage.people.pier.flatMap((x, i) => person(`shift-${i}`, x, stage.ground, 32, pierPeopleOp)),
    ...person("elder", stage.people.elderX, stage.ground, 36, kinOp),
    ...person("child", stage.people.childX, stage.ground, 20, kinOp),
    ...person("grand", stage.people.grandX, stage.ground, 16, grandOp),
    ...[0, 1, 2, 3, 4].map((i) => {
      const spark = markOpacity(spans.y1, 0.34, easeOut, easeInOut);
      const local = Math.min(1, Math.max(0, (spans.y1 - i * 0.045) / 0.18));
      const grown = Math.max(local, spans.y1 >= 1 ? 1 : 0);
      const hgt = 14 + (26 + (i % 2) * 16) * grown;
      const x = stage.sparkX0 + i * stage.sparkGap;
      return vector.path({
        id: `spark-${i}`,
        d: `M ${x} ${stage.ground} L ${x} ${stage.ground - hgt}`,
        fill: "none",
        stroke: COPPER,
        strokeWidth: 1.75,
        opacity: spark * (0.45 + 0.55 * easeOut(local)),
      });
    }),
    vector.ellipse({
      id: "depot-orbit",
      cx: stage.depot.cx,
      cy: stage.depot.cy,
      rx: stage.depot.rx,
      ry: stage.depot.ry,
      fill: "none",
      stroke: COPPER,
      strokeWidth: 1.25,
      opacity: markOpacity(spans.y5, 0.28, easeOut, easeInOut),
    }),
    vector.rect({
      id: "depot-tank",
      x: stage.depot.tankX,
      y: stage.depot.tankY,
      width: 22,
      height: 22,
      fill: "none",
      stroke: BONE,
      strokeWidth: 1.5,
      opacity: markOpacity(spans.y5, 0.4, easeOut, easeInOut),
    }),
    ...Array.from({ length: 9 }, (_, i) => {
      const pier = markOpacity(spans.y10, 0.3, easeOut, easeInOut);
      const hgt = 16 + (i % 3) * 10;
      const x = stage.pierX0 + i * stage.pierGap;
      return vector.path({
        id: `pier-${i}`,
        d: `M ${x} ${stage.ground} L ${x} ${stage.ground - hgt}`,
        fill: "none",
        stroke: DIM,
        strokeWidth: 1.25,
        opacity: pier,
      });
    }),
    ...Array.from({ length: 17 }, (_, i) => {
      const gen = markOpacity(spans.y20, 0.28, easeOut, easeInOut);
      const a = Math.PI + (i / 16) * Math.PI;
      return vector.circle({
        id: `gen-${i}`,
        cx: stage.gen.cx + Math.cos(a) * stage.gen.rx,
        cy: stage.gen.cy + Math.sin(a) * stage.gen.ry,
        r: i % 5 === 0 ? 2.4 : 1.5,
        fill: BONE,
        opacity: gen * (i / 16 <= spans.y20 ? 1 : 0.15),
      });
    }),
    vector.path({
      id: "ruler",
      d: rulerD,
      fill: "none",
      stroke: LIMB,
      strokeWidth: 1.25,
      opacity: rulerP,
      ...std.svg.draw(rulerD, rulerP),
    }),
    ...HORIZONS.map((h, i) => {
      const live = cardOpacity(spans[h.id], h.id !== "y250", easeOut, easeIn);
      const y = stage.tickY0 + i * stage.tickGap;
      return vector.circle({
        id: `tick-${h.id}`,
        cx: stage.rulerX,
        cy: y,
        r: live > 0.4 ? 4 : 2.2,
        fill: live > 0.4 ? COPPER : QUIET,
        opacity: rulerP * (0.45 + 0.55 * live),
      });
    }),
    ...HORIZONS.map((h, i) => {
      const live = cardOpacity(spans[h.id], h.id !== "y250", easeOut, easeIn);
      return line(`tick-label-${h.id}`, h.mark, stage.tickLabelX, stage.tickY0 + 6 + i * stage.tickGap, 16, rulerP * (0.4 + 0.6 * live), {
        weight: 500,
        fill: live > 0.45 ? BONE : QUIET,
        spacing: 0.5,
        anchor: "start",
      });
    }),
    ...mythEdges.map(([name, ax, ay, bx, by]) => {
      const dAttr = `M ${rocketX + ax} ${yMain(ay)} L ${rocketX + bx} ${yMain(by)}`;
      return vector.path({
        id: `myth-${name}`,
        d: dAttr,
        fill: "none",
        stroke: COPPER,
        strokeWidth: 1.15,
        opacity: myth * 0.75,
        ...std.svg.draw(dAttr, myth),
      });
    }),
    ...mythPts.map((p) =>
      vector.circle({
        id: `myth-${p.id}`,
        cx: rocketX + p.lx,
        cy: yMain(p.ly),
        r: p.id === "nose" ? 3.2 : 2.2,
        fill: BONE,
        opacity: myth,
      }),
    ),
    line("kicker", "They came to the coast.", stage.typeX, t.kickerY + typeShift(d.span("title")), t.kickerSize, titleP, {
      family: "Fraunces, Georgia, serif",
      weight: 600,
      spacing: -0.5,
    }),
    line("first-flight", "Falcon 9. 4 June 2010.", stage.typeX, t.flightY, t.flightSize, titleP, {
      weight: 400,
      fill: DIM,
    }),
    line("column-line", "They watched it get small.", stage.typeX, t.columnY + typeShift(d.span("column")), t.columnSize, columnP, {
      family: "Fraunces, Georgia, serif",
      weight: 600,
    }),
    line("back-line", "Nobody looked away.", stage.typeX, t.backY + typeShift(d.span("back")), t.backSize, backP, {
      family: "Fraunces, Georgia, serif",
      weight: 600,
    }),
    line("landing-date", "22 December 2015.", stage.typeX, t.dateY, t.dateSize, backP, {
      weight: 400,
      fill: DIM,
    }),
    line("caught-line", "They were still there.", stage.typeX, t.caughtY + typeShift(d.span("caught")), t.caughtSize, caughtP, {
      family: "Fraunces, Georgia, serif",
      weight: 600,
    }),
    line("caught-date", "Starship. 14 November 2026.", stage.typeX, t.caughtDateY, t.caughtDateSize, caughtP, {
      weight: 400,
      fill: DIM,
    }),
    line("thesis-line", "Who is still at the fence.", stage.typeX, t.thesisY + typeShift(d.span("thesis")), t.thesisSize, thesisP, {
      family: "Fraunces, Georgia, serif",
      weight: 600,
    }),
    line("eyebrow", "PROJECTION", stage.typeX, t.eyebrowY, t.eyebrowSize, eyebrow, {
      weight: 600,
      fill: COPPER,
      spacing: 4.5,
    }),
    ...HORIZONS.map((h) => {
      const p = spans[h.id];
      const op = cardOpacity(p, h.id !== "y250", easeOut, easeIn);
      const lineOp = h.id === "y250" ? std.interpolate(p, [0.46, 0.62], [0, 1], "easeOutCubic") : op;
      const y = t.markY + typeShift(p);
      return [
        line(`mark-${h.id}`, h.mark, stage.typeX, y, h.id === "y250" ? t.mythSize : t.markSize, op, {
          family: "Fraunces, Georgia, serif",
          weight: 600,
          spacing: -1.5,
        }),
        line(`year-${h.id}`, h.year, stage.typeX, y + t.yearDy, t.yearSize, op, {
          weight: 500,
          fill: COPPER,
          spacing: 3,
        }),
        line(`said-${h.id}`, h.line, stage.typeX, y + t.saidDy, t.saidSize, lineOp, {
          weight: 400,
          fill: DIM,
        }),
      ];
    }).flat(),
  );
}

export default video({
  duration: "54s",
  fps: 30,
  poster: "51s",
  size: { width: 1920, height: 1080 },
  background: NIGHT,
  fonts: [googleFont("Fraunces:wght@500;600"), googleFont("Inter:wght@400;500;600")],
  editions: {
    reel: {
      size: { width: 1080, height: 1920 },
      render: (ctx) => plate(ctx, REEL),
    },
  },
  render(ctx) {
    return plate(ctx, LAND);
  },
});
