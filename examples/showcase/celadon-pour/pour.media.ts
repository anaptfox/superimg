import { video } from "@foxworth/superimg";
import { samplePour } from "./action.ts";
import { pourScene } from "./scene.ts";

export default video({
  size: { width: 1280, height: 720 }, fps: 24, duration: "10s",
  fonts: [{ family: "Bricolage Grotesque", weight: 600, src: new URL("./assets/BricolageGrotesque.ttf", import.meta.url).pathname }],
  render: (ctx) => pourScene(samplePour(ctx.timeline.seconds), ctx.width, ctx.height),
});
