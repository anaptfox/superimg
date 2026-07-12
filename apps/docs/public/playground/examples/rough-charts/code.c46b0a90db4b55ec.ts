import { define } from "superimg";

const DATA = [
  { label: "A", value: 42 },
  { label: "B", value: 68 },
  { label: "C", value: 35 },
  { label: "D", value: 80 },
  { label: "E", value: 55 },
];

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "5s",
    fonts: ["Inter:wght@400;600;700"],
  },
  render(ctx) {
    const { std, width, height } = ctx;
    const viz = std.viz;
    const rough = std.svg.rough;
    const t = ctx.director({ intro: "15%", bars: "60%", hold: "25%" });

    const coords = viz.createCoords({
      width,
      height,
      xRange: [0, DATA.length],
      yRange: [0, 100],
      padding: { top: 160, bottom: 120, left: 140, right: 100 },
    });

    const area = {
      left: coords.plotLeft,
      top: coords.plotTop,
      width: coords.plotWidth,
      height: coords.plotHeight,
    };
    const yMin = 0;
    const yMax = 100;
    const barW = (area.width / DATA.length) * 0.55;
    const gap = (area.width / DATA.length) * 0.45;
    const progress = t.in("bars");

    // Roughen stable full-height rects; grow with opacity + clip (avoid boiling re-rough)
    const bars = DATA.map((d, i) => {
      const bx = area.left + i * (barW + gap) + gap / 2;
      const hFull = ((d.value - yMin) / (yMax - yMin)) * area.height;
      const by = area.top + area.height - hFull;
      const mark = rough.rect(bx, by, barW, hFull, {
        seed: 100 + i,
        fill: "#5b8cff",
        fillStyle: "hachure",
        stroke: "#93c5fd",
        strokeWidth: 1.2,
        roughness: 1.15,
      });
      // Clip grow from baseline
      const clipH = hFull * progress;
      const clipY = area.top + area.height - clipH;
      const clipId = `rough-bar-${i}`;
      return `<defs><clipPath id="${clipId}"><rect x="${bx}" y="${clipY}" width="${barW}" height="${clipH}"/></clipPath></defs><g clip-path="url(#${clipId})">${mark}</g>`;
    }).join("\n");

    const gridEl = viz.grid(coords, { color: "#1e2640", ticks: 5, progress: t.in("intro") });
    const axesEl = viz.axes(coords, { color: "#3d4a68", ticks: 5, progress: t.in("intro") });
    const titleOp = t.in("intro");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <text x="90" y="90" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="#5b8cff" letter-spacing="6" opacity="${titleOp.toFixed(3)}">ROUGH CHARTS</text>
  <text x="90" y="140" font-family="Inter,sans-serif" font-size="44" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">D3 layout · Rough marks</text>
  ${gridEl}
  ${axesEl}
  ${bars}
  <text x="${width / 2}" y="${height - 40}" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${t.in("hold").toFixed(3)}">seeded rough · clip grow · no re-rough per frame</text>
</svg>`;
  },
});
