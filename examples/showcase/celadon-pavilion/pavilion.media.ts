import { Fill, Frame, NativeSurface, video } from "@foxworth/superimg";
import world from "./world.ts?superimg-surface";
import type { PavilionData } from "./world.ts";

const duration = 7;

export default video({
  size: { width: 1280, height: 720 }, fps: 24, duration: "7s",
  render: (ctx) => Frame({ width: ctx.width, height: ctx.height },
    Fill({ color: "#e7d6a6" }),
    NativeSurface<PavilionData>({ id: "pavilion", module: world, width: ctx.width, height: ctx.height, seconds: ctx.timeline.seconds, data: { duration } })),
});
