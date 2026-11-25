import { describe, expect, it } from "vitest";
import { arrange } from "@superimg/stdlib/arrange";
import { isMediaElement } from "@superimg/stdlib/tree";
import type { MediaChild, MediaElement } from "@superimg/stdlib/tree";
import {
  dailyReportMedia,
  dailyReportSample,
  dailyReportSpec,
  eventStoryMedia,
  eventStoryPhase,
  eventStorySample,
  eventStorySpec,
} from "./views.js";

function findById(node: MediaChild, id: string): MediaElement | undefined {
  if (!isMediaElement(node)) return undefined;
  if (node.props.id === id) return node;
  for (const child of node.children) {
    const hit = findById(child, id);
    if (hit) return hit;
  }
  return undefined;
}

describe("eventStorySpec", () => {
  it("lowers onto alignedIntervals and passes arrange.check", () => {
    const spec = eventStorySpec(eventStorySample, "reveal");
    expect(arrange.check.alignedIntervals(spec)).toEqual([]);
    const tree = arrange.alignedIntervals(spec);
    expect(tree.props.id).toBe("arrangement");
    expect(findById(tree, "hotfix-0")).toBeDefined();
  });

  it("keeps the last event as a tick during predict", () => {
    const predict = arrange.alignedIntervals(eventStorySpec(eventStorySample, "predict"));
    const reveal = arrange.alignedIntervals(eventStorySpec(eventStorySample, "reveal"));
    expect(findById(predict, "hotfix-0")?.props.width).toBe(3);
    expect(Number(findById(reveal, "hotfix-0")?.props.width)).toBeGreaterThan(3);
    expect(findById(arrange.alignedIntervals(eventStorySpec(eventStorySample, "hold")), "hotfix-0")).toBeUndefined();
  });

  it("maps progress onto hold / predict / reveal", () => {
    expect(eventStoryPhase(0)).toBe("hold");
    expect(eventStoryPhase(0.4)).toBe("predict");
    expect(eventStoryPhase(0.9)).toBe("reveal");
  });
});

describe("stock view canvases", () => {
  it("authors chat stills at 1080×1080 with a square edition", () => {
    expect(eventStoryMedia.config).toMatchObject({ width: 1080, height: 1080 });
    expect(eventStoryMedia.editions?.square?.size).toEqual({ width: 1080, height: 1080 });
    expect(dailyReportMedia.config).toMatchObject({ width: 1080, height: 1080 });
    expect(dailyReportMedia.editions?.square?.size).toEqual({ width: 1080, height: 1080 });
  });
});

describe("dailyReportSpec", () => {
  it("lowers onto valueAgainstReference and passes arrange.check", () => {
    const spec = dailyReportSpec(dailyReportSample);
    expect(arrange.check.valueAgainstReference(spec)).toEqual([]);
    const tree = arrange.valueAgainstReference(spec);
    expect(tree.props.id).toBe("arrangement");
    expect(findById(tree, "bar-users")).toBeDefined();
  });
});
