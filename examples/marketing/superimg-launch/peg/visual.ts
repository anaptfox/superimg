// Peg as one reusable shared visual. Every Peg in the film (the performer and
// the printed Pegs in the campaign kit) is an Instance of this definition, so
// there is one character source and one painter.
import { Image, visual } from "@foxworth/superimg";
import type { Box } from "./art";

export type PegLook = {
  /** Self-contained SVG data URL from ./art.ts. */
  src: string;
  /** The art box in drawing units; its floor point is (0, 0). */
  box: Box;
  /** Pixels per drawing unit. The art is laid out at final size so it rasterises crisply. */
  scale: number;
};

export const peg = visual<PegLook>({
  id: "peg",
  render: ({ data: { src, box, scale } }) => {
    const bounds = { x: box.x * scale, y: box.y * scale, width: box.w * scale, height: box.h * scale };
    return {
      parts: [{ id: "clay", bounds, content: Image({ src, width: bounds.width, height: bounds.height, fit: "fill" }) }],
      anchors: { floor: { x: 0, y: 0 } },
    };
  },
});
