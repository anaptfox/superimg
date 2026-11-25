import { video, Frame, Fill, Text } from "@foxworth/superimg";
import { launchLayout } from "./layout.js";

export interface LaunchData {
  id: string;
  title: string;
  description: string;
  productAvailable: boolean;
}

const PAPER = "#f2efe7";
const INK = "#18251f";
const BLUE = "#2448ce";

export default video<LaunchData>({
  size: { width: 960, height: 540 },
  fps: 25,
  duration: "6s",
  sample: { id: "launch", title: "Make room\nfor good work.", description: "Fieldnote / a quieter place to begin", productAvailable: true },
  editions: { square: { size: { width: 540, height: 540 } } },
  render(ctx) {
    const { width, height, data } = ctx;
    const layout = launchLayout(width, height);
    const d = ctx.director({ enter: "0.6s", hold: "5.4s" });
    const product = layout.product;
    return Frame({ id: "stage", width, height },
      Fill({ color: PAPER }),
      Frame({ id: "brand", x: 54, y: 42, width: 300, height: 22 },
        Text({ color: INK, size: 15, weight: 650, letterSpacing: 3 }, "FIELDNOTE / 01")),
      // Literal landscape coordinates deliberately expose an exact source edit.
      Frame({ id: "title", x: 72, y: 104, width: layout.title.width, height: layout.title.height,
        style: layout.square ? { transform: "translate(-18px, -14px)" } : {},
        motion: d.motion({ y: 16 }) },
        Text({ id: "title-copy", color: INK, size: layout.square ? 43 : 54, weight: 650,
          lineHeight: 1.05, letterSpacing: -2, maxWidth: layout.title.width }, data.title)),
      Frame({ id: "description", x: 54, y: height - 47, width: width - 108, height: 22 },
        Text({ color: "#48574f", size: 14 }, data.description)),
      ...(data.productAvailable ? [Frame({ id: "product", x: product.x, y: product.y,
        // Computed width is inspect-only; a numeric snapshot isn't source authority.
        width: product.width, height: product.height, radius: 12,
        motion: d.motion({ y: 28, at: "0.1s", for: "0.5s" }) },
        Fill({ color: BLUE }),
        Frame({ id: "product-label", x: 26, y: 24, width: product.width - 52, height: 24 },
          Text({ color: "#ffffff", size: 13, letterSpacing: 2 }, "YOUR NEXT CHAPTER")),
        Frame({ id: "product-page", x: 26, y: 67, width: product.width - 52, height: product.height - 92, radius: 4 },
          Fill({ color: "#faf8f0" }),
          ...[0, 1, 2].map((i) => Frame({ id: `note-${i}`, x: 18, y: 18 + i * 24,
            width: (product.width - 88) * (i === 2 ? 0.65 : 1), height: 7, radius: 3 },
            Fill({ color: i === 0 ? "#24392d" : "#c9d0c7" }))),
        ),
      )] : []),
    );
  },
});
