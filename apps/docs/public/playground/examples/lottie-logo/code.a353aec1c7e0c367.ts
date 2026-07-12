import { define } from "superimg";

/**
 * Multi-shape logo mark (valid Bodymovin JSON):
 * rounded tile + three staggered bars + accent dot.
 * Driven by std.viz.lottie seek (progress 0→1).
 */
function kf1(
  t0: number,
  s0: number[],
  t1: number,
  s1: number[],
): object[] {
  return [
    {
      t: t0,
      s: s0,
      i: { x: s0.map(() => 0.4), y: s0.map(() => 1) },
      o: { x: s0.map(() => 0.6), y: s0.map(() => 0) },
    },
    { t: t1, s: s1 },
  ];
}

function shapeLayer(opts: {
  ind: number;
  name: string;
  /** layer position */
  pos: [number, number];
  /** shapes in local space */
  shapes: object[];
  /** scale keyframes [sx,sy,sz] */
  scale?: object[];
  /** opacity keyframes [o] */
  opacity?: object[];
  /** rotation keyframes [deg] */
  rotation?: object[];
  ip?: number;
  op?: number;
}): object {
  return {
    ddd: 0,
    ind: opts.ind,
    ty: 4,
    nm: opts.name,
    sr: 1,
    ks: {
      o: opts.opacity
        ? { a: 1, k: opts.opacity }
        : { a: 0, k: 100 },
      r: opts.rotation
        ? { a: 1, k: opts.rotation }
        : { a: 0, k: 0 },
      p: { a: 0, k: [opts.pos[0], opts.pos[1], 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: opts.scale
        ? { a: 1, k: opts.scale }
        : { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    shapes: opts.shapes,
    ip: opts.ip ?? 0,
    op: opts.op ?? 90,
    st: 0,
    bm: 0,
  };
}

function rectGroup(
  name: string,
  w: number,
  h: number,
  color: [number, number, number],
  corner = 16,
  localPos: [number, number] = [0, 0],
): object {
  return {
    ty: "gr",
    nm: name,
    it: [
      {
        ty: "rc",
        p: { a: 0, k: [0, 0] },
        s: { a: 0, k: [w, h] },
        r: { a: 0, k: corner },
        nm: "Rect",
      },
      {
        ty: "fl",
        c: { a: 0, k: [...color, 1] },
        o: { a: 0, k: 100 },
        r: 1,
        nm: "Fill",
      },
      {
        ty: "tr",
        p: { a: 0, k: localPos },
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

function ellipseGroup(
  name: string,
  size: [number, number],
  color: [number, number, number],
  localPos: [number, number] = [0, 0],
): object {
  return {
    ty: "gr",
    nm: name,
    it: [
      {
        ty: "el",
        p: { a: 0, k: [0, 0] },
        s: { a: 0, k: size },
        nm: "Ellipse",
      },
      {
        ty: "fl",
        c: { a: 0, k: [...color, 1] },
        o: { a: 0, k: 100 },
        r: 1,
        nm: "Fill",
      },
      {
        ty: "tr",
        p: { a: 0, k: localPos },
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

const BLUE: [number, number, number] = [0.357, 0.549, 1];
const CYAN: [number, number, number] = [0.31, 0.82, 0.77];
const PINK: [number, number, number] = [0.94, 0.58, 0.98];
const TILE: [number, number, number] = [0.12, 0.16, 0.27];
const WHITE: [number, number, number] = [0.94, 0.96, 1];

const LOGO_LOTTIE = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 90,
  w: 512,
  h: 512,
  nm: "superimg-logo-mark",
  ddd: 0,
  assets: [],
  layers: [
    // 1) Dark rounded tile (pops in)
    shapeLayer({
      ind: 1,
      name: "Tile",
      pos: [256, 256],
      shapes: [rectGroup("tile", 280, 280, TILE, 48)],
      scale: kf1(0, [0, 0, 100], 18, [100, 100, 100]),
      opacity: kf1(0, [0], 12, [100]),
    }),
    // 2) Top bar (grows from left)
    shapeLayer({
      ind: 2,
      name: "BarTop",
      pos: [256, 200],
      shapes: [rectGroup("bar", 160, 28, BLUE, 14)],
      scale: kf1(10, [0, 100, 100], 32, [100, 100, 100]),
      opacity: kf1(10, [0], 18, [100]),
    }),
    // 3) Middle bar (wider, staggered)
    shapeLayer({
      ind: 3,
      name: "BarMid",
      pos: [256, 256],
      shapes: [rectGroup("bar", 200, 28, CYAN, 14)],
      scale: kf1(18, [0, 100, 100], 42, [100, 100, 100]),
      opacity: kf1(18, [0], 26, [100]),
    }),
    // 4) Bottom bar
    shapeLayer({
      ind: 4,
      name: "BarBot",
      pos: [256, 312],
      shapes: [rectGroup("bar", 120, 28, PINK, 14)],
      scale: kf1(26, [0, 100, 100], 52, [100, 100, 100]),
      opacity: kf1(26, [0], 34, [100]),
    }),
    // 5) Accent dot (pops late)
    shapeLayer({
      ind: 5,
      name: "Dot",
      pos: [340, 200],
      shapes: [ellipseGroup("dot", [36, 36], WHITE)],
      scale: kf1(40, [0, 0, 100], 58, [100, 100, 100]),
      opacity: kf1(40, [0], 48, [100]),
    }),
    // 6) Soft outer ring (optional pulse at end)
    shapeLayer({
      ind: 6,
      name: "Ring",
      pos: [256, 256],
      shapes: [
        {
          ty: "gr",
          nm: "ring",
          it: [
            {
              ty: "el",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [340, 340] },
              nm: "Ellipse",
            },
            {
              ty: "st",
              c: { a: 0, k: [...BLUE, 1] },
              o: { a: 0, k: 40 },
              w: { a: 0, k: 3 },
              lc: 2,
              lj: 2,
              nm: "Stroke",
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: "Transform",
            },
          ],
        },
      ],
      scale: kf1(48, [70, 70, 100], 75, [100, 100, 100]),
      opacity: [
        {
          t: 48,
          s: [0],
          i: { x: [0.5], y: [1] },
          o: { x: [0.5], y: [0] },
        },
        {
          t: 62,
          s: [80],
          i: { x: [0.5], y: [1] },
          o: { x: [0.5], y: [0] },
        },
        { t: 90, s: [40] },
      ],
    }),
  ],
};

export default define({
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "4s",
    fonts: ["Inter:wght@400;600;700"],
  },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const t = ctx.director({ enter: "85%", hold: "15%" });
    // Scrub the whole mark on enter, freeze final pose on hold
    const progress = t.in("enter") < 1 ? t.in("enter") : 1;

    const logo = std.viz.lottie({
      animationData: LOGO_LOTTIE,
      progress,
      width: 560,
      height: 560,
      player: "light",
      background: "transparent",
    });

    return `
<div style="position:relative;width:${width}px;height:${height}px;background:#06060f;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif">
  <div style="position:absolute;top:72px;left:0;right:0;text-align:center;color:#f0f4ff;pointer-events:none">
    <div style="font-size:22px;font-weight:600;letter-spacing:6px;color:#5b8cff">LOTTIE</div>
    <div style="font-size:40px;font-weight:700;margin-top:8px">Logo mark reveal</div>
  </div>
  ${logo}
  <div style="position:absolute;bottom:48px;left:0;right:0;text-align:center;color:#6b7795;font-size:18px;opacity:${t.in("hold").toFixed(3)}">
    tile + staggered bars + accent · seek ${progress.toFixed(2)} · ${timeline.seconds.toFixed(2)}s
  </div>
</div>`;
  },
});
