import { Fill, Frame, Text } from "@foxworth/superimg";

export interface CampaignData { title: string }

// Shared artwork is ordinary code, not another discoverable media entry.
export function campaignArt(width: number, height: number, title: string, progress = 1) {
  const square = width === height;
  const inset = width * 0.08;
  return Frame(
    { width, height },
    Fill({ color: "#142d27" }),
    Frame(
      { x: inset, y: height * (square ? 0.18 : 0.22), width: width * (square ? 0.44 : 0.16), height: height * (square ? 0.20 : 0.08) },
      Fill({ color: "#c9f27a" }),
    ),
    Frame(
      { x: inset, y: height * (square ? 0.48 : 0.43), width: width - inset * 2, height: height * 0.25 },
      Text({ width: "fill", size: width * (square ? 0.09 : 0.075), color: "#fff7e8" }, title),
    ),
    Frame(
      { x: inset, y: height * 0.80, width: (width - inset * 2) * (0.1 + progress * 0.9), height: height * 0.025 },
      Fill({ color: "#c9f27a" }),
    ),
  );
}
