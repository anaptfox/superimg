// Chapter I — the zoetrope. Twelve drawings curled into a drum; the one passing
// the viewing slot is the only one your eye is given.
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
const CELLS = 12;
const SCRIPT = SCRIPTS.ch1;

/** The drum: twelve figures on the inner wall, plus a slotted rim. */
function drum(cx: number, cy: number, spin: number, build: number, lit: number): string {
  const rRim = 368;
  const rFeet = 352;
  const s = 0.94;
  const spinDeg = spin * 360;

  // Exactly one drawing is at the slot — the index whose angle lands on bottom.
  const slotIndex = ((Math.round(-spinDeg / (360 / CELLS)) % CELLS) + CELLS) % CELLS;

  const figures: string[] = [];
  for (let i = 0; i < CELLS; i++) {
    const appear = clamp(build * CELLS - i);
    if (appear <= 0.01) continue;

    const theta = i * (360 / CELLS) + spinDeg;
    // Distance from the viewing slot at the bottom of the drum.
    const off = Math.abs(((((theta % 360) + 540) % 360) - 180) / 180);
    const atSlot = Math.pow(1 - off, 8);

    figures.push(`<g transform="translate(${cx},${cy}) rotate(${theta.toFixed(2)}) translate(${(-55 * s).toFixed(2)},${(rFeet - 190 * s).toFixed(2)})" opacity="${(appear * (0.32 + 0.68 * atSlot)).toFixed(3)}">
      ${runner({ phase: i / CELLS, scale: s, color: i === slotIndex ? AMBER : BONE, width: 4.8 })}
    </g>`);
  }

  // A dashed circle is the rim: twelve struts, twelve slots, exactly.
  const circumference = 2 * Math.PI * rRim;
  const seg = circumference / CELLS;
  const gap = 26;
  const rimOp = clamp(build * 2) * 0.3;

  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${rRim}" fill="none" stroke="${BONE}" stroke-width="7"
      stroke-dasharray="${(seg - gap).toFixed(2)} ${gap}" opacity="${rimOp.toFixed(3)}"
      transform="rotate(${(-spinDeg).toFixed(2)} ${cx} ${cy})"/>
    ${figures.join("")}
    <g opacity="${lit.toFixed(3)}">
      <line x1="${cx}" y1="${cy + rRim + 20}" x2="${cx}" y2="${cy + rRim + 54}" stroke="${AMBER}" stroke-width="2"/>
      <text x="${cx}" y="${cy + rRim + 82}" text-anchor="middle" font-family="Inter, sans-serif" font-size="15" letter-spacing="5" fill="${AMBER}" opacity="0.85">SLOT</text>
    </g>
  </g>`;
}

export default video({
  duration: "10s",
  fonts: [googleFont("Fraunces:wght@400;600"), googleFont("Inter:wght@400;500;600")],
  inlineCss: [
    `* { margin: 0; padding: 0; box-sizing: border-box; }
     body { font-family: Inter, system-ui, sans-serif; overflow: hidden; }`,
  ],
  // Standalone renders of this chapter carry their own narration; the reel
  // attaches the same clip per scene so it lands on the composed timeline.
  audio: { clips: [voiceClip(SCRIPT)] },
  sample: {
    chapter: "CHAPTER I",
    year: "1834",
    heading: "The Zoetrope",
    body: "A paper band of twelve drawings, spun inside a slotted drum.",
    words: SCRIPT.words,
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({ plate: "14%", build: "26%", spin: "44%", rest: "16%" });

    const plateP = t.in("plate");
    const buildP = std.interpolate(t.in("build"), [0, 0.9], [0, 1], "easeOutCubic");
    const built = t.in("build") >= 1 ? 1 : buildP;

    // The drum only turns once every drawing is on the band.
    const spinP = std.interpolate(t.in("spin"), [0, 1], [0, 1], "easeInOutCubic");
    const spin = spinP * (CELLS - 1) / CELLS;
    const slotLit = std.interpolate(t.in("spin"), [0, 0.16], [0, 1], "easeOutCubic");

    const headP = std.interpolate(plateP, [0.2, 1], [0, 1], "easeOutCubic");
    const bodyP = std.interpolate(t.in("build"), [0, 0.45], [0, 1], "easeOutCubic");

    const words = ctx.track({ id: "ch1-voice", words: data.words }).transcript().all();
    const capOp = std.interpolate(t.in("build"), [0.3, 0.8], [0, 1], "easeOutCubic");

    return Html({ width: "fill", height: "fill", html: `
<div style="${std.css({ width, height, background: ground(), position: "relative", overflow: "hidden" })}">
  <div style="position:absolute;inset:0;transform:${gateWeave(timeline.frame)}">
    ${sprockets(height, width, timeline.seconds * 1.6)}
    ${slate({ width, height, chapter: data.chapter, year: data.year, ruleP: plateP, op: plateP })}

    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="position:absolute;inset:0">
      ${drum(1352, 452, spin, built, slotLit)}
    </svg>

    <div style="position:absolute;left:${AXIS}px;top:250px;width:560px">
      ${revealLine(
        `<p style="font-family:Fraunces,Georgia,serif;font-size:88px;font-weight:600;color:${BONE};line-height:1.04;letter-spacing:-0.025em">${std.text.escapeHtml(data.heading)}</p>`,
        headP,
        104,
      )}
      <p style="margin-top:30px;font-size:28px;line-height:1.58;color:${DUST};${rise(bodyP, 16)}">${std.text.escapeHtml(data.body)}</p>
    </div>

    ${caption(words, capOp)}
    ${vignette()}
    ${grain(width, height, (timeline.frame % 5) + 1)}
  </div>
</div>` });
  },
});
