// Minimal SuperImg template — last act holds; no exit mentioned.
import { video, Stack, Text } from "@foxworth/superimg";

export default video({
  duration: "5s",
  sample: { title: "Hello" },
  render(ctx) {
    const t = ctx.director({ in: "20%", hold: "80%" });
    return Stack(
      { width: "fill", height: "fill", align: "center", justify: "center" },
      Text({ variant: "display", motion: t.motion({ y: 24 }) }, ctx.data.title),
    );
  },
});
