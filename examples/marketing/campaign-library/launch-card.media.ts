import { image } from "@foxworth/superimg";
import { campaignArt, type CampaignData } from "./art";

export default image<CampaignData>({
  size: { width: 640, height: 360 },
  sample: { title: "Make room." },
  variants: { teams: { title: "Build together." } },
  editions: { square: { size: { width: 640, height: 640 } } },
  render: ({ width, height, data }) => campaignArt(width, height, data.title),
});
