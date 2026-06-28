import { define } from "superimg";

const CHAPTER_WORDS = [
  { text: "SuperImg", start: 0.0, end: 0.6 },
  { text: "layers", start: 0.65, end: 1.0 },
  { text: "HTML", start: 1.05, end: 1.35 },
  { text: "templates", start: 1.4, end: 1.9 },
  { text: "into", start: 1.95, end: 2.1 },
  { text: "multi-track", start: 2.15, end: 2.7 },
  { text: "audio", start: 2.75, end: 3.05 },
  { text: "timelines.", start: 3.1, end: 3.6 },
];

export default define({
  config: {
    fps: 30,
    duration: "20s",
    fonts: ["Inter:wght@400;600;700", "JetBrains+Mono:wght@500"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Inter, system-ui, sans-serif; color: #e2e8f0; overflow: hidden; }
      .mono { font-family: "JetBrains Mono", ui-monospace, monospace; }
    `],
  },
  sample: {
    chapter: "Chapter 1",
    title: "Timeline as data",
    accent: "#a78bfa",
    words: CHAPTER_WORDS,
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({ enter: "15%", hold: "70%", exit: "15%" });
    const header = t.motion({ y: 20, opacity: 0, easing: "easeOutCubic" });
    const transcript = ctx.track({ words: data.words }).transcript();
    const active = transcript.current();

    const caption = data.words
      .map((w) => {
        const isActive = active?.text === w.text;
        const color = isActive ? data.accent : "#94a3b8";
        const weight = isActive ? 700 : 400;
        return `<span style="color: ${color}; font-weight: ${weight}; margin-right: 0.35em;">${w.text}</span>`;
      })
      .join("");

    return `
      <div style="${std.css({ width, height, background: "linear-gradient(160deg, #0f172a 0%, #020617 100%)" })}">
        <div style="${std.css({ padding: "80px 96px", height: "100%" }, std.css.column({ gap: 32 }))}">
          <div style="${header.style}">
            <p class="mono" style="font-size: 18px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">${data.chapter}</p>
            <h1 style="font-size: 72px; font-weight: 700; line-height: 1.05;">${data.title}</h1>
          </div>
          <div style="margin-top: auto; padding: 28px 32px; background: rgba(15,23,42,0.75); border: 1px solid rgba(148,163,184,0.2); border-radius: 16px; font-size: 36px; line-height: 1.5;">
            ${caption}
          </div>
        </div>
      </div>
    `;
  },
});