// Hello World — media program: data in, destination-ready video out.
// Edit sample.title, re-export.

import { video, Frame, Fill, Stack, Text } from "@foxworth/superimg";

export default video({
  duration: "5s",
  sample: { title: "Hello, SuperImg!" },
  render(ctx) {
    const t = ctx.director({ in: "20%", hold: "80%" });
    return Frame(
      { id: "stage", width: ctx.width, height: ctx.height },
      Fill({ color: "#f1ebe1" }),
      Stack(
        { id: "layout", width: "fill", height: "fill", align: "center", justify: "center" },
        Text({ id: "title", variant: "display", color: "#17140f", motion: t.motion({ y: 24 }) }, ctx.data.title),
      ),
    );
  },
});
