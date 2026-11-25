import { svg, Vector, vector } from "@foxworth/superimg";
import { CLEFT_PATHS, CLEFT_PALETTE } from "./model";

export function renderCleftIcon(width: number, height: number) {
  const scale = Math.min(width, height) / 120;
  return Vector({ id: "cleft-icon", width, height, viewBox: { x: 0, y: 0, width, height } },
    vector.path({ id: "cleft-icon-stage", d: `M0 0H${width}V${height}H0Z`, fill: CLEFT_PALETTE.mist }),
    vector.group({ id: "cleft-icon-geometry", transform: { x: (width - 120 * scale) / 2, y: (height - 120 * scale) / 2, scale } },
      vector.group({ id: "cleft-icon-mark", transform: { x: 10 } },
        ...CLEFT_PATHS.map((d, i) => vector.path({ id: `cleft-icon-slab-${i}`, d, fill: CLEFT_PALETTE.hematite })),
      ),
    ),
  );
}

/** Flat contours are the 64px acceptance reference, without decorative grains. */
export default svg({
  size: { width: 64, height: 64 },
  render(ctx) {
    return renderCleftIcon(ctx.width, ctx.height);
  },
});
