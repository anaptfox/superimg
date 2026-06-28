import { define } from "superimg";

/** US streaming subscribers (millions) — illustrative Q1→Q4 arc with a late upset */
const KEYFRAMES = [
  {
    time: 0,
    rankings: [
      { label: "Netflix", value: 92 },
      { label: "Disney+", value: 78 },
      { label: "Max", value: 55 },
      { label: "Hulu", value: 48 },
      { label: "Apple TV+", value: 42 },
    ],
  },
  {
    time: 1.5,
    rankings: [
      { label: "Netflix", value: 90 },
      { label: "Disney+", value: 82 },
      { label: "Max", value: 68 },
      { label: "Hulu", value: 50 },
      { label: "Apple TV+", value: 44 },
    ],
  },
  {
    time: 3,
    rankings: [
      { label: "Netflix", value: 88 },
      { label: "Disney+", value: 85 },
      { label: "Max", value: 78 },
      { label: "Hulu", value: 52 },
      { label: "Apple TV+", value: 46 },
    ],
  },
  {
    time: 4.5,
    rankings: [
      { label: "Netflix", value: 87 },
      { label: "Max", value: 86 },
      { label: "Disney+", value: 84 },
      { label: "Hulu", value: 53 },
      { label: "Apple TV+", value: 47 },
    ],
  },
  {
    time: 6,
    rankings: [
      { label: "Max", value: 94 },
      { label: "Netflix", value: 90 },
      { label: "Disney+", value: 87 },
      { label: "Hulu", value: 54 },
      { label: "Apple TV+", value: 49 },
    ],
  },
];

const BRAND_COLORS: Record<string, string> = {
  Netflix: "#E50914",
  "Disney+": "#113CCF",
  Max: "#002BE7",
  Hulu: "#1CE783",
  "Apple TV+": "#A2AAAD",
};

const RACE_END = KEYFRAMES[KEYFRAMES.length - 1]!.time;

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    // 8s scene: 0.8s intro + 6s race (1:1 with keyframes) + 1.2s hold on final frame
    duration: "8s",
    fonts: ["Inter:wght@400;600;700"],
  },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const viz = std.viz;
    const t = ctx.director({ intro: "10%", race: "75%", hold: "15%" });
    // Drive keyframes from the race phase (0→RACE_END), not raw timeline.seconds —
    // wall clock stops at duration−1/fps, which never reaches the last keyframe time.
    const raceTime = t.at("race", RACE_END);

    const coords = viz.createCoords({
      width,
      height,
      xRange: [0, 100],
      yRange: [0, 5],
      padding: { top: 160, bottom: 80, left: 220, right: 120 },
    });

    const gridEl = viz.grid(coords, { color: "#1e2640", ticks: 5, progress: t.in("intro") });
    const axesEl = viz.axes(coords, { color: "#3d4a68", ticks: 5, progress: t.in("intro") });
    const raceEl = viz.charts.barRace(coords, KEYFRAMES, raceTime, {
      showLabels: true,
      showValueLabels: true,
      barRadius: 6,
      colorByLabel: BRAND_COLORS,
      emphasizeLeader: true,
    });

    const titleOp = std.interpolate(timeline.progress, [0, 0.08, 0.92, 1], [0, 1, 1, 0]);
    const inHold = t.in("hold") > 0;
    const outcomeOp = std.interpolate(t.in("hold"), [0, 0.2, 1], [0, 1, 1]);
    const footnoteOp = std.interpolate(t.in("race"), [0, 0.15, 1], [0, 0.75, 0.75]);
    const caption = inHold
      ? "Max overtakes Netflix in Q4"
      : "Subscribers (M) · illustrative";
    const captionOp = inHold ? outcomeOp : footnoteOp;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <text x="90" y="90" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="#6b7795" letter-spacing="4" opacity="${titleOp.toFixed(3)}">Q1 → Q4 2025</text>
  <text x="90" y="140" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">US streaming subscribers</text>
  ${gridEl}
  ${axesEl}
  ${raceEl}
  <text x="${width / 2}" y="${height - 40}" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${captionOp.toFixed(3)}">${caption}</text>
</svg>`;
  },
});