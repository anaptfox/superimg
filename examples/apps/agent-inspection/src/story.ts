import { choose, Fill, Frame, sequence, Text, video } from "@foxworth/superimg";

export const size = { width: 800, height: 450 } as const;
export const fps = 25;

function clip(label: string, color: string, frames: number) {
  return video({
    size, fps, duration: `${frames}f`,
    render(ctx) {
      return Frame(
        { id: "card", width: ctx.width, height: ctx.height },
        Fill({ color }),
        Frame({ x: 56, y: 100, width: 700, height: 72 },
          Text({ id: "title", size: 54, color: "#faf7f0" }, label)),
        Frame({ x: 60, y: 185, width: 680, height: 42 },
          Text({ id: "frame-label", size: 28, color: "#faf7f0" }, `Local frame ${ctx.timeline.frame}`)),
        Frame({ x: 60, y: 330, width: 680, height: 36 },
          Text({ id: "caption", size: 21, color: "#faf7f0" }, "Named occurrence + accepted frame + rendered bounds")),
      );
    },
  });
}

// The same node IDs in both children are distinguished by occurrence path.
export const story = sequence([
  { id: "opener", content: clip("Opener", "#245a63", 3) },
  { id: "chapter", content: choose({
    calm: clip("Chapter / calm", "#3f536e", 4),
    contrast: clip("Chapter / contrast", "#913b53", 4),
  }) },
]);
