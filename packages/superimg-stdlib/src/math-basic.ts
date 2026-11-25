/** Small deterministic math core used by the browser clock/director graph. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
export const inverseLerp = (a: number, b: number, value: number): number =>
  a === b ? 0 : (value - a) / (b - a);
export const mapClamp = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => lerp(outMin, outMax, clamp(inverseLerp(inMin, inMax, value), 0, 1));
export const map = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
export const degToRad = (degrees: number): number => degrees * (Math.PI / 180);
export const radToDeg = (radians: number): number => radians * (180 / Math.PI);
export const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const step = (edge: number, value: number): number => value < edge ? 0 : 1;
export const fract = (value: number): number => value - Math.floor(value);
export const sign = (value: number): number => value > 0 ? 1 : value < 0 ? -1 : 0;
export const repeat = (value: number, length: number): number =>
  clamp(value - Math.floor(value / length) * length, 0, length);
export const pingPong = (value: number, length: number): number => {
  const repeated = repeat(value, length * 2);
  return length - Math.abs(repeated - length);
};
