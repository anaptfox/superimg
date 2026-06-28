//! Type narrowing tests for unified `define()` overloads.

import type {
  DefineInput,
  ImageRenderContext,
  ImageStdlib,
  SvgRenderContext,
  SvgStdlib,
} from "../index.js";
import { define } from "../index.js";

const img = define({
  config: { width: 800, height: 600 },
  render(ctx) {
    type C = typeof ctx;
    type HasWidth = C extends { width: number } ? true : false;
    const _: HasWidth = true;

    // @ts-expect-error - static templates have no temporal fields
    const frame = ctx.globalFrame;

    // @ts-expect-error - no director on static image context
    const tl = ctx.director;

    return "<div/>";
  },
});
const imgMedium: "html" = img.medium;
const imgAnimated: false = img.animated;

const gif = define({
  config: { width: 1280, height: 720, fps: 12, duration: 2 },
  render(ctx) {
    type HasFrame = typeof ctx extends { globalFrame: number } ? true : false;
    const _: HasFrame = true;
    const tl = ctx.director({ hold: "3s", exit: "1s" });
    return `<div>${tl.progress}</div>`;
  },
});
const gifMedium: "html" = gif.medium;
const gifAnimated: true = gif.animated;

const svg = define({
  medium: "svg",
  config: { width: 600, height: 600, duration: 3 },
  render(ctx) {
    type C = typeof ctx;
    type HasDuration = C extends { duration?: number } ? true : false;
    const _: HasDuration = true;

    // @ts-expect-error - static svg has no globalFrame
    const frame = ctx.globalFrame;

    const coords = ctx.std.viz.createCoords({
      width: ctx.width,
      height: ctx.height,
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${ctx.width}" height="${ctx.height}"/>`;
  },
});
const svgMedium: "svg" = svg.medium;
const svgAnimated: false = svg.animated;

// DefineInput is safe to store before calling define() — no ctx: never trap.
const storedInput: DefineInput<{ title: string }> = {
  config: { width: 400, height: 300 },
  sample: { title: "Preview" },
  render(ctx: ImageRenderContext<{ title: string }>) {
    return `<h1>${ctx.data.title}</h1>`;
  },
};
const fromStored = define(storedInput);
const storedAnimated: boolean = fromStored.animated;

// ImageStdlib should be a subset of full Stdlib
const imageStdlibTest: ImageStdlib = {
  math: {} as ImageStdlib["math"],
  color: {} as ImageStdlib["color"],
  text: {} as ImageStdlib["text"],
  css: {} as ImageStdlib["css"],
} as ImageStdlib;

const svgStdlibTest: SvgStdlib = imageStdlibTest;

export const typesVerified = true;
export type { ImageRenderContext, SvgRenderContext };

import { describe, it, expect } from "vitest";

describe("define() type narrowing", () => {
  it("compiles overload checks for html/svg and static/animated axes", () => {
    expect(typesVerified).toBe(true);
    expect(img.medium).toBe("html");
    expect(gif.animated).toBe(true);
    expect(svg.medium).toBe("svg");
    expect(fromStored.animated).toBe(false);
    expect(storedAnimated).toBe(false);
  });
});