// Aperture — a seek-driven Lottie mark. Six blades spiral into a locked ring,
// then the core fires. std.viz.lottie is scrubbed by the director, never played.
import { Html, video, googleFont } from "@foxworth/superimg";

const CHARCOAL = "#141210";
const BONE = "#F2EDE4";
const VERMILION = "#D8542F";

const BONE_RGB: [number, number, number] = [0.949, 0.929, 0.894];
const VERMILION_RGB: [number, number, number] = [0.847, 0.329, 0.184];

/** Two-keyframe segment with an ease-out feel, sized to the value arity. */
function kf(t0: number, s0: number[], t1: number, s1: number[]): object[] {
  return [
    {
      t: t0,
      s: s0,
      i: { x: s0.map(() => 0.32), y: s0.map(() => 1) },
      o: { x: s0.map(() => 0.6), y: s0.map(() => 0) },
    },
    { t: t1, s: s1 },
  ];
}

function shapeLayer(opts: {
  ind: number;
  name: string;
  pos: [number, number];
  shapes: object[];
  scale?: object[];
  opacity?: object[];
  rotation?: object[] | number;
}): object {
  const rotation = opts.rotation;
  return {
    ddd: 0,
    ind: opts.ind,
    ty: 4,
    nm: opts.name,
    sr: 1,
    ks: {
      o: opts.opacity ? { a: 1, k: opts.opacity } : { a: 0, k: 100 },
      r:
        Array.isArray(rotation)
          ? { a: 1, k: rotation }
          : { a: 0, k: rotation ?? 0 },
      p: { a: 0, k: [opts.pos[0], opts.pos[1], 0] },
      // Anchor at the layer origin, so rotation happens about `pos`.
      a: { a: 0, k: [0, 0, 0] },
      s: opts.scale ? { a: 1, k: opts.scale } : { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    shapes: opts.shapes,
    ip: 0,
    op: 90,
    st: 0,
    bm: 0,
  };
}

/**
 * A shape group. `localPos` may be a static offset or an animated keyframe
 * list — blades travel radially inward, which is what makes the close read as
 * an iris rather than six fragments finding each other.
 */
function group(name: string, items: object[], localPos: [number, number] | object[]): object {
  return {
    ty: "gr",
    nm: name,
    it: [
      ...items,
      {
        ty: "tr",
        p: Array.isArray(localPos) && typeof localPos[0] === "object"
          ? { a: 1, k: localPos }
          : { a: 0, k: localPos },
        a: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        sk: { a: 0, k: 0 },
        sa: { a: 0, k: 0 },
        nm: "Transform",
      },
    ],
  };
}

/** Blade radius at rest — the closed hexagon's flat-to-centre distance. */
const BLADE_HOME = 104;
const BLADE_START = 208;

function bladeShapes(t0: number, t1: number): object[] {
  return [
    group(
      "blade",
      [
        {
          ty: "rc",
          p: { a: 0, k: [0, 0] },
          s: { a: 0, k: [142, 30] },
          r: { a: 0, k: 15 },
          nm: "Rect",
        },
        {
          ty: "fl",
          c: { a: 0, k: [...BONE_RGB, 1] },
          o: { a: 0, k: 100 },
          r: 1,
          nm: "Fill",
        },
      ],
      kf(t0, [0, -BLADE_START], t1, [0, -BLADE_HOME]),
    ),
  ];
}

const BLADES = 6;

// Each blade sweeps in over ~0.87s on a 4-frame cascade, so the ring closes as
// a single gesture instead of six separate arrivals.
const bladeLayers = Array.from({ length: BLADES }, (_, i) => {
  const home = i * (360 / BLADES);
  const t0 = 6 + i * 4;
  const t1 = t0 + 26;
  return shapeLayer({
    ind: 10 + i,
    name: `Blade${i}`,
    pos: [256, 256],
    shapes: bladeShapes(t0, t1),
    // Rotation trails the travel slightly, so blades pivot as they land.
    rotation: kf(t0, [home - 34], t1, [home]),
    opacity: kf(t0, [0], t0 + 10, [100]),
  });
});

const LOGO_LOTTIE = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 90,
  w: 512,
  h: 512,
  nm: "aperture-mark",
  ddd: 0,
  assets: [],
  layers: [
    // Core fires last, with a short overshoot that settles.
    shapeLayer({
      ind: 1,
      name: "Core",
      pos: [256, 256],
      shapes: [
        group(
          "core",
          [
            { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [92, 92] }, nm: "Ellipse" },
            {
              ty: "fl",
              c: { a: 0, k: [...VERMILION_RGB, 1] },
              o: { a: 0, k: 100 },
              r: 1,
              nm: "Fill",
            },
          ],
          [0, 0],
        ),
      ],
      scale: [
        { t: 52, s: [0, 0, 100], i: { x: [0.25, 0.25, 0.25], y: [1, 1, 1] }, o: { x: [0.6, 0.6, 0.6], y: [0, 0, 0] } },
        { t: 66, s: [118, 118, 100], i: { x: [0.4, 0.4, 0.4], y: [1, 1, 1] }, o: { x: [0.5, 0.5, 0.5], y: [0, 0, 0] } },
        { t: 80, s: [100, 100, 100] },
      ],
      opacity: kf(52, [0], 62, [100]),
    }),
    ...bladeLayers,
    // Rim scales in first and holds as the quietest element.
    shapeLayer({
      ind: 40,
      name: "Rim",
      pos: [256, 256],
      shapes: [
        group(
          "rim",
          [
            { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [356, 356] }, nm: "Ellipse" },
            {
              ty: "st",
              c: { a: 0, k: [...BONE_RGB, 1] },
              o: { a: 0, k: 34 },
              w: { a: 0, k: 2.5 },
              lc: 2,
              lj: 2,
              nm: "Stroke",
            },
          ],
          [0, 0],
        ),
      ],
      scale: kf(0, [76, 76, 100], 30, [100, 100, 100]),
      opacity: kf(0, [0], 16, [100]),
    }),
  ],
};

export default video({
  duration: "6s",
  poster: "5s",
  fonts: [googleFont("Fraunces:wght@600"), googleFont("Inter:wght@400;600")],
  sample: {
    wordmark: "APERTURE",
    tagline: "Six blades, one opening",
    meta: "Lottie · seek-driven, never played",
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    const t = ctx.director({ mark: "51%", lockup: "14%", hold: "35%" });

    // The whole Bodymovin timeline is scrubbed across the mark phase, then held.
    const progress = t.in("mark");

    const logo = std.viz.lottie({
      animationData: LOGO_LOTTIE,
      progress,
      width: 520,
      height: 520,
      player: "light",
      background: "transparent",
    });

    const lockupP = std.interpolate(t.in("lockup"), [0, 0.7], [0, 1], "easeOutCubic");
    const taglineP = std.interpolate(t.in("lockup"), [0.4, 1], [0, 1], "easeOutCubic");
    const metaP = std.interpolate(t.in("hold"), [0, 0.6], [0, 1], "easeOutCubic");
    const ruleW = 120 * lockupP;

    return Html({ id: "aperture-lockup", width: "fill", height: "fill", html: `
<div style="${std.css({ width, height, background: CHARCOAL, position: "relative", fontFamily: "Inter, system-ui, sans-serif" }, std.css.center())}">
  <div style="${std.css({ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 })}">
    ${logo}
    <div style="${std.css({ height: 1, width: ruleW, background: VERMILION, marginTop: 12, opacity: lockupP })}"></div>
    <div style="${std.css({
      fontFamily: "Fraunces, Georgia, serif",
      fontSize: 58,
      fontWeight: 600,
      letterSpacing: 14,
      color: BONE,
      marginTop: 20,
      opacity: lockupP,
      transform: `translateY(${std.interpolate(lockupP, [0, 1], [18, 0], "easeOutCubic").toFixed(2)}px)`,
    })}">${std.text.escapeHtml(data.wordmark)}</div>
    <div style="${std.css({ fontSize: 22, color: BONE, opacity: 0.55 * taglineP })}">${std.text.escapeHtml(data.tagline)}</div>
  </div>
  <div style="${std.css({
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 16,
    letterSpacing: 4,
    color: BONE,
    opacity: 0.3 * metaP,
  })}">${std.text.escapeHtml(data.meta)}</div>
</div>` });
  },
});
