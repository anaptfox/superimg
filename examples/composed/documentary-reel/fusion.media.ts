// Chapter III — the threshold. One figure, sampled faster and faster, until the
// eye stops counting pictures and calls it motion.
import { video, Html, googleFont } from "@foxworth/superimg";
import {
  AMBER,
  BONE,
  DUST,
  RUST,
  caption,
  gateWeave,
  grain,
  ground,
  revealLine,
  rise,
  runner,
  slate,
  SCRIPTS,
  sprockets,
  vignette,
  voiceClip,
} from "./reel.js";

const AXIS = 176;
const SCRIPT = SCRIPTS.ch3;

/** Strides per second — the figure's own tempo, independent of sampling rate. */
const STRIDE_RATE = 1.15;
const THRESHOLD = 16;

/** One tick per exposure in the current second; the live one is lit. */
function exposures(cx: number, y: number, rate: number, seconds: number, op: number): string {
  if (op <= 0.004) return "";
  const n = Math.max(2, Math.round(rate));
  const pitch = Math.min(26, 620 / n);
  const span = (n - 1) * pitch;
  const live = Math.floor((seconds * rate) % n);
  const ticks: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = cx - span / 2 + i * pitch;
    const on = i === live;
    ticks.push(
      `<line x1="${x.toFixed(1)}" y1="${y - (on ? 16 : 9)}" x2="${x.toFixed(1)}" y2="${y + (on ? 16 : 9)}" stroke="${on ? AMBER : BONE}" stroke-width="${on ? 3 : 1.5}" opacity="${on ? 0.95 : 0.3}"/>`,
    );
  }
  return `<g opacity="${op.toFixed(3)}">${ticks.join("")}</g>`;
}

export default video({
  duration: "10s",
  fonts: [googleFont("Fraunces:wght@400;600"), googleFont("Inter:wght@400;500;600"), googleFont("JetBrains+Mono:wght@500;700")],
  inlineCss: [
    `* { margin: 0; padding: 0; box-sizing: border-box; }
     body { font-family: Inter, system-ui, sans-serif; overflow: hidden; }`,
  ],
  audio: { clips: [voiceClip(SCRIPT)] },
  sample: {
    chapter: "CHAPTER III",
    year: "THE THRESHOLD",
    heading: "Sixteen a Second",
    words: SCRIPT.words,
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({ plate: "12%", slow: "20%", climb: "40%", fused: "28%" });

    const plateP = t.in("plate");
    const headP = std.interpolate(plateP, [0.15, 1], [0, 1], "easeOutCubic");

    // Sampling rate is the chapter's one variable: 3 fps, then a climb to 24.
    const climbP = std.interpolate(t.in("climb"), [0, 1], [0, 1], "easeInOutCubic");
    const rate =
      t.in("slow") > 0 && t.in("climb") <= 0
        ? 3
        : std.interpolate(climbP, [0, 1], [3, 24], "linear");
    const live = t.in("slow") > 0;

    // Quantise time to the sampling rate — this is the whole chapter in one line.
    const sampled = live ? Math.floor(timeline.seconds * rate) / rate : 0;
    const phase = sampled * STRIDE_RATE;

    const fused = rate >= THRESHOLD;
    const readout = Math.round(rate);
    // The figure's ink spans roughly 12–149 in nominal units, not the full 190.
    const figScale = 3;
    const figX = 1245 - (110 * figScale) / 2;
    const figY = 226;
    const footY = figY + 149 * figScale;

    const bodyP = std.interpolate(t.in("slow"), [0, 0.5], [0, 1], "easeOutCubic");
    const words = ctx.track({ id: "ch3-voice", words: data.words }).transcript().all();
    const capOp = std.interpolate(t.in("slow"), [0.2, 0.7], [0, 1], "easeOutCubic");

    return Html({ width: "fill", height: "fill", html: `
<div style="${std.css({ width, height, background: ground(), position: "relative", overflow: "hidden" })}">
  <div style="position:absolute;inset:0;transform:${gateWeave(timeline.frame)}">
    ${sprockets(height, width, timeline.seconds * 1.6)}
    ${slate({ width, height, chapter: data.chapter, year: data.year, ruleP: plateP, op: plateP })}

    <div style="position:absolute;left:${AXIS}px;top:210px;width:850px">
      ${revealLine(
        `<p style="font-family:Fraunces,Georgia,serif;font-size:88px;font-weight:600;color:${BONE};line-height:1.04;letter-spacing:-0.025em">${std.text.escapeHtml(data.heading)}</p>`,
        headP,
        104,
      )}

      <div style="margin-top:56px;${rise(bodyP, 18)}">
        <p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:132px;font-weight:700;line-height:1;color:${fused ? AMBER : RUST};letter-spacing:-0.03em">${readout}</p>
        <p style="margin-top:14px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:19px;letter-spacing:0.3em;color:${DUST}">FRAMES PER SECOND</p>
        <p style="margin-top:26px;font-size:24px;letter-spacing:0.04em;color:${fused ? AMBER : DUST};opacity:${fused ? 0.95 : 0.7}">${fused ? "The eye sees motion." : "The eye sees pictures."}</p>
      </div>
    </div>

    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="position:absolute;inset:0">
      <g transform="translate(${figX.toFixed(1)},${figY})" opacity="${bodyP.toFixed(3)}">
        ${runner({ phase, scale: figScale, color: BONE, width: 4.2 })}
      </g>
      ${exposures(1245, footY + 62, rate, timeline.seconds, bodyP)}
    </svg>

    ${caption(words, capOp)}
    ${vignette()}
    ${grain(width, height, (timeline.frame % 5) + 1)}
  </div>
</div>` });
  },
});
