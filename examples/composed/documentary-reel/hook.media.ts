// Title card. A claim, a cut, then the film's name — struck onto the same film
// stock every later chapter uses.
import { video, Html, googleFont } from "@foxworth/superimg";
import {
  AMBER,
  BONE,
  DUST,
  FILM_TITLE,
  gateWeave,
  grain,
  ground,
  revealLine,
  rise,
  runner,
  sprockets,
  vignette,
} from "./reel.js";

const AXIS = 176;

export default video({
  duration: "8s",
  fonts: [googleFont("Fraunces:wght@400;600"), googleFont("Inter:wght@400;500;600")],
  inlineCss: [
    `* { margin: 0; padding: 0; box-sizing: border-box; }
     body { font-family: Inter, system-ui, sans-serif; overflow: hidden; }`,
  ],
  sample: {
    claimA: "Motion is a lie",
    claimB: "your eye agrees to.",
    credit: "Three chapters on the invention of the moving picture",
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({
      open: "8%",
      claim: "20%",
      dwell: "14%",
      title: "20%",
      hold: "38%",
    });

    const openP = t.in("open");
    const lineA = std.interpolate(t.in("claim"), [0, 0.6], [0, 1], "easeOutCubic");
    const lineB = std.interpolate(t.in("claim"), [0.2, 0.85], [0, 1], "easeOutCubic");

    // The claim clears before the title lands, so the card reads as two beats.
    const clear = std.interpolate(t.in("title"), [0, 0.42], [0, 1], "easeInOutCubic");
    const titleP = std.interpolate(t.in("title"), [0.34, 1], [0, 1], "easeOutCubic");
    const creditP = std.interpolate(t.in("title"), [0.6, 1], [0, 1], "easeOutCubic");

    // Tracking settles wide-to-set: a title struck on, not slid in.
    const track = std.interpolate(titleP, [0, 1], [0.74, 0.3], "easeOutCubic");
    const ruleW = std.interpolate(openP, [0, 1], [0, 300], "easeOutCubic");

    const figure = `<svg width="240" height="300" viewBox="0 0 110 190" style="opacity:${(0.42 * creditP).toFixed(3)}">
      ${runner({ phase: timeline.seconds * 1.05, color: DUST, width: 4.5 })}
    </svg>`;

    return Html({ width: "fill", height: "fill", html: `
<div style="${std.css({ width, height, background: ground(), position: "relative", overflow: "hidden" })}">
  <div style="position:absolute;inset:0;transform:${gateWeave(timeline.frame)}">
    ${sprockets(height, width, timeline.seconds * 1.6)}

    <div style="position:absolute;left:${AXIS}px;top:0;bottom:0;right:${AXIS}px;display:flex;flex-direction:column;justify-content:center">

      <div style="height:1px;width:${ruleW.toFixed(1)}px;background:${AMBER};opacity:0.75;margin-bottom:52px"></div>

      <div style="opacity:${(1 - clear).toFixed(3)};transform:translateY(${(-52 * clear).toFixed(2)}px)">
        ${revealLine(
          `<p style="font-family:Fraunces,Georgia,serif;font-size:108px;font-weight:400;color:${BONE};line-height:1.06;letter-spacing:-0.02em">${std.text.escapeHtml(data.claimA)}</p>`,
          lineA,
          124,
        )}
        ${revealLine(
          `<p style="font-family:Fraunces,Georgia,serif;font-size:108px;font-weight:600;color:${AMBER};line-height:1.06;letter-spacing:-0.02em">${std.text.escapeHtml(data.claimB)}</p>`,
          lineB,
          124,
        )}
      </div>

      <div style="position:absolute;left:0;right:0;top:50%;margin-top:-24px;${rise(titleP, 22)}">
        <p style="font-size:40px;font-weight:600;letter-spacing:${track.toFixed(3)}em;color:${BONE};line-height:1.2">${FILM_TITLE}</p>
        <p style="margin-top:30px;font-size:19px;letter-spacing:0.22em;color:${DUST};${rise(creditP, 14)}">${std.text.escapeHtml(data.credit)}</p>
      </div>
    </div>

    <div style="position:absolute;right:${AXIS}px;bottom:96px">${figure}</div>
    ${vignette()}
    ${grain(width, height, (timeline.frame % 5) + 1)}
  </div>
</div>` });
  },
});
