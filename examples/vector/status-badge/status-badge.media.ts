import { svg, Vector, vector, googleFont } from "@foxworth/superimg";

// A real static SVG: no timeline, browser scripts, or rasterized text.
// Export a named data variant: superimg export status-badge.media.ts --variant queued.
export default svg({
  size: { width: 600, height: 180 },
  fonts: [googleFont("Inter:wght@600;700")],
  sample: { label: "BUILD", status: "PASSING", accent: "#93E3B1" },
  variants: { queued: { status: "QUEUED", accent: "#F4D387" } },
  render({ width, height, data }) {
    return Vector({ id: "badge", width, height, viewBox: { x: 0, y: 0, width: 600, height: 180 } },
      vector.path({ id: "plate", d: "M24 0H576Q600 0 600 24V156Q600 180 576 180H24Q0 180 0 156V24Q0 0 24 0Z", fill: "#15241E" }),
      vector.path({ id: "divider", d: "M215 36V144", stroke: "#43554B", strokeWidth: 2 }),
      vector.text({ id: "label", x: 110, y: 94, size: 28, weight: 600, family: "Inter", anchor: "middle", dominantBaseline: "middle", fill: "#E4ECE7" }, data.label),
      vector.text({ id: "status", x: 407, y: 94, size: 34, weight: 700, family: "Inter", anchor: "middle", dominantBaseline: "middle", fill: data.accent }, data.status),
    );
  },
});
