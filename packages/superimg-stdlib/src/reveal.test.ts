import { describe, expect, it } from "vitest";
import { crossfade, curtain, handoffLocal, iris, split, wipe } from "./reveal.js";

describe("reveal.wipe (cover overlay)", () => {
  it("is fully covering at progress 0", () => {
    const result = wipe({ progress: 0, direction: "right", color: "#000" });
    expect(result.html).toContain("clip-path");
    expect(result.html).not.toContain("polygon(100% 0, 100% 0");
    expect(result.active).toBe(true);
    expect(result.progress).toBe(0);
  });

  it("is fully revealed at progress 1", () => {
    const result = wipe({ progress: 1, direction: "right", color: "#000" });
    expect(result.active).toBe(false);
    expect(result.progress).toBe(1);
  });

  it("diagonal wipe shrinks cover between 0 and 1", () => {
    const start = wipe({ progress: 0, direction: "diagonal" }).html;
    const mid = wipe({ progress: 0.5, direction: "diagonal" }).html;
    const end = wipe({ progress: 1, direction: "diagonal" }).html;
    expect(start).not.toBe(mid);
    expect(mid).not.toBe(end);
  });
});

describe("reveal.curtain (uncover overlay)", () => {
  it("is hidden at progress 0", () => {
    const result = curtain({ progress: 0, direction: "up" });
    expect(result.html).toContain("inset(100%");
    expect(result.active).toBe(false);
  });

  it("is fully covering at progress 1", () => {
    const result = curtain({ progress: 1, direction: "up" });
    expect(result.html).toContain("inset(0%");
    expect(result.active).toBe(true);
  });
});

describe("reveal.iris (cover overlay)", () => {
  it("has large radius at progress 0", () => {
    const result = iris({ progress: 0 });
    expect(result.html).toContain("circle(75%");
    expect(result.active).toBe(true);
  });

  it("has zero radius at progress 1", () => {
    const result = iris({ progress: 1 });
    expect(result.html).toContain("circle(0%");
    expect(result.active).toBe(false);
  });
});

describe("reveal.split", () => {
  it("shows from at progress 0", () => {
    const result = split({ from: "<div>FROM</div>", to: "<div>TO</div>", progress: 0 });
    expect(result.html).toContain("FROM");
    expect(result.active).toBe(false);
  });

  it("shows to at progress 1", () => {
    const result = split({ from: "<div>FROM</div>", to: "<div>TO</div>", progress: 1 });
    expect(result.html).toContain("TO");
    expect(result.active).toBe(false);
  });
});

describe("reveal.crossfade", () => {
  it("uses from/to params", () => {
    const result = crossfade({
      progress: 0.5,
      from: "<div>A</div>",
      to: "<div>B</div>",
    });
    expect(result.html).toContain("A");
    expect(result.html).toContain("B");
    expect(result.active).toBe(true);
  });

  it("is inactive at boundaries", () => {
    expect(crossfade({ progress: 0, from: "A", to: "B" }).active).toBe(false);
    expect(crossfade({ progress: 1, from: "A", to: "B" }).active).toBe(false);
  });
});

describe("reveal.split — mid-transition", () => {
  it("is active between 0 and 1", () => {
    expect(split({ from: "A", to: "B", progress: 0.5 }).active).toBe(true);
    expect(split({ from: "A", to: "B", progress: 0 }).active).toBe(false);
    expect(split({ from: "A", to: "B", progress: 1 }).active).toBe(false);
  });

  it("wipe style clips both panels at midpoint", () => {
    const result = split({ from: "FROM", to: "TO", progress: 0.5, style: "wipe" });
    expect(result.html).toContain("inset(0 50%");
    expect(result.html).toContain("inset(0 0 0 50%");
  });
});

describe("reveal.wipe directions", () => {
  it("up wipe differs from down wipe at mid progress", () => {
    const up = wipe({ progress: 0.5, direction: "up" }).html;
    const down = wipe({ progress: 0.5, direction: "down" }).html;
    expect(up).not.toBe(down);
  });

  it("right wipe uses distinct clip path from left", () => {
    const left = wipe({ progress: 0.5, direction: "left" }).html;
    const right = wipe({ progress: 0.5, direction: "right" }).html;
    expect(left).not.toBe(right);
  });
});

describe("reveal.handoffLocal", () => {
  it("maps transition progress to peeked phase local", () => {
    expect(handoffLocal(0)).toBe(0);
    expect(handoffLocal(1)).toBeCloseTo(0.1, 5);
    expect(handoffLocal(0.5)).toBeCloseTo(0.05, 5);
  });

  it("respects custom peek", () => {
    expect(handoffLocal(1, { peek: 0.2 })).toBeCloseTo(0.2, 5);
  });
});