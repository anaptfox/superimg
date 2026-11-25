import { image, Frame, Stack, Fill, Text } from "@foxworth/superimg";

export default image({
  size: { width: 1080, height: 1080 },
  render() {
    return Frame({ width: 1080, height: 1080 }, Fill({ color: "#f7f3eb" }),
      Stack({ width: 920, pad: 30, gap: 0 },
        Text({ id: "item", size: 54, color: "#18212b" }, "Roasted vegetables"),
        Text({ id: "unit", size: 34, color: "#18212b" }, "2 servings · 30 minutes"),
        Frame({ id: "highlight", width: 420, height: 50, fill: "#dcebd3" },
          Text({ id: "highlight-text", size: 38, maxWidth: 400, color: "#18212b" }, "Turn the vegetables halfway through so both sides brown evenly.")),
        Text({ id: "note", size: 32, maxWidth: 840, color: "#18212b" }, "Note: rest briefly before serving.")));
  },
});
