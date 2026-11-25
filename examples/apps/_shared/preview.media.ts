import { video, Frame, Fill, Stack, Text } from "@foxworth/superimg";

export const previews = [
  { kind: "gradient", title: "Hue rotation" },
  { kind: "pulse", title: "Breathing circle" },
  { kind: "bars", title: "Phase-shifted bars" },
  { kind: "spin", title: "One complete turn" },
  { kind: "wave", title: "Traveling wave" },
  { kind: "sweep", title: "Gradient sweep" },
] as const;
export type PreviewData = (typeof previews)[number];

// Both browser demos play the same typed media. All six loops meet at the seam.
export default video<PreviewData>({
  size: { width: 640, height: 360 },
  fps: 24,
  duration: "2s",
  sample: previews[0],
  render({ width, height, timeline, data, std }) {
    const seconds = timeline.seconds;
    const turn = std.loop(seconds, { period: "2s" }) * 360;
    const rgb = std.color.hslToRgb(turn, 65, 25);
    const hueColor = std.color.rgbToHex(rgb.r, rgb.g, rgb.b);
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"];
    const unit = Math.min(width / 640, height / 360);
    const loop = (from: number, to: number, offset = 0) =>
      std.oscillate(seconds + offset, { period: "2s", from, to });
    return Frame(
      { id: "preview", width, height },
      Fill({ id: "background", color: "#101828" }),
      data.kind === "gradient" || data.kind === "sweep"
        ? Fill({ id: "gradient", gradient: {
          kind: "linear", angle: data.kind === "sweep" ? turn : 120,
          stops: data.kind === "sweep" ? ["#9F1239", "#C2410C"] : [hueColor, "#101828"],
        } }) : null,
      data.kind === "pulse" || data.kind === "spin"
        ? Frame({ id: "shape", x: width / 2 - 42 * unit, y: height / 2 - 42 * unit,
          width: 84 * unit, height: 84 * unit,
          style: { transform: data.kind === "spin" ? `rotate(${turn}deg)` : `scale(${loop(0.8, 1)})` },
        }, Fill({ color: "#67E8F9", radius: data.kind === "pulse" ? "50%" : 8 * unit })) : null,
      data.kind === "bars" || data.kind === "wave"
        ? colors.map((color, i) => {
          const barHeight = loop(24, 120, i * 0.2) * unit;
          const size = data.kind === "wave" ? 22 * unit : barHeight;
          return Fill({ id: `mark-${i}`, x: width / 2 + (i - 2.5) * 55 * unit,
            y: data.kind === "wave" ? height / 2 + loop(-35, 35, i * 0.2) * unit : height * 0.68 - size,
            width: 36 * unit, height: size, radius: data.kind === "wave" ? "50%" : 4 * unit, color });
        }) : null,
      Stack({ id: "caption", width: "fill", height: "fill", justify: "end", align: "center", pad: 22 * unit },
        Text({ id: "title", size: 22 * unit, color: "#FFFFFF", weight: 600 }, data.title)),
    );
  },
});
