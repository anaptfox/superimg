import { defineImage } from "superimg";

export default defineImage({
  config: {
    width: 1200,
    height: 630,
    outputs: {
      og: { width: 1200, height: 630, format: "png" },
      thumb: { width: 600, height: 315, format: "webp" },
    },
  },
  render(ctx) {
    const { width, height } = ctx;
    return `<div style="width:${width}px;height:${height}px;background:#0f172a;display:flex;align-items:center;justify-content:center;font-family:sans-serif;">
      <div style="color:white;font-size:64px;font-weight:bold;">SuperImg</div>
    </div>`;
  },
});
