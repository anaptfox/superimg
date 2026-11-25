import { image, Frame, Fill, Stack, Text } from "@foxworth/superimg";

const PAPER = "#F4EBDD";
const INK = "#1E2A3A";
const BLUE = "#2E6FA3";

export default image({
  size: { width: 1280, height: 720 },
  render(ctx) {
    const { width, height } = ctx;
    return Frame(
      { id: "landscape-still", width, height },
      Fill({ color: PAPER }),
      Stack(
        { width: "fill", height: "fill", justify: "center", pad: { x: 120, y: 80 }, gap: 24 },
        Text({ id: "eyebrow", variant: "label", size: 24, weight: 700, letterSpacing: 4, color: BLUE }, "01 · LANDSCAPE STILL"),
        Text({ id: "title", variant: "display", size: 86, weight: 800, color: INK }, "Wide open."),
        Text({ id: "note", variant: "body", size: 30, color: "#566273" }, "1280 × 720 authored canvas"),
      ),
    );
  },
});
