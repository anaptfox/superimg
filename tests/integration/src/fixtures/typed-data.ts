import { Frame, Stack, Text, image, googleFont } from "@foxworth/superimg";
import { render } from "@foxworth/superimg/runtime";

const card = image({
  size: { width: 320, height: 180 },
  fonts: [googleFont("Anton"), googleFont("JetBrains+Mono:wght@400;500")],
  sample: { title: "x" },
  render(ctx) {
    return Frame(
      { width: "fill", height: "fill" },
      Stack(
        { width: "fill", height: "fill", align: "center", justify: "center" },
        Text({ variant: "display" }, ctx.data.title),
      ),
    );
  },
});

void render(card, { as: "png", data: { title: "x" } });

void render(card, {
  as: "png",
  // @ts-expect-error wrong key
  data: { headline: "x" },
});

void render(card, {
  as: "png",
  // @ts-expect-error wrong type
  data: { title: 1 },
});
