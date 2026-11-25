// Colophon. The figure keeps running while the reel signs off.
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
  duration: "6s",
  fonts: [googleFont("Fraunces:wght@400;600"), googleFont("Inter:wght@400;500;600"), googleFont("JetBrains+Mono:wght@500")],
  inlineCss: [
    `* { margin: 0; padding: 0; box-sizing: border-box; }
     body { font-family: Inter, system-ui, sans-serif; overflow: hidden; }`,
  ],
  sample: {
    chapters: [
      { n: "I", title: "The Zoetrope", year: "1834" },
      { n: "II", title: "Animal Locomotion", year: "1878" },
      { n: "III", title: "Sixteen a Second", year: "The threshold" },
    ],
    cta: "superimg.dev",
    sign: "Composed from three chapters and one music bed",
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({ list: "40%", mark: "30%", hold: "30%" });

    const titleP = std.interpolate(t.in("list"), [0, 0.4], [0, 1], "easeOutCubic");
    const markP = std.interpolate(t.in("mark"), [0, 0.7], [0, 1], "easeOutCubic");
    const signP = std.interpolate(t.in("mark"), [0.35, 0.8], [0, 1], "easeOutCubic");

    // Chapters recite in order, on the same cadence the reel used to build them.
    // Derive the cascade window from its actual phase.
    const listSteps = std.stagger.ms(data.chapters.length, t.in("list"), {
      eachMs: 190,
      windowSeconds: t.clip({ during: "list" }).durationSeconds,
    });
    const rows = data.chapters
      .map((c, i) => {
        const p = listSteps[i] ?? 0;
        return `<div style="display:flex;align-items:baseline;gap:26px;padding:15px 0;border-top:1px solid rgba(237,227,208,0.1);${rise(p, 18)}">
          <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:16px;letter-spacing:0.2em;color:${AMBER};width:52px">${std.text.escapeHtml(c.n)}</span>
          <span style="font-family:Fraunces,Georgia,serif;font-size:37px;color:${BONE};flex:1">${std.text.escapeHtml(c.title)}</span>
          <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;letter-spacing:0.16em;color:${DUST}">${std.text.escapeHtml(c.year)}</span>
        </div>`;
      })
      .join("");

    const figScale = 2.1;

    return Html({ width: "fill", height: "fill", html: `
<div style="${std.css({ width, height, background: ground(), position: "relative", overflow: "hidden" })}">
  <div style="position:absolute;inset:0;transform:${gateWeave(timeline.frame)}">
    ${sprockets(height, width, timeline.seconds * 1.6)}

    <div style="position:absolute;left:${AXIS}px;top:196px;width:840px">
      ${revealLine(
        `<p style="font-size:31px;font-weight:600;letter-spacing:0.28em;color:${BONE};line-height:1.3">${FILM_TITLE}</p>`,
        titleP,
        44,
      )}
      <div style="margin-top:46px">${rows}</div>
    </div>

    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="position:absolute;inset:0">
      <g transform="translate(${(1430 - (110 * figScale) / 2).toFixed(1)},${288})" opacity="${(0.46 * markP).toFixed(3)}">
        ${runner({ phase: timeline.seconds * 1.15, scale: figScale, color: BONE, width: 4.4 })}
      </g>
    </svg>

    <div style="position:absolute;left:${AXIS}px;bottom:150px;${rise(markP, 20)}">
      <div style="height:1px;width:${(220 * markP).toFixed(1)}px;background:${AMBER};opacity:0.8;margin-bottom:26px"></div>
      <p style="font-family:Fraunces,Georgia,serif;font-size:62px;font-weight:600;color:${AMBER};line-height:1.05">${std.text.escapeHtml(data.cta)}</p>
      <p style="margin-top:20px;font-size:18px;letter-spacing:0.16em;color:${DUST};${rise(signP, 12)}">${std.text.escapeHtml(data.sign)}</p>
    </div>

    ${vignette()}
    ${grain(width, height, (timeline.frame % 5) + 1)}
  </div>
</div>` });
  },
});
