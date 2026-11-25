import { video, Frame, Fill, Stack, Text } from "@foxworth/superimg";

const INK = "#16130F";
const GOLD = "#F2B84B";
const FIELD = "#F2E6C9";

export default video({
  size: { width: 720, height: 720 },
  fps: 30,
  duration: "1s",
  render(ctx) {
    const { width, height } = ctx;
    const t = ctx.director({ enter: "20%", hold: "60%", exit: "20%" });
    const bar = t.tween(0, width * 1.35, { id: "square-bar", during: "enter", easing: "easeOutCubic" });
    const card = t.motion({ id: "square-card", y: 30, scale: 0.92 });
    return Frame(
      { id: "square-video", width, height },
      Fill({ color: FIELD }),
      Frame({ x: 0, y: Math.round(height * 0.62), width: Math.max(1, bar), height: 42 }, Fill({ color: GOLD })),
      Stack(
        { width: "fill", height: "fill", justify: "center", align: "center", gap: 18, motion: card },
        Text({ id: "eyebrow", variant: "label", size: 20, weight: 700, letterSpacing: 3, color: "#8B6A24" }, "03 · SQUARE VIDEO"),
        Text({ id: "title", variant: "display", size: 70, weight: 800, color: INK, align: "center" }, "Motion, cropped."),
        Text({ id: "note", variant: "body", size: 24, color: "#716650", align: "center" }, "720 × 720 · cover"),
      ),
    );
  },
});
