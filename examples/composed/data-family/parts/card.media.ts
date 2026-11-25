import { video, Html } from "@foxworth/superimg";

export interface CardData extends Record<string, unknown> {
  label: string;
  color: string;
  frames: number;
}

export default video<CardData>({
  size: { width: 1280, height: 720 },
  fps: 25,
  duration: "25f", // Authoring preview; each occurrence resolves its own duration.
  sample: { label: "SAMPLE", color: "#78c9b0", frames: 25 },
  resolve({ data }) {
    if (!Number.isSafeInteger(data.frames) || data.frames < 1) {
      throw new TypeError("Card frames must be a positive integer");
    }
    return { duration: `${data.frames}f` };
  },
  render(ctx) {
    const progress = ctx.timeline.progress;
    const x = 140 + progress * 900;
    return Html({
      id: "card",
      width: "fill",
      height: "fill",
      html: `<main style="position:relative;width:100%;height:100%;overflow:hidden;background:#101820;color:#f4f1ea;font:700 72px system-ui"><div style="position:absolute;left:110px;top:90px">${ctx.data.label}</div><div style="position:absolute;left:${x.toFixed(1)}px;top:340px;width:100px;height:100px;border-radius:50%;background:${ctx.data.color}"></div><small style="position:absolute;left:110px;bottom:70px;font:500 24px system-ui">LOCAL FRAME ${ctx.timeline.frame} / ${ctx.data.frames}</small></main>`,
    });
  },
});
