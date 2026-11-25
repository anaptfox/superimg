import type { RenderContext } from "@foxworth/superimg";

type Plan = { readonly acts: Readonly<Record<string, readonly [number, number]>>; readonly cues: Readonly<Record<string, readonly [number, number]>> };
const directorFor = (ctx: RenderContext, plan: Plan) => ctx.director(plan);
export type DirectorFactory = (clock: { timeline: RenderContext["timeline"] }, plan: Plan) => ReturnType<typeof directorFor>;
export type RadToDeg = RenderContext["std"]["math"]["radToDeg"];
export type Oscillate = RenderContext["std"]["oscillate"];

/** Sample an authored plan at its own clock through the public clip API.
 * Negative/outside windows intentionally offset the parent clock; no time is
 * read from the browser. This lets Peg hold while the little scene keeps moving.
 */
export function sampleDirector(ctx: RenderContext): DirectorFactory {
  return ({ timeline }, plan) => {
    const start = ctx.timeline.seconds - timeline.seconds;
    return ctx.director().clip({ during: [start, start + timeline.durationSeconds] }).director(plan);
  };
}
