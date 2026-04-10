/**
 * SVG shape generators — return path d strings.
 * Designed for compatibility with morph().
 */

const { PI, cos, sin, round } = Math;
const TAU = PI * 2;

function r3(n: number): number {
  return round(n * 1000) / 1000;
}

/** Circle as SVG path (4 cubic bezier arcs) */
function circle(cx: number, cy: number, r: number): string {
  // Magic number for cubic bezier circle approximation
  const k = r * 0.5522847498;
  return [
    `M${r3(cx)},${r3(cy - r)}`,
    `C${r3(cx + k)},${r3(cy - r)} ${r3(cx + r)},${r3(cy - k)} ${r3(cx + r)},${r3(cy)}`,
    `C${r3(cx + r)},${r3(cy + k)} ${r3(cx + k)},${r3(cy + r)} ${r3(cx)},${r3(cy + r)}`,
    `C${r3(cx - k)},${r3(cy + r)} ${r3(cx - r)},${r3(cy + k)} ${r3(cx - r)},${r3(cy)}`,
    `C${r3(cx - r)},${r3(cy - k)} ${r3(cx - k)},${r3(cy - r)} ${r3(cx)},${r3(cy - r)}`,
    "Z",
  ].join(" ");
}

/** Star shape with alternating inner/outer vertices */
function star(
  cx: number, cy: number,
  outerR: number, innerR: number,
  points: number,
): string {
  const verts: string[] = [];
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * TAU - PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + cos(angle) * r;
    const y = cy + sin(angle) * r;
    verts.push(`${i === 0 ? "M" : "L"}${r3(x)},${r3(y)}`);
  }
  verts.push("Z");
  return verts.join(" ");
}

/** Regular polygon */
function polygon(cx: number, cy: number, r: number, sides: number): string {
  const verts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * TAU - PI / 2;
    const x = cx + cos(angle) * r;
    const y = cy + sin(angle) * r;
    verts.push(`${i === 0 ? "M" : "L"}${r3(x)},${r3(y)}`);
  }
  verts.push("Z");
  return verts.join(" ");
}

/** Sine wave path */
function wave(
  width: number,
  height: number,
  amplitude: number,
  frequency: number,
  phase: number = 0,
): string {
  const cy = height / 2;
  const steps = Math.max(Math.ceil(frequency * 20), 40);
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * width;
    const y = cy + sin(t * TAU * frequency + phase) * amplitude;
    parts.push(`${i === 0 ? "M" : "L"}${r3(x)},${r3(y)}`);
  }
  return parts.join(" ");
}

/** Circular arc segment */
function arc(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
): string {
  const startRad = (startAngle * PI) / 180;
  const endRad = (endAngle * PI) / 180;
  const x1 = cx + cos(startRad) * r;
  const y1 = cy + sin(startRad) * r;
  const x2 = cx + cos(endRad) * r;
  const y2 = cy + sin(endRad) * r;

  let sweep = endAngle - startAngle;
  if (sweep < 0) sweep += 360;
  const largeArc = sweep > 180 ? 1 : 0;

  return `M${r3(x1)},${r3(y1)} A${r3(r)},${r3(r)} 0 ${largeArc} 1 ${r3(x2)},${r3(y2)}`;
}

/** Rounded rectangle */
function roundedRect(
  x: number, y: number,
  w: number, h: number,
  r: number,
): string {
  r = Math.min(r, w / 2, h / 2);
  return [
    `M${r3(x + r)},${r3(y)}`,
    `L${r3(x + w - r)},${r3(y)}`,
    `Q${r3(x + w)},${r3(y)} ${r3(x + w)},${r3(y + r)}`,
    `L${r3(x + w)},${r3(y + h - r)}`,
    `Q${r3(x + w)},${r3(y + h)} ${r3(x + w - r)},${r3(y + h)}`,
    `L${r3(x + r)},${r3(y + h)}`,
    `Q${r3(x)},${r3(y + h)} ${r3(x)},${r3(y + h - r)}`,
    `L${r3(x)},${r3(y + r)}`,
    `Q${r3(x)},${r3(y)} ${r3(x + r)},${r3(y)}`,
    "Z",
  ].join(" ");
}

export const shape = { circle, star, polygon, wave, arc, roundedRect };
