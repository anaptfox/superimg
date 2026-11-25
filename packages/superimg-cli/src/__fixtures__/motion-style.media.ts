import { video, Frame } from "@foxworth/superimg";

export default video({
  size: { width: 200, height: 200 },
  duration: "1s",
  render(ctx) {
    const t = ctx.director({ in: "50%", hold: "50%" });
    return Frame(
      { width: 200, height: 200, fill: "#000" },
      Frame({
        id: "box",
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        fill: "#fff",
        style: { transform: "scale(0.5)" },
        motion: t.motion({ y: 0 }),
      }),
    );
  },
});
