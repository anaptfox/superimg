import { vector } from "@foxworth/superimg";
import { cast, ellipse, place, poly, type Series } from "@foxworth/superimg/film";

const ink = "#122b3b";
const paper = "#fcf1d4";
const bubbleFill = "#142f3e";

export const mira = cast("mira", {
  head: { x: 0, y: -61 },
  draw: (t, at, o) => [place(at.x, at.y, [
    ellipse(0, 0, 25, 6, ink, 0.35),
    poly([[-20, -4], [-13, -39], [11, -39], [21, -4]], "#ed8764"),
    ellipse(0, -47, 15, 17, "#ffc695"),
    poly([[-17, -50], [-11, -68], [7, -68], [19, -50]], "#a34a52"),
    ellipse(6, -45, 2, t % 3 < 0.13 ? 0.6 : 2, ink),
  ], o.size ?? 1)],
});

export const pip = cast("pip", {
  w: 7,
  h: 6,
  poses: {
    rest: [
      { fill: "#f0c87a", d: "M2 1h3v1H2z M1 2h5v3H1z M2 5h3v1H2z" },
      { fill: ink, d: "M2 3h1v1H2z M4 3h1v1H4z" },
      { fill: "#ffe2a0", d: "M3 0h1v1H3z M1 2h5v1H1z" },
    ],
    blink: [
      { fill: "#f0c87a", d: "M2 1h3v1H2z M1 2h5v3H1z M2 5h3v1H2z" },
      { fill: ink, d: "M2 3h3v0.4H2z" },
      { fill: "#ffe2a0", d: "M3 0h1v1H3z M1 2h5v1H1z" },
    ],
  },
});

export const lighthouse: Series = {
  stage: { width: 360, height: 640 },
  background: ink,
  cast: [mira, pip],
  bubble: ({ lines, head, t, start, typed, end }) => {
    const x = Math.min(824, Math.max(256, head.x));
    const y = head.y - 204;
    return [vector.group({ opacity: Math.min(1, (t - start) / 0.12, (end + 0.15 - t) / 0.15) },
      vector.polygon({ points: [[x - 40, y + 84], [x + 40, y + 84], [head.x, head.y - 15]], fill: bubbleFill }),
      vector.rect({ x: x - 232, y, width: 464, height: 96, rx: 30, fill: bubbleFill }),
      vector.text({ x, y: y + 61, anchor: "middle", size: 43, family: "system-ui", fill: paper, reveal: Math.min(1, (t - start) / (typed - start)) }, lines.join(" ")),
    )];
  },
  // Paints the film title (the script's first `# heading`) over the first shot.
  drawTitle: (t, title) => [
    vector.text({
      x: 540, y: 300, anchor: "middle", size: 76, family: "Georgia", fill: paper,
      opacity: Math.min(1, t / 0.3) * Math.min(1, Math.max(0, (1.9 - t) / 0.3)),
    }, title),
  ],
  card: ({ lines, attribution }) => [
    vector.text({ x: 540, y: 445, anchor: "middle", size: 67, family: "Georgia", fill: paper }, lines.join(" ")),
    vector.text({ x: 540, y: 531, anchor: "middle", size: 36, family: "system-ui", fill: paper }, attribution ?? ""),
  ],
};
