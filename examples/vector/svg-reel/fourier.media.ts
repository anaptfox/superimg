import { define } from "superimg";

const ACCENT = "#4a9eff";
const TRACE = "#ffc857";
const DIM = "#1e2640";
const HARMONICS = 7;
const REVOLUTIONS = 1.2;

function harmonics() {
  const list: { n: number; amp: number }[] = [];
  for (let k = 0; k < HARMONICS; k++) {
    const n = 2 * k + 1;
    list.push({ n, amp: 4 / (n * Math.PI) });
  }
  return list;
}

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "7s",
    fonts: ["Inter:wght@600;800"],
  },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const viz = std.viz;

    const t = viz.tracker(timeline.progress, {
      intro: [0.0, 0.15],
      grid: [0.05, 0.25],
      circles: [0.18, 0.38],
      spin: [0.32, 0.88],
      reveal: [0.75, 0.95],
    });

    const cx = width * 0.28;
    const cy = height * 0.52;
    const unit = 140;
    const hs = harmonics();
    const theta = t.spin * REVOLUTIONS * 2 * Math.PI;

    const coords = viz.createCoords({
      width,
      height,
      xRange: [0, 4 * Math.PI],
      yRange: [-1.6, 1.6],
      padding: { top: 200, bottom: 200, left: width * 0.46, right: 80 },
    });

    let px = cx;
    let py = cy;
    const circleEls: string[] = [];
    const radiusEls: string[] = [];
    const grow = t.circles;

    hs.forEach((h, i) => {
      const r = h.amp * unit;
      const localStart = i / hs.length;
      const localProg = std.math.clamp((grow - localStart * 0.55) / 0.45, 0, 1);
      const eased = std.interpolate(localProg, [0, 1], [0, 1], "easeOutCubic");
      const nextX = px + Math.cos(h.n * theta) * r * eased;
      const nextY = py - Math.sin(h.n * theta) * r * eased;
      circleEls.push(
        `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${(r * eased).toFixed(2)}" fill="none" stroke="${ACCENT}" stroke-width="1.5" opacity="${(0.2 + 0.25 * eased).toFixed(3)}"/>`,
      );
      radiusEls.push(
        `<line x1="${px.toFixed(2)}" y1="${py.toFixed(2)}" x2="${nextX.toFixed(2)}" y2="${nextY.toFixed(2)}" stroke="${ACCENT}" stroke-width="2" opacity="${(0.55 * eased).toFixed(3)}"/>` +
          `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="3.5" fill="${ACCENT}" opacity="${(0.75 * eased).toFixed(3)}"/>`,
      );
      px = nextX;
      py = nextY;
    });

    const tipX = px;
    const tipY = py;
    const tipMathY = (cy - tipY) / unit;

    let waveEl = "";
    let connectorEl = "";
    let penEl = "";
    if (t.spin > 0.001) {
      const fourier = (a: number) => {
        let s = 0;
        for (const h of hs) s += h.amp * Math.sin(h.n * a);
        return s;
      };
      const tMax = t.spin * REVOLUTIONS * 4 * Math.PI;
      const samples = 280;
      const parts: string[] = [];
      for (let i = 0; i <= samples; i++) {
        const a = (i / samples) * tMax;
        const y = fourier(a);
        const { px: wx, py: wy } = coords.toPixel(a, y);
        parts.push(`${i === 0 ? "M" : "L"} ${wx.toFixed(2)} ${wy.toFixed(2)}`);
      }
      waveEl = `<path d="${parts.join(" ")}" fill="none" stroke="${TRACE}" stroke-width="3.5" stroke-linecap="round"/>`;
      const { px: startX, py: startY } = coords.toPixel(tMax, tipMathY);
      connectorEl =
        `<line x1="${tipX.toFixed(2)}" y1="${tipY.toFixed(2)}" x2="${startX.toFixed(2)}" y2="${startY.toFixed(2)}" stroke="${std.color.alpha(TRACE, 0.35)}" stroke-width="1.5" stroke-dasharray="5 6"/>`;
      penEl =
        `<circle cx="${tipX.toFixed(2)}" cy="${tipY.toFixed(2)}" r="7" fill="${TRACE}"/>` +
        `<circle cx="${tipX.toFixed(2)}" cy="${tipY.toFixed(2)}" r="14" fill="none" stroke="${TRACE}" stroke-width="1" opacity="0.45"/>`;
    }

    const piTick = (v: number) => {
      const k = Math.round(v / Math.PI);
      if (Math.abs(v - k * Math.PI) < 0.15) return k === 0 ? "0" : k === 1 ? "π" : `${k}π`;
      return v.toFixed(1);
    };
    const gridEl = viz.grid(coords, { color: DIM, ticks: 4, progress: t.grid });
    const axesEl = viz.axes(coords, { color: "#3d4a68", ticks: 4, tickFormat: piTick, progress: t.grid });

    const titleOp = t.intro;
    const captionOp = 0.85 * t.reveal;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="fGlow" cx="28%" cy="52%" r="40%">
      <stop offset="0%" stop-color="${std.color.alpha(ACCENT, 0.18)}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#080810"/>
  <rect width="${width}" height="${height}" fill="url(#fGlow)"/>
  ${gridEl}
  ${axesEl}
  ${waveEl}
  ${connectorEl}
  ${circleEls.join("\n")}
  ${radiusEls.join("\n")}
  ${penEl}
  <text x="90" y="100" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="${ACCENT}" letter-spacing="6" opacity="${titleOp.toFixed(3)}">FOURIER EPICYCLES</text>
  <text x="90" y="155" font-family="Inter,sans-serif" font-size="48" font-weight="800" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Circles draw a square wave</text>
  <text x="${width / 2}" y="${height - 48}" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" fill="#6b7795" letter-spacing="3" opacity="${captionOp.toFixed(3)}">${HARMONICS} harmonics · tip traces the partial sum</text>
</svg>`;
  },
});