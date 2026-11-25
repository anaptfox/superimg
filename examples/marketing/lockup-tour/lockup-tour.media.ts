import { video, Frame, Html, googleFont } from "@foxworth/superimg";
import { TOUR, geom, paintMark, svgFrame, type PaintName } from "./mark";

export default video({
  duration: "8s",
  size: { width: 1080, height: 1080 },
  fonts: [googleFont("Fraunces:wght@600")],
  render(ctx) {
    const { width, height, std, timeline } = ctx;
    const g = geom(width, height);
    const p = timeline.progress;
    const teach = 0.1;
    const land = 0.12;
    let name: PaintName = "cream";
    let scale = 1;
    let smashShift = 0;

    if (p < teach) {
      name = "cream";
    } else if (p > 1 - land) {
      const local = (p - (1 - land)) / land;
      scale = std.spring(0.96, 1, local, "snappy");
      name = "cream";
    } else {
      const tour = (p - teach) / (1 - teach - land);
      const max = TOUR.length - 1;
      const i = Math.min(max, Math.floor(tour * TOUR.length));
      name = TOUR[i] ?? "cream";
      if (name === "smash") {
        const frame = timeline.frame;
        smashShift = (Math.floor(frame / 2) % 2 === 0 ? -3 : 3);
      }
    }

    const inner = `<g transform="translate(${g.cx},${g.cy}) scale(${scale.toFixed(4)}) translate(${-g.cx},${-g.cy})">${paintMark(name, g, { smashShift })}</g>`;

    return Frame(
      { width: "fill", height: "fill" },
      Html({ html: svgFrame(width, height, inner) }),
    );
  },
});
