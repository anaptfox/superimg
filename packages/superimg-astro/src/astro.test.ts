import { describe, expect, it } from "vitest";
import { createMediaIR } from "@superimg/types";
import {
  buildShellPayload,
  posterFragment,
  skeletonFragment,
  islandProps,
} from "./server.js";
import { superimgAstro } from "./vite.js";

const sampleIR = () =>
  createMediaIR({
    sourceId: "astro-demo",
    width: 800,
    height: 450,
    durationSeconds: 1,
    totalFrames: 30,
    phases: [],
  });

describe("@superimg/astro", () => {
  it("shell payload + poster fragment reserves aspect ratio", () => {
    const payload = buildShellPayload(sampleIR(), {
      alt: "astro",
    });
    const html = posterFragment(payload);
    expect(html).toContain("superimg-shell");
    expect(html).toContain("data-superimg-stage");
    expect(html).toContain("aspect-ratio:800 / 450");
    expect(html).toContain("data-superimg-poster");
    expect(islandProps(payload).sourceId).toBe("astro-demo");
  });

  it("skeleton fragment is ratio-correct shimmer shell", () => {
    const payload = buildShellPayload(sampleIR());
    const html = skeletonFragment(payload, { alt: "Loading board" });
    expect(html).toContain("data-superimg-skeleton");
    expect(html).toContain("aspect-ratio:800 / 450");
    expect(html).toContain("Loading board");
  });

  it("posterFragment({ skeleton: true }) uses shimmer content", () => {
    const payload = buildShellPayload(sampleIR());
    const html = posterFragment(payload, { skeleton: true });
    expect(html).toContain("data-superimg-skeleton");
    expect(html).toContain('data-superimg-width="800"');
  });

  it("vite plugin", () => {
    expect(superimgAstro().name).toBe("superimg");
  });
});
