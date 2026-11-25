import { describe, expect, it } from "vitest";
import { image, video } from "@superimg/types";
import { assertArrangementDestinations, assertArrangementEditions, resolveArrangementStillSelection } from "./arrangement-selection.js";

const landscape = image({ size: { width: 1920, height: 1080 }, render: () => null as never });

describe("shared arrangement selection", () => {
  it("allows matching aspect resizing and only explicitly authored alternate aspects", () => {
    expect(() => assertArrangementDestinations(landscape, ["1280x720.png"])).not.toThrow();
    expect(() => assertArrangementDestinations(landscape, [{ id: "still", format: "png", width: 1080, height: 1080 }])).toThrow(/matching arrangement aspect/);
    const editions = image({ size: { width: 1920, height: 1080 }, editions: { square: { size: { width: 1080, height: 1080 } } }, render: () => null as never });
    expect(() => assertArrangementDestinations(editions, ["1080x1080.png"])).not.toThrow();
    expect(() => assertArrangementDestinations(editions, ["1080x1080.png"], ["default"])).toThrow(/matching arrangement aspect/);
    expect(() => assertArrangementEditions(editions, ["portrait"])).toThrow(/Unknown arrangement edition/);
  });

  it("uses seconds, the actual frame rate, explicit zero, and clamp evidence", () => {
    const media = video({ fps: 25, duration: "3s", poster: "2s", render: () => null as never });
    expect(resolveArrangementStillSelection(media)).toMatchObject({ frame: 50, encodedSeconds: 2, fps: 25, totalFrames: 75, origin: "pattern-poster" });
    expect(resolveArrangementStillSelection(media, 0)).toMatchObject({ frame: 0, origin: "explicit" });
    expect(resolveArrangementStillSelection(media, 0.5)).toMatchObject({ frame: 13, encodedSeconds: 0.52 });
    expect(resolveArrangementStillSelection(media, 99)).toMatchObject({ requestedSeconds: 99, frame: 74, encodedSeconds: 2.96, clamped: true });
    expect(() => resolveArrangementStillSelection(media, -1)).toThrow(/non-negative/);
  });

  it("does not invent an answer poster for one-frame media, and accepts static media", () => {
    const media = video({ fps: 24, duration: "1f", render: () => null as never });
    expect(() => resolveArrangementStillSelection(media)).toThrow(/No answer poster/);
    expect(resolveArrangementStillSelection(media, 0)).toMatchObject({ frame: 0, totalFrames: 1 });
    expect(resolveArrangementStillSelection(landscape)).toMatchObject({ frame: 0, totalFrames: 1, origin: "static" });
  });
});
