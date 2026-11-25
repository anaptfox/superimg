// Architecture — a cyanotype drafting sheet. The walkthrough is one semantic
// vector tree, so every node and edge remains visible to check and inspect.

import {
  video,
  Frame,
  Stack,
  Text,
  Vector,
  vector,
  type MediaElement,
  type RenderContext,
  googleFont,
} from "@foxworth/superimg";

export interface ArchDiagramData extends Record<string, unknown> {
  title: string;
  system: string;
  revision: string;
  accentColor: string;
}

const GROUND = "#0A2340";
const LINE = "#8FC0EE";
const INK = "#EAF4FF";
const DIM = "#7FA6CC";
const HAIR = "rgba(143,192,238,0.28)";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

type StepId = "n-client" | "n-api" | "n-db" | "n-worker";

interface Step {
  id: StepId;
  label: string;
  note: string;
  edges: string[];
}

const STEPS: Step[] = [
  { id: "n-client", label: "Client", note: "browser · fetch()", edges: [] },
  { id: "n-api", label: "API", note: "edge gateway", edges: ["e-client-api"] },
  { id: "n-db", label: "Database", note: "read replica", edges: ["e-api-db"] },
  { id: "n-worker", label: "Worker", note: "async write-back", edges: ["e-api-worker", "e-worker-db"] },
];

interface NodeSpec {
  id: StepId;
  x: number;
  y: number;
  width: number;
  label: string;
  note: string;
}

interface EdgeSpec {
  id: string;
  d: string;
  arrow: string;
  label: string;
  labelX: number;
  labelY: number;
}

const NODES: NodeSpec[] = [
  { id: "n-client", x: 60, y: 150, width: 240, label: "Client", note: "browser · fetch()" },
  { id: "n-api", x: 470, y: 150, width: 260, label: "API", note: "edge gateway" },
  { id: "n-db", x: 900, y: 150, width: 240, label: "Database", note: "read replica" },
  { id: "n-worker", x: 470, y: 400, width: 260, label: "Worker", note: "async write-back" },
];

const EDGES: EdgeSpec[] = [
  { id: "e-client-api", d: "M300 209H452", arrow: "M470 209L452 200V218Z", label: "1", labelX: 376, labelY: 174 },
  { id: "e-api-db", d: "M730 209H882", arrow: "M900 209L882 200V218Z", label: "2", labelX: 806, labelY: 174 },
  { id: "e-api-worker", d: "M600 268V382", arrow: "M600 400L591 382H609Z", label: "3", labelX: 600, labelY: 325 },
  { id: "e-worker-db", d: "M730 459H1020V288", arrow: "M1020 270L1011 288H1029Z", label: "4", labelX: 875, labelY: 424 },
];

const GLYPHS: Record<StepId, string[]> = {
  "n-client": [
    "M1.5 3H22.5V20H1.5Z",
    "M1.5 8H22.5",
    "M5 4.7A0.9 0.9 0 1 0 5 6.5A0.9 0.9 0 1 0 5 4.7Z",
  ],
  "n-api": ["M1.5 4H22.5V20H1.5Z", "M9 4V20M15 4V20"],
  "n-db": [
    "M3.5 5.5C3.5 1.5 20.5 1.5 20.5 5.5C20.5 9.5 3.5 9.5 3.5 5.5Z",
    "M3.5 5.5V18.5C3.5 22.5 20.5 22.5 20.5 18.5V5.5M3.5 12C3.5 16 20.5 16 20.5 12",
  ],
  "n-worker": [
    "M12 7.8A4.2 4.2 0 1 0 12 16.2A4.2 4.2 0 1 0 12 7.8Z",
    "M12 2V5.2M12 18.8V22M22 12H18.8M5.2 12H2M19.1 4.9L16.8 7.2M7.2 16.8L4.9 19.1M19.1 19.1L16.8 16.8M7.2 7.2L4.9 4.9",
  ],
};

export default video<ArchDiagramData>({
  duration: "7.6s",
  fonts: [googleFont("Inter:wght@400;500;600;700"), googleFont("JetBrains+Mono:wght@400;500")],
  inlineCss: [
    "* { margin: 0; padding: 0; box-sizing: border-box; }",
    "body { overflow: hidden; }",
  ],
  sample: {
    title: "Request path walkthrough",
    system: "Checkout service",
    revision: "REV C",
    accentColor: "#FFC857",
  },

  render(ctx: RenderContext<ArchDiagramData>) {
    const { std, width, height, data } = ctx;
    const ease = (v: number, fn: Parameters<typeof std.interpolate>[3]) =>
      std.interpolate(v, [0, 1], [0, 1], fn);
    const accent = String(data.accentColor ?? "#FFC857");
    const title = String(data.title ?? "Request path walkthrough");
    const system = String(data.system ?? "System");
    const revision = String(data.revision ?? "REV A");

    const t = ctx.director({
      sheet: "0.7s",
      "n-client": "1.1s",
      "n-api": "1.1s",
      "n-db": "1.1s",
      "n-worker": "1.1s",
      hold: "2.15s",
      out: "0.35s",
    });

    const sheetP = ease(t.in("sheet"), "easeOutCubic");
    const holdP = t.in("hold");
    const outP = ease(t.in("out"), "easeInCubic");

    // Cumulative walkthrough: once a step completes it stays lit.
    const stepP = STEPS.map((s) => ease(t.in(s.id), "easeInOutCubic"));
    const revealed: string[] = [];
    const activeNodes: string[] = [];
    const activeEdges: string[] = [];
    let activeProgress = 0;
    let activeIndex = -1;

    STEPS.forEach((step, i) => {
      const p = stepP[i]!;
      if (p >= 1) {
        revealed.push(step.id, ...step.edges);
      } else if (p > 0) {
        activeNodes.push(step.id);
        activeEdges.push(...step.edges);
        activeProgress = p;
        activeIndex = i;
      }
    });
    if (activeIndex === -1) activeIndex = holdP > 0 ? STEPS.length - 1 : -1;

    const plateW = Math.round(width * 0.615);
    const plateH = Math.round(plateW * (620 / 1200));
    const plateOp = std.interpolate(sheetP, [0.25, 1], [0, 1], "easeOutCubic");
    const dimOpacity = 0.16;

    const opacityFor = (id: string) => {
      if (revealed.includes(id)) return 1;
      if ([...activeNodes, ...activeEdges].includes(id)) {
        return dimOpacity + (1 - dimOpacity) * activeProgress;
      }
      return dimOpacity;
    };
    const colorFor = (id: string) =>
      [...activeNodes, ...activeEdges].includes(id) ? accent : LINE;

    const edgeElements = EDGES.map((edge): MediaElement => {
      const color = colorFor(edge.id);
      return vector.group(
        { id: edge.id, opacity: opacityFor(edge.id) },
        vector.path({
          id: `${edge.id}-line`,
          d: edge.d,
          fill: "none",
          stroke: color,
          strokeWidth: 1.8,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
        vector.path({ id: `${edge.id}-arrow`, d: edge.arrow, fill: color }),
        vector.path({
          id: `${edge.id}-label-cell`,
          d: std.svg.shape.circle(edge.labelX, edge.labelY, 15),
          fill: GROUND,
          stroke: HAIR,
          strokeWidth: 1,
        }),
        vector.text(
          {
            x: edge.labelX,
            y: edge.labelY + 5,
            fill: color,
            family: MONO,
            size: 14,
            anchor: "middle",
          },
          edge.label,
        ),
      );
    });

    const nodeElements = NODES.map((node): MediaElement => {
      const h = 118;
      const tick = 12;
      const color = colorFor(node.id);
      const corners = [
        `M${node.x} ${node.y + tick}V${node.y}H${node.x + tick}`,
        `M${node.x + node.width - tick} ${node.y}H${node.x + node.width}V${node.y + tick}`,
        `M${node.x + node.width} ${node.y + h - tick}V${node.y + h}H${node.x + node.width - tick}`,
        `M${node.x + tick} ${node.y + h}H${node.x}V${node.y + h - tick}`,
      ].map((d, i) =>
        vector.path({
          id: `${node.id}-corner-${i}`,
          d,
          fill: "none",
          stroke: color,
          strokeWidth: 2.4,
          strokeLinecap: "square",
        }),
      );
      const glyphs = GLYPHS[node.id].map((d, i) =>
        vector.path({
          id: `${node.id}-glyph-${i}`,
          d,
          fill: node.id === "n-client" && i === 2 ? color : "none",
          stroke: node.id === "n-client" && i === 2 ? "none" : color,
          strokeWidth: 1.4,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      );
      return vector.group(
        { id: node.id, opacity: opacityFor(node.id) },
        vector.path({
          id: `${node.id}-box`,
          d: std.svg.shape.roundedRect(node.x, node.y, node.width, h, 10),
          fill: "rgba(143,192,238,0.06)",
          stroke: HAIR,
          strokeWidth: 1.2,
        }),
        vector.path({
          id: `${node.id}-inset`,
          d: std.svg.shape.roundedRect(node.x + 8, node.y + 8, node.width - 16, h - 16, 6),
          fill: "none",
          stroke: "rgba(143,192,238,0.16)",
          strokeWidth: 1,
        }),
        ...corners,
        vector.group(
          { id: `${node.id}-glyph`, transform: `translate(${node.x + 26} ${node.y + 22}) scale(1.15)` },
          ...glyphs,
        ),
        vector.text(
          {
            x: node.x + 26,
            y: node.y + 82,
            fill: colorFor(node.id),
            family: "Inter, system-ui, sans-serif",
            size: 27,
            weight: 600,
            letterSpacing: -0.3,
          },
          node.label,
        ),
        vector.text(
          {
            x: node.x + 26,
            y: node.y + 104,
            fill: DIM,
            family: MONO,
            size: 14,
            letterSpacing: 0.6,
          },
          node.note,
        ),
      );
    });

    const plate = Vector(
      { id: "request-path", width: plateW, height: plateH, viewBox: { x: 0, y: 0, width: 1200, height: 620 } },
      vector.group(
        { id: "request-path-marks", opacity: plateOp },
        ...edgeElements,
        ...nodeElements,
        vector.group(
          { id: "request-path-scale", opacity: 0.55 },
          vector.path({ d: "M60 560H1140", fill: "none", stroke: HAIR, strokeWidth: 1 }),
          vector.path({ d: "M60 552V568M1140 552V568", fill: "none", stroke: HAIR, strokeWidth: 1 }),
          vector.path({ d: "M470 545H730V575H470Z", fill: GROUND }),
          vector.text(
            { x: 600, y: 565, fill: DIM, family: MONO, size: 14, anchor: "middle", letterSpacing: 2 },
            "REQUEST PATH · 4 HOPS",
          ),
        ),
      ),
    );

    const px = (v: number) => Math.round(Math.min(width, height * 1.78) * v);
    const inset = Math.round(width * 0.032);
    const railW = Math.round(width * 0.235);

    const gridSize = px(0.026);
    const gridSegments: string[] = [];
    for (let x = 0; x <= width; x += gridSize) gridSegments.push(`M${x} 0V${height}`);
    for (let y = 0; y <= height; y += gridSize) gridSegments.push(`M0 ${y}H${width}`);
    const grid = Vector(
      { id: "grid", width, height, viewBox: { x: 0, y: 0, width, height } },
      vector.path({
        id: "grid-lines",
        d: gridSegments.join(" "),
        fill: "none",
        stroke: LINE,
        strokeWidth: 1,
        opacity: 0.055,
      }),
    );
    const perimeter = (width - inset * 2) * 2 + (height - inset * 2) * 2;
    const border = Vector(
      { id: "sheet-border", width, height, viewBox: { x: 0, y: 0, width, height } },
      vector.path({
        id: "sheet-perimeter",
        d: `M${inset} ${inset}H${width - inset}V${height - inset}H${inset}Z`,
        fill: "none",
        stroke: HAIR,
        strokeWidth: 1.5,
        strokeDasharray: perimeter,
        strokeDashoffset: (1 - sheetP) * perimeter,
      }),
      ...[
        [inset, inset, 1, 1],
        [width - inset, inset, -1, 1],
        [inset, height - inset, 1, -1],
        [width - inset, height - inset, -1, -1],
      ].map(([cx, cy, sx, sy], i) =>
        vector.path({
          id: `sheet-corner-${i}`,
          d: `M${cx! + sx! * 26} ${cy}H${cx}V${cy! + sy! * 26}`,
          fill: "none",
          stroke: LINE,
          strokeWidth: 2.5,
          opacity: sheetP,
        }),
      ),
    );

    // Step rail.
    const rows = STEPS.map((step, i) => {
      const p = stepP[i]!;
      const isActive = i === activeIndex;
      const done = p >= 1;
      const appear = std.interpolate(sheetP, [0.3 + i * 0.12, 0.8 + i * 0.12], [0, 1], "easeOutCubic");
      const lit = isActive ? 1 : done ? 0.72 : 0.3;
      return Stack(
        {
          direction: "row",
          width: railW,
          height: px(0.048),
          align: "center",
          gap: px(0.014),
          style: {
            opacity: (appear * lit).toFixed(3),
            transform: `translateX(${((1 - appear) * -14).toFixed(2)}px)`,
          },
        },
        Frame({
          width: 3,
          height: px(0.034),
          fill: isActive ? accent : LINE,
          style: { opacity: isActive ? 1 : 0.4 },
        }),
        Text(
          { variant: "label", color: isActive ? accent : DIM, size: px(0.0145), fontFamily: MONO },
          String(i + 1).padStart(2, "0"),
        ),
        Stack(
          { gap: 2, width: railW - px(0.07) },
          Text(
            { variant: "title", color: isActive ? INK : DIM, size: px(0.023), weight: 600 },
            step.label,
          ),
          Text({ variant: "label", color: DIM, size: px(0.0135), fontFamily: MONO }, step.note),
        ),
      );
    });

    const blockCell = (label: string, value: string, w: number) =>
      Stack(
        { width: w, gap: 4, height: px(0.044), justify: "center" },
        Text({ variant: "label", color: DIM, size: px(0.0115), letterSpacing: 2.5 }, label),
        Text({ variant: "label", color: INK, size: px(0.0165), fontFamily: MONO }, value),
      );

    const blockW = Math.round(width * 0.155);

    return Frame(
      { id: "sheet", width, height, fill: GROUND, style: { opacity: 1 - outP } },
      grid,
      border,

      Stack(
        {
          id: "page",
          width: "fill",
          height: "fill",
          justify: "space-between",
          pad: { x: Math.round(width * 0.062), y: Math.round(height * 0.085) },
        },

        // Masthead.
        Stack(
          {
            direction: "row",
            width: "fill",
            height: px(0.072),
            align: "start",
            justify: "space-between",
            motion: t.motion({ id: "masthead", during: "sheet", y: 14 }),
          },
          Stack(
            { gap: px(0.008) },
            Text(
              { variant: "label", color: accent, size: px(0.0145), weight: 700, letterSpacing: 6 },
              "ARCHITECTURE",
            ),
            Text(
              { variant: "display", color: INK, size: px(0.038), weight: 700, letterSpacing: -0.8 },
              title,
            ),
          ),
          Text(
            { variant: "label", color: DIM, size: px(0.0145), fontFamily: MONO, align: "right" },
            `${system.toUpperCase()} · ${revision}`,
          ),
        ),

        // Rail + plate.
        Stack(
          {
            direction: "row",
            width: "fill",
            height: plateH,
            align: "center",
            justify: "space-between",
          },
          Stack({ width: railW, gap: px(0.018) }, ...rows),
          plate,
        ),

        // Title block.
        Stack(
          {
            width: "fill",
            height: px(0.062),
            gap: px(0.012),
            style: { opacity: std.interpolate(sheetP, [0.6, 1], [0, 1], "easeOutCubic") },
          },
          Frame({ width: "fill", height: 1, fill: HAIR }),
          Stack(
            { direction: "row", width: "fill", height: px(0.044), align: "center", justify: "space-between" },
            Stack(
              { direction: "row", gap: px(0.03), align: "center", height: px(0.044) },
              blockCell("SHEET", "A-01", blockW * 0.5),
              blockCell("PLATE", "request path", blockW),
              blockCell("HIGHLIGHT", "cumulative", blockW * 0.7),
            ),
            Text(
              { variant: "label", color: DIM, size: px(0.0135), fontFamily: MONO, align: "right" },
              `prior steps stay lit · ${(holdP > 0 ? STEPS.length : Math.max(0, activeIndex + 1))}/${STEPS.length}`,
            ),
          ),
        ),
      ),
    );
  },
});
