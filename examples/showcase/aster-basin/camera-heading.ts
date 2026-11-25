import { routeSampler } from "./route";

/** Fixed-time quadrature of unwrapped route gaze; pure and seek independent. */
export function createSmoothedAtlasHeading(progressAtSeconds: (seconds: number) => number, windowSeconds = 3.2) {
  const rate = 240, start = 16, end = 25, count = (end - start) * rate;
  const angles: number[] = [], areas: number[] = [0];
  for (let index = 0; index <= count; index++) {
    const route = routeSampler(progressAtSeconds(start + index / rate));
    const angle = Math.atan2(route.ahead.x - route.point.x, route.ahead.z - route.point.z);
    const previous = angles.at(-1);
    angles.push(previous === undefined ? angle : previous + Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous)));
    if (index > 0) areas.push(areas.at(-1)! + (angles[index - 1]! + angles[index]!) / (2 * rate));
  }
  const integral = (seconds: number) => {
    if (seconds <= start) return (seconds - start) * angles[0]!;
    if (seconds >= end) return areas.at(-1)! + (seconds - end) * angles.at(-1)!;
    const frame = (seconds - start) * rate, index = Math.floor(frame), fraction = frame - index;
    const a = angles[index]!, b = angles[index + 1]!;
    return areas[index]! + (a * fraction + (b - a) * fraction * fraction / 2) / rate;
  };
  return (seconds: number) => (integral(seconds + windowSeconds / 2) - integral(seconds - windowSeconds / 2)) / windowSeconds;
}
