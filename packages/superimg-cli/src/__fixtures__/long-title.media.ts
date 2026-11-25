import { image, Frame, Stack, Text, googleFont } from "@foxworth/superimg";

export default image({
  size: { width: 600, height: 300 },
  fonts: [googleFont("Anton"), googleFont("JetBrains+Mono:wght@400;500")],
  render: () => Frame(
    { width: 600, height: 300, fill: "#000" },
    Stack(
      { width: "fill", height: "fill", pad: 40, justify: "center" },
      Text({ size: 48, color: "#fff" }, "A deliberately long title that must wrap onto several lines"),
    ),
  ),
});
