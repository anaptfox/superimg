export type Matrix = readonly [number, number, number, number, number, number];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
export class BadTransform extends Error {}

export const apply = (m: Matrix, x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

/** The SVG string a typed `transform` object lowers to: translate, rotate, scale. */
export function typedTransform(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  const t = value as Record<string, unknown>;
  const n = (v: unknown, fallback = 0) => typeof v === "number" ? v : fallback;
  const scale = typeof t.scale === "number" ? t.scale : 1;
  const parts: string[] = [];
  if (n(t.x) !== 0 || n(t.y) !== 0) parts.push(`translate(${n(t.x)} ${n(t.y)})`);
  if (n(t.rotate) !== 0) parts.push(`rotate(${n(t.rotate)} ${n(t.originX)} ${n(t.originY)})`);
  const scaleX = n(t.scaleX, scale);
  const scaleY = n(t.scaleY, scale);
  if (scaleX !== 1 || scaleY !== 1) parts.push(`scale(${scaleX} ${scaleY})`);
  return parts.join(" ") || undefined;
}

export const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

export function parseTransform(value: unknown, source = String(value)): Matrix {
  if (value === undefined || value === "") return IDENTITY;
  let matrix = IDENTITY;
  const calls = String(value).matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g);
  let consumed = 0;
  for (const call of calls) {
    consumed += call[0].length;
    const n = call[2]!.split(/[\s,]+/).filter(Boolean).map(Number);
    if (n.some(v => !Number.isFinite(v))) throw new BadTransform(source);
    const [a = 0, b, c, d, e, f] = n;
    let next: Matrix;
    switch (call[1]) {
      case "translate": next = [1, 0, 0, 1, a, b ?? 0]; break;
      case "scale": next = [a, 0, 0, b ?? a, 0, 0]; break;
      case "rotate": {
        const r = a * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r), cx = b ?? 0, cy = c ?? 0;
        next = [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
        break;
      }
      case "matrix": next = [a, b ?? 0, c ?? 0, d ?? 1, e ?? 0, f ?? 0]; break;
      case "skewX": next = [1, 0, Math.tan(a * Math.PI / 180), 1, 0, 0]; break;
      case "skewY": next = [1, Math.tan(a * Math.PI / 180), 0, 1, 0, 0]; break;
      default: throw new BadTransform(source);
    }
    matrix = mul(matrix, next);
  }
  if (consumed === 0) throw new BadTransform(source);
  return matrix;
}

