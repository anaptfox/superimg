/**
 * Derivative of sine — pedagogical explainer
 *
 * Lesson: the derivative of sin x is cos x
 * (slope of the sine wave is the cosine wave).
 *
 * APIs in service of the story:
 * director phases · plot progress · equationSteps/Match ·
 * indicate · camera.autoZoom · dual curves
 */
import { define } from "superimg";

/**
 * Percent phases (sum 100%) so director is robust for full video + single-frame stills.
 * At duration 12s: ~1.2 / 1.8 / 1.3 / 1.8 / 1.0 / 1.2 / 1.8 / 1.9s holds.
 */
const PHASES = {
  axes: "10%",
  curve: "15%",
  name: "11%",
  peak: "15%",
  zoom: "8%",
  match: "10%",
  cos: "15%",
  hold: "16%",
} as const;

export default define({
  sample: {
    title: "Derivative of sine",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 12,
    background: "#0b1020",
    fonts: ["IBM+Plex+Sans:wght@400;600"],
    inlineCss: [
      `* { margin: 0; box-sizing: border-box; }`,
      `body { font-family: "IBM Plex Sans", system-ui, sans-serif; background: #0b1020; overflow: hidden; }`,
    ],
  },
  render(ctx) {
    const { std, width, height } = ctx;
    const t = ctx.director(PHASES);

    const coords = std.viz.createCoords({
      width,
      height,
      xRange: [-Math.PI * 1.15, Math.PI * 1.15],
      yRange: [-1.55, 1.55],
      padding: { top: 100, right: 100, bottom: 150, left: 120 },
    });

    // Phase locals
    const axesP = t.in("axes");
    const curveP = t.in("curve");
    const nameP = t.in("name");
    const peakP = t.in("peak");
    const zoomP = t.in("zoom");
    const matchP = t.in("match");
    const cosP = t.in("cos");
    const holdP = t.in("hold");

    // Peak of sin at π/2
    const peakX = Math.PI / 2;
    const peakY = 1;
    const peakPx = coords.toPixel(peakX, peakY);

    // Camera: idle → zoom to peak → ease back for dual-curve overview
    let camProgress = 0;
    if (peakP > 0 || zoomP > 0) {
      // ease in during peak/zoom
      camProgress = std.interpolate(
        Math.max(peakP * 0.35, zoomP),
        [0, 1],
        [0, 1],
        "easeInOutCubic",
      );
    }
    if (cosP > 0 || holdP > 0) {
      // pull back to ~0.25 so both curves fit
      const back = std.interpolate(Math.max(cosP, holdP), [0, 1], [1, 0.22], "easeInOutCubic");
      camProgress = back;
    }
    const peakBox = {
      x: peakPx.px - 160,
      y: peakPx.py - 140,
      width: 320,
      height: 280,
    };
    const cam = std.viz.camera.autoZoom({
      width,
      height,
      rects: [peakBox],
      progress: camProgress,
      margin: 0.18,
    });

    // --- graphics (one focal mover per beat) ---
    const grid = std.viz.grid(coords, {
      color: "#1e293b",
      progress: Math.max(axesP, 0.001),
    });
    const axes = std.viz.axes(coords, {
      color: "#64748b",
      progress: Math.max(axesP, 0.001),
      labels: true,
    });

    // Sin: full opacity until cos appears, then dim
    const sinOp =
      cosP > 0 || holdP > 0
        ? 0.32 + 0.08 * (1 - Math.max(cosP, holdP))
        : 1;
    const sine = std.viz.plot(coords, (x) => Math.sin(x), {
      color: "#38bdf8",
      strokeWidth: 3.5,
      progress: curveP >= 1 ? 1 : curveP,
    });
    // Wrap sin in opacity group via string — plot returns path; use g
    const sineG = `<g opacity="${sinOp.toFixed(3)}">${sine}</g>`;

    // Cos only after match starts (equation and graph stay in sync)
    const cosReveal = cosP > 0 || holdP > 0 ? (holdP > 0 ? 1 : cosP) : 0;
    const cosine =
      cosReveal > 0
        ? std.viz.plot(coords, (x) => Math.cos(x), {
            color: "#f472b6",
            strokeWidth: 3.5,
            progress: cosReveal,
          })
        : "";

    // Peak marker: only once curve has essentially finished
    const peakShow = curveP >= 0.92 ? Math.min(1, (curveP - 0.92) / 0.08 + peakP) : 0;
    const peak = peakShow > 0
      ? std.viz.point(coords, peakX, peakY, {
          color: "#fbbf24",
          radius: 8,
          label: "max",
          progress: Math.min(1, peakShow),
        })
      : "";

    // Horizontal tangent (slope = 0 at peak) during peak/zoom; fade on match→cos
    const tanP =
      peakP > 0
        ? std.interpolate(peakP, [0, 0.35], [0, 1], "easeOutCubic")
        : zoomP > 0
          ? 1
          : matchP > 0
            ? 1 - matchP
            : 0;
    let tangent = "";
    if (tanP > 0.02) {
      const left = coords.toPixel(peakX - 0.85, peakY);
      const right = coords.toPixel(peakX + 0.85, peakY);
      const len = Math.hypot(right.px - left.px, right.py - left.py);
      const dash =
        tanP < 1
          ? `stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${(len * (1 - tanP)).toFixed(1)}"`
          : "";
      tangent = `<line x1="${left.px}" y1="${left.py}" x2="${right.px}" y2="${right.py}"
        stroke="#fbbf24" stroke-width="3" stroke-linecap="round" opacity="${(0.95 * tanP).toFixed(3)}" ${dash}/>`;
    }

    const peakRing =
      peakP > 0.15 || zoomP > 0
        ? std.viz.indicate.circle(
            { x: peakPx.px - 48, y: peakPx.py - 48, width: 96, height: 96 },
            peakP > 0
              ? std.interpolate(peakP, [0.15, 0.55], [0, 1], "easeOutCubic")
              : zoomP > 0
                ? 0.7
                : matchP > 0
                  ? Math.max(0, 0.5 - matchP)
                  : 0,
            { color: "#fbbf24", strokeWidth: 2.5 },
          )
        : "";

    // Equations — name hold fully settled; match only after peak story
    let eqHtml = "";
    if (nameP > 0 && matchP <= 0) {
      eqHtml = std.viz.equationSteps("f(x) = {{\\sin x}}", {
        progress: nameP >= 1 ? 1 : nameP,
        lag: 0.28,
        displayMode: true,
        fontSize: 44,
        color: "#f8fafc",
      });
    } else if (matchP > 0 && cosP <= 0) {
      eqHtml = std.viz.equationMatch(
        "f(x) = {{\\sin x}}",
        "f'(x) = {{\\cos x}}",
        matchP,
        { displayMode: true, fontSize: 44, color: "#f8fafc" },
      );
    } else if (cosP > 0 || holdP > 0) {
      eqHtml = std.viz.equation("f'(x) = \\cos x", {
        displayMode: true,
        fontSize: 44,
        color: "#f8fafc",
        progress: 1,
      });
    }

    // Slope callout as HTML (readable)
    const showSlopeNote =
      (peakP > 0.45 || zoomP > 0) && matchP < 0.5;
    const slopeNoteOp = showSlopeNote
      ? peakP > 0.45
        ? std.interpolate(peakP, [0.45, 0.7], [0, 1], "easeOutCubic")
        : 1 - matchP * 2
      : 0;

    const titleOp = std.interpolate(axesP, [0, 0.5], [0, 1], "easeOutCubic");

    // Legend when cos visible
    const legendOp = cosReveal > 0.3 ? std.interpolate(cosReveal, [0.3, 0.6], [0, 1], "easeOutCubic") : 0;

    return `
      <div style="${std.css({
        width,
        height,
        position: "relative",
        overflow: "hidden",
        background: "#0b1020",
      })}">
        <div style="${cam.style};width:${width}px;height:${height}px">
          <svg width="${width}" height="${height}" style="position:absolute;inset:0">
            ${grid}
            ${axes}
            ${sineG}
            ${cosine}
            ${tangent}
            ${peak}
            ${peakRing}
          </svg>

          <div style="position:absolute;top:40px;left:0;right:0;text-align:center;opacity:${titleOp};color:#94a3b8;font-size:17px;letter-spacing:0.14em;text-transform:uppercase;font-weight:600">
            ${ctx.data.title}
          </div>

          ${
            slopeNoteOp > 0.02
              ? `<div style="position:absolute;left:${peakPx.px + 28}px;top:${peakPx.py - 52}px;opacity:${Math.max(0, slopeNoteOp).toFixed(3)};color:#fde68a;font-size:22px;font-weight:600;white-space:nowrap">
                  slope = 0
                </div>`
              : ""
          }

          ${
            legendOp > 0.02
              ? `<div style="position:absolute;top:96px;right:80px;opacity:${legendOp.toFixed(3)};font-size:16px;line-height:1.7;color:#cbd5e1;text-align:right">
                  <div><span style="color:#38bdf8">—</span> f(x) = sin x</div>
                  <div><span style="color:#f472b6">—</span> f′(x) = cos x</div>
                </div>`
              : ""
          }

          <div style="position:absolute;bottom:64px;left:0;right:0;display:flex;justify-content:center;min-height:64px;align-items:center">
            ${eqHtml}
          </div>
        </div>
      </div>
    `;
  },
});
