// One reusable SVG document with an independently editable planet.
import { svg, svgDocument, SvgArtwork } from "@foxworth/superimg";

const artwork = svgDocument(new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240">
  <rect width="400" height="240" fill="#0b1424"/>
  <ellipse cx="200" cy="120" rx="150" ry="70" fill="none" stroke="#829db6" stroke-width="2"/>
  <circle id="planet" cx="200" cy="120" r="42" fill="#55b9a5"/>
  <circle cx="98" cy="68" r="6" fill="#f8e8b3"/>
</svg>`));

export default svg({
  size: { width: 1200, height: 720 },
  sample: { planet: "#55b9a5" },
  render: ({ data, width, height }) => SvgArtwork({ document: artwork, id: "orbit", width, height, edits: { planet: { fill: data.planet } } }),
});
