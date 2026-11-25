import { video } from "@foxworth/superimg";
import { campaignArt, type CampaignData } from "./art";

export default video<CampaignData>({
  size: { width: 640, height: 360 },
  duration: "2s",
  fps: 24,
  sample: { title: "Make room." },
  editions: { square: { size: { width: 640, height: 640 } } },
  render(ctx) {
    const progress = ctx.director({ enter: "40%", hold: "60%" }).tween(0, 1, { during: "enter" });
    return campaignArt(ctx.width, ctx.height, ctx.data.title, progress);
  },
});
