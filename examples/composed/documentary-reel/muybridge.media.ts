// Chapter II — Muybridge. Cameras trip in sequence along a track, and for the
// first time motion is held still enough to be counted.
import { video, Html, googleFont } from "@foxworth/superimg";
import {
  AMBER,
  BONE,
  DUST,
  caption,
  clamp,
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
const FRAMES = 12;
const SCRIPT = SCRIPTS.ch2;

const STRIP_TOP = 386;
const STRIP_H = 236;

/** One exposure: a plate border, its number, and the pose it caught. */
function plate(
  i: number,
  x: number,
  w: number,
  appear: number,
  lit: number,
): string {
  const s = (STRIP_H - 46) / 190;
  const figX = (w - 110 * s) / 2;
  const border = 0.14 + 0.5 * lit;

  return `<g opacity="${appear.toFixed(3)}">
    <rect x="${x.toFixed(1)}" y="${STRIP_TOP}" width="${w.toFixed(1)}" height="${STRIP_H}"
      fill="${lit > 0.02 ? "rgba(226,166,74,0.05)" : "none"}"
      stroke="${lit > 0.5 ? AMBER : BONE}" stroke-width="1" opacity="${border.toFixed(3)}"/>
    <g transform="translate(${(x + figX).toFixed(1)},${STRIP_TOP + 30})">
      ${runner({
        phase: i / FRAMES,
        scale: s,
        color: lit > 0.5 ? AMBER : BONE,
        width: 5,
        opacity: 0.34 + 0.66 * lit,
      })}
    </g>
    <text x="${(x + w / 2).toFixed(1)}" y="${STRIP_TOP + STRIP_H + 26}" text-anchor="middle"
      font-family="Inter, sans-serif" font-size="14" letter-spacing="2"
      fill="${lit > 0.5 ? AMBER : DUST}" opacity="${(0.45 + 0.55 * lit).toFixed(3)}">${String(i + 1).padStart(2, "0")}</text>
  </g>`;
}

/** The track: one tripwire per camera, lighting as its exposure fires. */
function track(width: number, cellW: number, gap: number, litIndex: number, op: number): string {
  if (op <= 0.004) return "";
  const y = STRIP_TOP + STRIP_H + 92;
  const ticks: string[] = [];
  for (let i = 0; i < FRAMES; i++) {
    const x = AXIS + i * (cellW + gap) + cellW / 2;
    const on = i === litIndex;
    ticks.push(
      `<line x1="${x.toFixed(1)}" y1="${y - 13}" x2="${x.toFixed(1)}" y2="${y + 13}" stroke="${on ? AMBER : BONE}" stroke-width="${on ? 2.5 : 1}" opacity="${on ? 0.95 : 0.28}"/>`,
    );
  }
  return `<g opacity="${op.toFixed(3)}">
    <line x1="${AXIS}" y1="${y}" x2="${width - AXIS}" y2="${y}" stroke="${BONE}" stroke-width="1" opacity="0.2"/>
    ${ticks.join("")}
  </g>`;
}

export default video({
  duration: "10s",
  fonts: [googleFont("Fraunces:wght@400;600"), googleFont("Inter:wght@400;500;600"), googleFont("JetBrains+Mono:wght@500")],
  inlineCss: [
    `* { margin: 0; padding: 0; box-sizing: border-box; }
     body { font-family: Inter, system-ui, sans-serif; overflow: hidden; }`,
  ],
  audio: { clips: [voiceClip(SCRIPT)] },
  sample: {
    chapter: "CHAPTER II",
    year: "1878",
    heading: "Animal Locomotion",
    kicker: "PLATE 62 · MAN RUNNING",
    words: SCRIPT.words,
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({ plate: "12%", fire: "30%", study: "14%", play: "28%", rest: "16%" });

    const plateP = t.in("plate");
    const headP = std.interpolate(plateP, [0.15, 1], [0, 1], "easeOutCubic");
    const kickP = std.interpolate(t.in("fire"), [0, 0.25], [0, 1], "easeOutCubic");

    const fireP = std.interpolate(t.in("fire"), [0, 1], [0, 1], "easeInOutCubic");
    const firing = t.in("fire") > 0 && t.in("fire") < 1;

    // Exposures trip in order; during playback a single frame is lit at a time.
    const playP = t.in("play");
    const playing = playP > 0;
    // Two passes over the strip, accelerating as the eye learns the cycle.
    const sweep = std.interpolate(playP, [0, 1], [0, 1], "easeInCubic");
    const playIndex = playing ? Math.floor(sweep * FRAMES * 2) % FRAMES : -1;

    const gap = 8;
    const cellW = (width - AXIS * 2 - gap * (FRAMES - 1)) / FRAMES;

    const plates: string[] = [];
    for (let i = 0; i < FRAMES; i++) {
      const appear = clamp(fireP * FRAMES - i);
      if (appear <= 0.01) continue;
      const x = AXIS + i * (cellW + gap);
      // While firing, the newest exposure is the hot one.
      const lit = playing
        ? i === playIndex
          ? 1
          : 0
        : firing
          ? clamp(1 - (fireP * FRAMES - i)) * 0.9
          : 0;
      plates.push(plate(i, x, cellW, appear, lit));
    }

    const trackIndex = playing ? playIndex : firing ? Math.floor(fireP * FRAMES) : -1;
    const words = ctx.track({ id: "ch2-voice", words: data.words }).transcript().all();
    const capOp = std.interpolate(t.in("fire"), [0.15, 0.6], [0, 1], "easeOutCubic");

    return Html({ width: "fill", height: "fill", html: `
<div style="${std.css({ width, height, background: ground(), position: "relative", overflow: "hidden" })}">
  <div style="position:absolute;inset:0;transform:${gateWeave(timeline.frame)}">
    ${sprockets(height, width, timeline.seconds * 1.6)}
    ${slate({ width, height, chapter: data.chapter, year: data.year, ruleP: plateP, op: plateP })}

    <div style="position:absolute;left:${AXIS}px;top:186px;width:900px">
      ${revealLine(
        `<p style="font-family:Fraunces,Georgia,serif;font-size:86px;font-weight:600;color:${BONE};line-height:1.04;letter-spacing:-0.025em">${std.text.escapeHtml(data.heading)}</p>`,
        headP,
        100,
      )}
      <p style="margin-top:20px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:17px;letter-spacing:0.26em;color:${AMBER};opacity:0.8;${rise(kickP, 12)}">${std.text.escapeHtml(data.kicker)}</p>
    </div>

    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="position:absolute;inset:0">
      ${plates.join("")}
      ${track(width, cellW, gap, trackIndex, std.interpolate(t.in("fire"), [0, 0.3], [0, 1], "easeOutCubic"))}
    </svg>

    ${caption(words, capOp)}
    ${vignette()}
    ${grain(width, height, (timeline.frame % 5) + 1)}
  </div>
</div>` });
  },
});
