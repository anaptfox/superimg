// Northline — a trail-club badge inked on paper, one stroke at a time.
// The nib is the focal element: it travels the path that is currently drawing.
import { define, Vector, vector, type MediaElement, googleFont } from "@foxworth/superimg";

const PAPER = "#EFE7D6";
const INK = "#20231F";
const VERMILION = "#C4442C";
const SLATE = "#7C8A8C";

const DURATION = 10;

type Stroke = {
  d: string;
  stroke: string;
  width: number;
  /** Relative draw pace. >1 draws slower than its length suggests. */
  drag?: number;
  /** Interior art is clipped to the roundel; the badge rim is not. */
  inside?: boolean;
};

type Scheduled = Stroke & { start: number; end: number };

/** Circle as four cubics so pointAt/tangentAt stay smooth for the nib. */
function circlePath(cx: number, cy: number, r: number): string {
  const k = r * 0.5522847498;
  return [
    `M${cx},${cy - r}`,
    `C${cx + k},${cy - r} ${cx + r},${cy - k} ${cx + r},${cy}`,
    `C${cx + r},${cy + k} ${cx + k},${cy + r} ${cx},${cy + r}`,
    `C${cx - k},${cy + r} ${cx - r},${cy + k} ${cx - r},${cy}`,
    `C${cx - r},${cy - k} ${cx - k},${cy - r} ${cx},${cy - r}`,
  ].join(" ");
}

function ridgePath(points: readonly [number, number][]): string {
  return points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

function rectPath(x: number, y: number, width: number, height: number): string {
  return `M${x},${y}H${x + width}V${y + height}H${x}Z`;
}

/** Height of a polyline at x, so hatching can start beneath the ridge it shades. */
function ridgeYAt(points: readonly [number, number][], x: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    if (x >= x0 && x <= x1) {
      const f = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * f;
    }
  }
  return points[points.length - 1]![1];
}

/**
 * Give every stroke a slice of the ink phase proportional to its length, so the
 * pen keeps a constant speed across the whole drawing instead of racing short
 * strokes and crawling long ones.
 */
function schedule(strokes: readonly Stroke[], lengthOf: (d: string) => number): Scheduled[] {
  const costs = strokes.map((s) => Math.max(24, lengthOf(s.d)) * (s.drag ?? 1));
  const total = costs.reduce((sum, c) => sum + c, 0);
  let cursor = 0;
  return strokes.map((s, i) => {
    const start = cursor / total;
    cursor += costs[i]!;
    return { ...s, start, end: cursor / total };
  });
}

export default define({
  medium: "svg",
  poster: "9.2s",
  sample: {
    wordmark: "NORTHLINE",
    established: "EST. 1971",
    caption: "Trail surveys of the northern range",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: `${DURATION}s`,
    fonts: [googleFont("Fraunces:wght@600"), googleFont("Inter:wght@400;600")],
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({ ink: "50%", wash: "12%", type: "18%", hold: "20%" });

    // Two-column editorial frame: the badge sits on the left third, type on the right.
    const badgeX = width * 0.335;
    const badgeY = height * 0.5;
    const R = height * 0.3;
    const horizonY = badgeY + R * 0.34;
    const sunX = badgeX + R * 0.3;
    const sunY = badgeY - R * 0.3;
    const sunR = R * 0.19;

    // Interior lines overshoot the rim on purpose; the badge clip trims them so
    // every stroke meets the roundel instead of stopping mid-air.
    const farRidge: [number, number][] = [
      [badgeX - R * 0.98, horizonY],
      [badgeX - R * 0.46, horizonY - R * 0.44],
      [badgeX - R * 0.24, horizonY - R * 0.2],
      [badgeX - R * 0.02, horizonY - R * 0.58],
      [badgeX + R * 0.3, horizonY - R * 0.16],
      [badgeX + R * 0.55, horizonY - R * 0.34],
      [badgeX + R * 0.98, horizonY],
    ];
    const nearRidge: [number, number][] = [
      [badgeX - R * 1.02, horizonY + R * 0.34],
      [badgeX - R * 0.52, horizonY - R * 0.16],
      [badgeX - R * 0.3, horizonY + R * 0.06],
      [badgeX + R * 0.06, horizonY - R * 0.3],
      [badgeX + R * 0.42, horizonY + R * 0.1],
      [badgeX + R * 1.02, horizonY + R * 0.34],
    ];

    const rayCount = 7;
    const rays: Stroke[] = [];
    for (let i = 0; i < rayCount; i++) {
      const a = Math.PI + (i / (rayCount - 1)) * Math.PI;
      const inner = sunR * 1.35;
      const outer = sunR * 1.9;
      rays.push({
        d: `M${(sunX + Math.cos(a) * inner).toFixed(2)},${(sunY + Math.sin(a) * inner).toFixed(2)} L${(sunX + Math.cos(a) * outer).toFixed(2)},${(sunY + Math.sin(a) * outer).toFixed(2)}`,
        stroke: VERMILION,
        width: 4,
        drag: 3.2,
        inside: true,
      });
    }

    // Drawing order is the narrative: frame, then subject, then detail.
    const strokes: Stroke[] = [
      { d: circlePath(badgeX, badgeY, R), stroke: INK, width: 3 },
      { d: circlePath(badgeX, badgeY, R * 0.86), stroke: SLATE, width: 1.4, inside: true },
      {
        d: `M${(badgeX - R * 0.95).toFixed(2)},${horizonY.toFixed(2)} L${(badgeX + R * 0.95).toFixed(2)},${horizonY.toFixed(2)}`,
        stroke: SLATE,
        width: 1.6,
        drag: 0.7,
        inside: true,
      },
      { d: ridgePath(farRidge), stroke: SLATE, width: 3, drag: 0.9, inside: true },
      { d: ridgePath(nearRidge), stroke: INK, width: 5.5, inside: true },
      { d: circlePath(sunX, sunY, sunR), stroke: VERMILION, width: 4.5, drag: 1.4, inside: true },
      ...rays,
    ];

    const lengthOf = (d: string) => Number(std.svg.draw(d, 1).strokeDasharray) || 0;
    const scheduled = schedule(strokes, lengthOf);
    const inkP = std.interpolate(t.in("ink"), [0, 1], [0, 1], "easeInOutSine");

    let nib: MediaElement | null = null;
    const rimEls: MediaElement[] = [];
    const insideEls: MediaElement[] = [];
    for (const [strokeIndex, s] of scheduled.entries()) {
      const span = Math.max(0.0001, s.end - s.start);
      const local = std.clamp01((inkP - s.start) / span);
      // A round cap on a zero-length dash still paints a dot, so unstarted
      // strokes must be omitted entirely rather than drawn at offset 0.
      if (local <= 0.0005) continue;
      // The dash and nib share arc-length progress; easing only one separates them.
      const drawn = std.svg.draw(s.d, local);
      if (local < 0.999 && t.in("ink") < 1) {
        const p = std.svg.bezier.pointAt(s.d, local);
        // A held pen keeps its angle; only its tip follows the line.
        nib = vector.group(
          { id: "pen-nib", transform: `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(-28)` },
          vector.path({ d: "M0,0 L-9,-38 L0,-58 L9,-38 Z", fill: INK }),
          vector.path({ d: "M0,-10 L0,-40", fill: "none", stroke: PAPER, strokeWidth: 2.4 }),
          vector.path({ d: std.svg.shape.roundedRect(-11, -84, 22, 30, 6), fill: INK, opacity: 0.9 }),
          vector.path({ d: std.svg.shape.circle(0, 0, 3.4), fill: VERMILION }),
        );
      }
      (s.inside ? insideEls : rimEls).push(
        vector.path({
          id: `ink-stroke-${strokeIndex}`,
          d: s.d,
          fill: "none",
          stroke: s.stroke,
          strokeWidth: s.width,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeDasharray: drawn.strokeDasharray,
          strokeDashoffset: drawn.strokeDashoffset,
        }),
      );
    }

    // Hatch wash: ink first, then the shading, drawn left to right under the peaks.
    const hatchCount = 26;
    const hatchLines: MediaElement[] = [];
    const hatchPs = std.stagger.ms(hatchCount, t.in("wash"), {
      windowSeconds: DURATION * 0.12,
      eachMs: 14,
      capMs: 420,
      from: "start",
    });
    for (let i = 0; i < hatchCount; i++) {
      const p = std.clamp01(hatchPs[i] ?? 0);
      if (p <= 0) continue;
      const x = badgeX - R * 0.82 + (i / (hatchCount - 1)) * R * 1.64;
      const top = ridgeYAt(nearRidge, x) + 6;
      const len = (R * 0.5 + R * 0.14 * Math.sin(i * 1.9)) * std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
      hatchLines.push(vector.path({
        id: `hatch-${i}`,
        d: `M${x.toFixed(2)},${top.toFixed(2)}L${(x - len * 0.4).toFixed(2)},${(top + len).toFixed(2)}`,
        fill: "none",
        stroke: SLATE,
        strokeWidth: 1.5,
        opacity: 0.45,
      }));
    }

    // Type arrives after the ink: each line rises out from behind its own clip edge.
    const typeX = width * 0.55;
    const typeRoom = width * 0.88 - typeX;
    // Measure rather than eyeball, so a longer wordmark stays inside title-safe.
    const wordSize = std.svg.fitText(data.wordmark, { width: typeRoom, height: 120 }, {
      letterSpacing: 2,
      maxSize: 96,
      minSize: 40,
    }).fontSize;

    const lineReveal = (phaseP: number, delay: number) =>
      std.interpolate(phaseP, [delay, Math.min(1, delay + 0.55)], [0, 1], "easeOutCubic");
    const wordP = lineReveal(t.in("type"), 0);
    const estP = lineReveal(t.in("type"), 0.22);
    const capP = lineReveal(t.in("type"), 0.42);
    const ruleP = std.interpolate(t.in("type"), [0.12, 0.8], [0, 1], "easeOutCubic");

    const wordY = height * 0.44;
    const estY = height * 0.53;
    const ruleY = height * 0.585;
    const capY = height * 0.645;
    const ruleLen = typeRoom * 0.72;

    // Settled lockup breathes: the vermilion diamond is the only thing still moving.
    const breath = 1 + 0.05 * Math.sin(timeline.seconds * Math.PI * 0.9) * t.in("hold");
    const diamondX = typeX + ruleLen * 0.5;

    // The clip edge sits on the baseline, so a line translated by its own cap
    // height is fully hidden until its reveal starts.
    const clipLine = (id: string, y: number, size: number) =>
      vector.clip(
        { id },
        vector.path({
          d: rectPath(typeX - 24, y - size * 1.3, width, size * 1.3 + 3),
          fill: "#fff",
        }),
      );
    const rise = (p: number, size: number) =>
      std.interpolate(p, [0, 1], [size * 1.05, 0], "easeOutCubic");

    return Vector(
      { id: "northline-lockup", width, height, viewBox: { x: 0, y: 0, width, height } },
      vector.defs(
        clipLine("clip-word", wordY, wordSize),
        clipLine("clip-established", estY, 22),
        clipLine("clip-caption", capY, 26),
        vector.clip(
          { id: "badge-window" },
          vector.path({ d: std.svg.shape.circle(badgeX, badgeY, R * 0.9), fill: "#fff" }),
        ),
      ),
      vector.path({ id: "paper", d: rectPath(0, 0, width, height), fill: PAPER }),
      vector.path({
        id: "paper-vignette",
        d: std.svg.shape.circle(width * 0.42, height * 0.46, width * 0.72),
        fill: "none",
        stroke: "#B9AD95",
        strokeWidth: Math.max(width, height) * 0.22,
        opacity: 0.16,
      }),
      vector.group(
        { id: "registration-marks", opacity: 0.55 },
        vector.path({ d: "M96,64 L96,104 M96,64 L136,64", fill: "none", stroke: SLATE, strokeWidth: 1.2 }),
        vector.path({ d: `M${width - 96},64 L${width - 96},104 M${width - 96},64 L${width - 136},64`, fill: "none", stroke: SLATE, strokeWidth: 1.2 }),
        vector.path({ d: `M96,${height - 64} L96,${height - 104} M96,${height - 64} L136,${height - 64}`, fill: "none", stroke: SLATE, strokeWidth: 1.2 }),
        vector.path({ d: `M${width - 96},${height - 64} L${width - 96},${height - 104} M${width - 96},${height - 64} L${width - 136},${height - 64}`, fill: "none", stroke: SLATE, strokeWidth: 1.2 }),
      ),
      vector.group({ id: "badge-interior", clip: "badge-window" }, ...hatchLines, ...insideEls),
      ...rimEls,
      ...(nib ? [nib] : []),
      vector.group(
        { id: "wordmark-reveal", clip: "clip-word" },
        vector.text(
          {
            x: typeX,
            y: wordY + rise(wordP, wordSize),
            family: "Fraunces, Georgia, serif",
            size: wordSize,
            weight: 600,
            fill: INK,
            letterSpacing: 2,
          },
          data.wordmark,
        ),
      ),
      vector.group(
        { id: "established-reveal", clip: "clip-established" },
        vector.text(
          {
            x: typeX,
            y: estY + rise(estP, 22),
            family: "Inter, sans-serif",
            size: 22,
            weight: 600,
            fill: VERMILION,
            letterSpacing: 9,
          },
          data.established,
        ),
      ),
      vector.path({
        id: "wordmark-rule",
        d: `M${typeX},${ruleY}H${typeX + ruleLen}`,
        fill: "none",
        stroke: INK,
        strokeWidth: 1.4,
        strokeDasharray: ruleLen,
        strokeDashoffset: ruleLen * (1 - ruleP),
        opacity: 0.8 * ruleP,
      }),
      vector.group(
        { id: "wordmark-diamond", transform: { scale: breath, originX: diamondX, originY: ruleY } },
        vector.path({
          d: `M${diamondX},${ruleY - 9}L${diamondX + 7},${ruleY}L${diamondX},${ruleY + 9}L${diamondX - 7},${ruleY}Z`,
          fill: VERMILION,
          opacity: ruleP,
        }),
      ),
      vector.group(
        { id: "caption-reveal", clip: "clip-caption" },
        vector.text(
          {
            x: typeX,
            y: capY + rise(capP, 26),
            family: "Inter, sans-serif",
            size: 26,
            weight: 400,
            fill: SLATE,
          },
          data.caption,
        ),
      ),
    );
  },
});
