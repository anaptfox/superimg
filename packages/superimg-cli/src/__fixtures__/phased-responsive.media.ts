import { video, Frame, Text } from "@foxworth/superimg";

export default video({
  duration: "2s",
  size: { width: 320, height: 180 },
  render(ctx) {
    const t = ctx.director({ in: "30%", hold: "70%" });
    const r = ctx.std.createResponsive(ctx);
    const scale = r({ portrait: 0.72, square: 0.8, default: 1 });
    return Frame(
      { width: "fill", height: "fill", fill: "#111" },
      Text({ variant: "display", color: "#fff", motion: t.motion({ y: 24 }) }, `hold ${scale}`),
    );
  },
});
