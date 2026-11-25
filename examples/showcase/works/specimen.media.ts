import { video } from "@foxworth/superimg";
import { tile } from "./tile";

export default video({
  duration: "3s",
  size: { width: 360, height: 360 },
  render(ctx) {
    return tile(ctx.timeline.progress);
  },
});
