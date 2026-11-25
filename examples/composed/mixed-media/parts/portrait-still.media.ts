import { image, Frame, Fill, Stack, Text } from "@foxworth/superimg";

const INK = "#F7F2E8";
const NIGHT = "#20233A";
const PINK = "#F2768D";

export default image({
  size: { width: 720, height: 1080 },
  render(ctx) {
    const { width, height } = ctx;
    return Frame(
      { id: "portrait-still", width, height },
      Fill({ color: NIGHT }),
      Stack(
        { width: "fill", height: "fill", justify: "center", align: "center", pad: { x: 72, y: 96 }, gap: 22 },
        Text({ id: "eyebrow", variant: "label", size: 22, weight: 700, letterSpacing: 3, color: PINK }, "02 · PORTRAIT STILL"),
        Text({ id: "title", variant: "display", size: 74, weight: 800, lineHeight: 1.05, color: INK, align: "center" }, "A tall idea."),
        Text({ id: "note", variant: "body", size: 26, color: "#B9B7C8", align: "center" }, "720 × 1080 · contain"),
      ),
    );
  },
});
