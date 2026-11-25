import { Html, source, sequence, time, together, video } from "@foxworth/superimg";

const svgBytes = new TextEncoder().encode(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#101827"/>
  <circle cx="200" cy="200" r="140" fill="#f59e0b"/>
  <circle cx="200" cy="200" r="80" fill="#101827"/>
</svg>`);

const icon = source.svg({
  src: { bytes: svgBytes, mimeType: "image/svg+xml" },
  size: { width: 400, height: 400 },
});
const poster = source.image({
  src: { bytes: svgBytes, mimeType: "image/svg+xml" },
  size: { width: 400, height: 400 },
});
const caption = video({
  size: { width: 1280, height: 720 }, fps: 30, duration: "1s",
  render(ctx) {
    return Html({ html: `<div style="width:1280px;height:720px;background:#101827;color:#fff;display:grid;place-items:center;font:700 72px system-ui">Frame ${ctx.timeline.frame}</div>` });
  },
});

const comparison = together([
  { id: "vector", content: icon, hold: "1s", rect: { x: 0, y: 0, width: 600, height: 600 }, fit: "contain" },
  { id: "raster", content: poster, hold: "1s", rect: { x: 600, y: 0, width: 600, height: 600 }, fit: "contain" },
], { end: "hold", size: { width: 1200, height: 600 } });

const story = sequence([
  { id: "comparison", content: comparison, hold: "2s", fit: "contain" },
  { id: "caption", content: caption },
]);

export default time(story, { size: { width: 1280, height: 720 }, fps: 24 });
