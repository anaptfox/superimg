import { defineScene } from "superimg";

/**
 * Fourier Series — a chain of rotating circles (epicycles) whose tip traces
 * out a square wave. The classic 3Blue1Brown "wow" moment.
 *
 * Phases (tracker windows):
 *   intro  — title + equation fade in
 *   grid   — coordinate grid + axes draw on
 *   circles— epicycle chain appears, growing from center
 *   spin   — circles rotate, pen drops, wave begins tracing
 *   reveal — wave fully drawn, equation pulses
 *   hold   — everything settles, glow
 */

const ACCENT = "#4a9eff"; // the one accent color: electric blue
const TRACE = "#ffd24a"; // warm gold for the traced wave (high contrast on blue)
const DIM = "#2a3550";

// Number of harmonics in the square-wave Fourier sum.
const HARMONICS = 6;
// How many full rotations the system performs during the spin phase.
const REVOLUTIONS = 1;

// Square wave Fourier coefficients: only odd harmonics, amplitude 4/(nπ).
function harmonics() {
  const list: { n: number; amp: number }[] = [];
  for (let k = 0; k < HARMONICS; k++) {
    const n = 2 * k + 1; // 1, 3, 5, ...
    list.push({ n, amp: 4 / (n * Math.PI) });
  }
  return list;
}

export default defineScene({
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 11,
    fonts: ["Inter:wght@400;600;800"],
    inlineCss: [
      "* { margin: 0; box-sizing: border-box; }",
      "body { background: #0a0a0f; font-family: Inter, system-ui, sans-serif; overflow: hidden; }",
    ],
  },

  render(ctx) {
    const { std, width, height, sceneProgress } = ctx;
    const viz = std.viz;

    const t = viz.tracker(sceneProgress, {
      intro: [0.0, 0.18],
      grid: [0.08, 0.3],
      circles: [0.22, 0.42],
      spin: [0.38, 0.86],
      reveal: [0.72, 0.92],
      hold: [0.9, 1.0],
    });

    // --- Layout: epicycle drawing on the left, wave trace on the right ---
    // Circles are anchored around (cx, cy) in pixel space.
    const cx = width * 0.27;
    const cy = height * 0.52;
    const unit = 150; // pixels per amplitude unit

    // Coordinate system for the wave on the right half.
    const coords = viz.createCoords({
      width,
      height,
      xRange: [0, 4 * Math.PI],
      yRange: [-1.6, 1.6],
      padding: { top: 220, bottom: 220, left: width * 0.45, right: 90 },
    });

    const hs = harmonics();

    // Rotation angle of the fundamental circle.
    const theta = t.spin * REVOLUTIONS * 2 * Math.PI;

    // --- Build the epicycle chain (pixel space) ---
    let px = cx;
    let py = cy;
    const circleEls: string[] = [];
    const radiusEls: string[] = [];

    // Stagger circle appearance so the chain "grows" outward.
    const grow = t.circles;

    hs.forEach((h, i) => {
      const r = h.amp * unit;
      // Each circle fades/scales in slightly after the previous one.
      const localStart = i / hs.length;
      const localProg = std.math.clamp((grow - localStart * 0.6) / 0.4, 0, 1);
      const eased = std.interpolate(localProg, [0, 1], [0, 1], "easeOutCubic");

      const nextX = px + Math.cos(h.n * theta) * r * eased;
      const nextY = py - Math.sin(h.n * theta) * r * eased;

      // Circle outline
      const cOpacity = 0.18 + 0.22 * eased;
      circleEls.push(
        `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${(r * eased).toFixed(2)}" ` +
          `fill="none" stroke="${ACCENT}" stroke-width="1.5" opacity="${cOpacity.toFixed(3)}"/>`
      );
      // Radius arm
      radiusEls.push(
        `<line x1="${px.toFixed(2)}" y1="${py.toFixed(2)}" x2="${nextX.toFixed(2)}" y2="${nextY.toFixed(2)}" ` +
          `stroke="${ACCENT}" stroke-width="2" opacity="${(0.5 * eased).toFixed(3)}"/>` +
          `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="3.5" fill="${ACCENT}" opacity="${(0.7 * eased).toFixed(3)}"/>`
      );

      px = nextX;
      py = nextY;
    });

    // The pen tip after the full chain.
    const tipX = px;
    const tipY = py;
    // The math y-value the tip represents (in coords units).
    const tipMathY = (cy - tipY) / unit;

    // --- The traced wave (gold) ---
    // x-position in math coords corresponds to elapsed angle.
    // We trace from x=0 up to the current angle so the pen "writes" the curve.
    const tMax = t.spin * REVOLUTIONS * 4 * Math.PI; // matches xRange span over one rev
    const waveColor = TRACE;

    let waveEl = "";
    let connectorEl = "";
    let penEl = "";
    if (t.spin > 0.001) {
      // Partial Fourier square wave as a function of phase a (radians).
      const fourier = (a: number) => {
        let s = 0;
        for (const h of hs) s += h.amp * Math.sin(h.n * a);
        return s;
      };
      // Build path from x=0 to current tMax. The wave is drawn at the
      // current rotation's far edge so it appears to scroll out of the gears.
      const samples = 260;
      const parts: string[] = [];
      for (let i = 0; i <= samples; i++) {
        const a = (i / samples) * tMax;
        const y = fourier(a);
        const { px: wx, py: wy } = coords.toPixel(a, y);
        parts.push(`${i === 0 ? "M" : "L"} ${wx.toFixed(2)} ${wy.toFixed(2)}`);
      }
      waveEl = `<path d="${parts.join(" ")}" fill="none" stroke="${waveColor}" stroke-width="3.5" stroke-linecap="round" opacity="0.95"/>`;

      // Connector line from the spinning tip to where the wave begins (x=0 edge).
      const { px: startX, py: startY } = coords.toPixel(tMax, tipMathY);
      connectorEl =
        `<line x1="${tipX.toFixed(2)}" y1="${tipY.toFixed(2)}" x2="${startX.toFixed(2)}" y2="${startY.toFixed(2)}" ` +
        `stroke="${std.color.alpha(waveColor, 0.4)}" stroke-width="1.5" stroke-dasharray="4 5"/>`;
      // Glowing pen heads at both ends.
      penEl =
        `<circle cx="${tipX.toFixed(2)}" cy="${tipY.toFixed(2)}" r="6" fill="${waveColor}"/>` +
        `<circle cx="${tipX.toFixed(2)}" cy="${tipY.toFixed(2)}" r="13" fill="none" stroke="${waveColor}" stroke-width="1" opacity="0.4"/>` +
        `<circle cx="${startX.toFixed(2)}" cy="${startY.toFixed(2)}" r="5.5" fill="${waveColor}"/>`;
    }

    // --- Grid + axes (subtle, behind everything on the wave side) ---
    const gridEl = viz.grid(coords, { color: DIM, progress: t.grid });
    const axesEl = viz.axes(coords, {
      color: "#46506a",
      tickInterval: Math.PI,
      progress: t.grid,
    });

    // Faint target square-wave outline (where the trace is heading).
    const ghostParts: string[] = [];
    {
      const samples = 200;
      let pen = false;
      for (let i = 0; i <= samples; i++) {
        const a = (i / samples) * (4 * Math.PI);
        const y = a % (2 * Math.PI) < Math.PI ? 1 : -1;
        const { px: gx, py: gy } = coords.toPixel(a, y);
        ghostParts.push(`${pen ? "L" : "M"} ${gx.toFixed(2)} ${gy.toFixed(2)}`);
        pen = true;
      }
    }
    const ghostEl = `<path d="${ghostParts.join(" ")}" fill="none" stroke="${std.color.alpha(
      "#ffffff",
      0.08
    )}" stroke-width="2" opacity="${(0.6 * t.spin).toFixed(3)}"/>`;

    // --- Text + equation ---
    const titleOpacity = t.intro;
    const titleY = std.interpolate(t.intro, [0, 1], [30, 0], "easeOutCubic");

    const eqPulse = 1 + 0.05 * Math.sin(sceneProgress * Math.PI * 2) * t.reveal;
    const eq = viz.katex.equation(
      "f(x)=\\frac{4}{\\pi}\\sum_{k=0}^{\\infty}\\frac{\\sin((2k+1)x)}{2k+1}",
      { displayMode: true, fontSize: 40, color: "#eef2ff", progress: std.math.clamp(t.intro * 1.4, 0, 1) }
    );

    // Subtle vignette glow that intensifies on hold.
    const glow = 0.15 + 0.25 * t.hold;

    return `
      <div style="position:relative;width:${width}px;height:${height}px;background:radial-gradient(circle at 50% 45%, #12182a 0%, #0a0a0f 70%);overflow:hidden;">
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 27% 52%, ${std.color.alpha(
          ACCENT,
          glow
        )} 0%, transparent 38%);"></div>

        <svg width="${width}" height="${height}" style="position:absolute;inset:0;">
          ${gridEl}
          ${axesEl}
          ${ghostEl}
          ${waveEl}
          ${connectorEl}
          ${circleEls.join("\n")}
          ${radiusEls.join("\n")}
          ${penEl}
        </svg>

        <div style="position:absolute;top:64px;left:90px;opacity:${titleOpacity};transform:translateY(${titleY}px);">
          <div style="font-size:26px;font-weight:600;letter-spacing:6px;color:${ACCENT};text-transform:uppercase;">Fourier Series</div>
          <div style="font-size:54px;font-weight:800;color:#f5f7ff;margin-top:6px;line-height:1.05;">Circles that<br/>draw a square wave</div>
        </div>

        <div style="position:absolute;bottom:70px;left:50%;transform:translateX(-50%) scale(${eqPulse.toFixed(
          3
        )});text-align:center;">
          ${eq}
        </div>

        <div style="position:absolute;bottom:38px;left:50%;transform:translateX(-50%);font-size:18px;color:#6b7795;letter-spacing:2px;opacity:${(
          0.8 * t.reveal
        ).toFixed(3)};">
          ${HARMONICS} rotating terms &middot; tip traces the partial sum
        </div>
      </div>
    `;
  },
});
