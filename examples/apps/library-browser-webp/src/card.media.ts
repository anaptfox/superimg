import { Frame, Stack, Text, ogImage, googleFont } from "@foxworth/superimg";

export default ogImage<{ title: string }>({
  size: { width: 1200, height: 630 },
  background: "#12100E",
  fonts: [googleFont("Anton"), googleFont("JetBrains+Mono:wght@400;500")],
  sample: { title: "SuperImg" },
  render(ctx) {
    return Frame(
      { width: "fill", height: "fill" },
      Stack(
        { width: "fill", height: "fill", align: "center", justify: "center" },
        Text({ variant: "display", color: "#F4EFE4" }, ctx.data.title),
      ),
    );
  },
});
