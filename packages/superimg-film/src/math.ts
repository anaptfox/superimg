export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const span = (t: number, a: number, b: number) =>
  Number.isFinite(a) && b > a ? clamp((t - a) / (b - a)) : t >= a ? 1 : 0;
export const mix = (a: number, b: number, u: number) => a + (b - a) * u;
export const inOut = (u: number) => u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
export const ease = (t: number, a: number, b: number) => inOut(span(t, a, b));
export const inCubic = (u: number) => u ** 3;
export const outCubic = (u: number) => 1 - (1 - u) ** 3;
export const outBack = (u: number) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;

export function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function mixColor(a: string, b: string, u: number) {
  const full = (hex: string) => /^#[0-9a-f]{3}$/i.test(hex) ? "#" + [...hex.slice(1)].map(c => c + c).join("") : hex;
  const [from, to] = [full(a), full(b)];
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2]
    .map(i => Math.round(mix(channel(from, i), channel(to, i), clamp(u))).toString(16).padStart(2, "0"))
    .join("");
}
