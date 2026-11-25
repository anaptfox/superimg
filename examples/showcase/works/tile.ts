import { Fill, Frame, Text } from "@foxworth/superimg";

/** One deterministic specimen, shared by the film and its frame samples. */
export function tile(progress: number, size = 360, id = "tile") {
  const p = Math.max(0, Math.min(1, progress));
  const inset = size * (0.26 - p * 0.08);
  return Frame(
    { id, width: size, height: size },
    Fill({ id: `${id}.paint`, color: "#147DFF" }),
    Frame(
      {
        id: `${id}.outline`, x: inset, y: inset,
        width: size - inset * 2, height: size - inset * 2,
        style: { border: `${Math.max(2, size / 100)}px solid #F4F4F1`, transform: `rotate(${p * 90}deg)` },
      },
      Fill({ color: "transparent" }),
    ),
    Frame(
      { id: `${id}.center`, x: size * 0.4, y: size * 0.4, width: size * 0.2, height: size * 0.2 },
      Fill({ color: "#F4F4F1" }),
    ),
    Frame(
      { id: `${id}.label`, x: size * 0.07, y: size * 0.915, width: size * 0.86, height: size * 0.065 },
      Text({ size: size * 0.031, color: "#F4F4F1", fontFamily: "monospace", letterSpacing: size * 0.005 }, "SUPERIMG / FRAME STUDY"),
    ),
  );
}
