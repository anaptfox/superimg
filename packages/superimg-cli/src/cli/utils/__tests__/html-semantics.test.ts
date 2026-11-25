import { describe, expect, it } from "vitest";
import { scrapeHtmlSemantics } from "../html-semantics.js";
import { parseAtList, parseDiffPair, resolveAtSample } from "../inspect-at.js";
import { diffSemantics } from "../inspect-diff.js";

describe("scrapeHtmlSemantics", () => {
  it("extracts text, colors, eq keys, wait labels, camera scale", () => {
    const html = `
      <div style="color:#f472b6; transform: scale(1.5)">
        <span data-eq-key="cos">cos θ</span>
        <path stroke="#667eea" fill="#0f172a" data-superimg-wait="fonts"/>
      </div>
    `;
    const s = scrapeHtmlSemantics(html);
    expect(s.text).toContain("cos");
    expect(s.colors).toContain("#f472b6");
    expect(s.colors).toContain("#667eea");
    expect(s.eqKeys).toEqual(["cos"]);
    expect(s.waitLabels).toEqual(["fonts"]);
    expect(s.cameraScale).toBe(1.5);
  });

  it("returns empty semantics for empty html", () => {
    const s = scrapeHtmlSemantics("");
    expect(s.text).toEqual([]);
    expect(s.colors).toEqual([]);
    expect(s.cameraScale).toBeNull();
  });
});

describe("parseAtList", () => {
  it("defaults to quintiles", () => {
    const list = parseAtList(undefined);
    expect(list.map((s) => s.label)).toEqual(["0", "0.25", "0.5", "0.75", "1"]);
  });

  it("parses progress and frame samples", () => {
    const list = parseAtList("0.35,f:120,1");
    expect(list).toEqual([
      { kind: "progress", progress: 0.35, label: "0.35" },
      { kind: "frame", frame: 120, label: "f:120" },
      { kind: "progress", progress: 1, label: "1" },
    ]);
  });

  it("rejects invalid samples", () => {
    expect(() => parseAtList("1.5")).toThrow(/0–1/);
    expect(() => parseAtList("f:-1")).toThrow();
    for (const sample of ["-1s", "-2ms", "NaNs", "Infinitys", "1.5f", "9007199254740992f"]) {
      expect(() => parseAtList(sample)).toThrow();
    }
  });

  it("parses explicit seconds, milliseconds, and frame-time tokens", () => {
    expect(parseAtList("17.7s,17700ms,531f,.5s,0s")).toEqual([
      { kind: "seconds", seconds: 17.7, label: "17.7s" },
      { kind: "seconds", seconds: 17.7, label: "17700ms" },
      { kind: "frame", frame: 531, label: "531f" },
      { kind: "seconds", seconds: 0.5, label: ".5s" },
      { kind: "seconds", seconds: 0, label: "0s" },
    ]);
  });

  it("resolves equivalent city timestamps to the same frame and preserves both clocks", () => {
    const clock = { fps: 30, duration: 24, totalFrames: 720 };
    const [seconds, milliseconds, frame] = parseAtList("17.7s,17700ms,f:531")
      .map(sample => resolveAtSample(sample, clock));
    expect(seconds).toEqual(milliseconds);
    expect(seconds).toEqual(frame);
    expect(seconds).toMatchObject({ frame: 531, seconds: 17.7, progress: 531 / 719 });
    expect(seconds!.timelineSeconds).toBeCloseTo(531 / 719 * 24);
    expect(resolveAtSample(parseAtList("0.75")[0]!, clock)).toMatchObject({
      frame: 539, progress: 0.75, seconds: 539 / 30,
    });
    expect(resolveAtSample(parseAtList("99s")[0]!, clock)).toMatchObject({
      frame: 719, seconds: 719 / 30, timelineSeconds: 24,
    });
  });

  it("rounds subframe times and resolves a one-frame media clock", () => {
    expect(resolveAtSample(parseAtList("155ms")[0]!, {
      fps: 10, duration: 0.5, totalFrames: 5,
    }).frame).toBe(2);
    expect(resolveAtSample(parseAtList("1s")[0]!, {
      fps: 10, duration: 0.1, totalFrames: 1,
    })).toEqual({ frame: 0, progress: 0, seconds: 0, timelineSeconds: 0.1 });
  });
});

describe("parseDiffPair / diffSemantics", () => {
  it("parses pair", () => {
    expect(parseDiffPair("0.3,0.9")).toEqual({ from: 0.3, to: 0.9 });
  });

  it("diffs text and colors", () => {
    const d = diffSemantics(
      0.3,
      0.9,
      { text: ["sin"], colors: ["#fff"], eqKeys: [] },
      { text: ["sin", "cos"], colors: ["#fff", "#f472b6"], eqKeys: ["cos"] },
    );
    expect(d.addedText).toEqual(["cos"]);
    expect(d.addedColors).toEqual(["#f472b6"]);
    expect(d.addedEqKeys).toEqual(["cos"]);
    expect(d.removedText).toEqual([]);
  });

  it("diffs nodes and boxes", () => {
    const d = diffSemantics(
      0.2,
      0.8,
      {
        text: ["A"],
        colors: [],
        eqKeys: [],
        nodes: [{ id: "card", tag: "Frame", layout: { x: 0, y: 0, width: 100, height: 40 } }],
      },
      {
        text: ["A"],
        colors: [],
        eqKeys: [],
        nodes: [
          { id: "card", tag: "Frame", layout: { x: 10, y: 4, width: 120, height: 40 } },
          { id: "cta", tag: "Text" },
        ],
      },
    );
    expect(d.addedNodes).toEqual(["cta"]);
    expect(d.removedNodes).toEqual([]);
    expect(d.boxDeltas).toEqual([
      {
        id: "card",
        dx: 10,
        dy: 4,
        dw: 20,
        dh: 0,
        fromLayout: { x: 0, y: 0, width: 100, height: 40 },
        toLayout: { x: 10, y: 4, width: 120, height: 40 },
      },
    ]);
    expect(d.changedNodes).toEqual([{ id: "card", fields: ["layout"] }]);
  });

  it("keeps repeated vector tags distinct and reports semantic changes", () => {
    const d = diffSemantics(
      0.2,
      0.8,
      {
        text: [],
        colors: [],
        eqKeys: [],
        nodes: [
          { path: "0.0", tag: "VectorPath", geometry: { d: "M0 0L1 1" }, paint: { stroke: "red" } },
          { path: "0.1", tag: "VectorPath", geometry: { d: "M0 0L2 2" } },
        ],
      },
      {
        text: [],
        colors: [],
        eqKeys: [],
        nodes: [
          { path: "0.0", tag: "VectorPath", geometry: { d: "M0 0L3 3" }, paint: { stroke: "blue" } },
          { path: "0.1", tag: "VectorPath", geometry: { d: "M0 0L2 2" } },
          { path: "0.2", tag: "VectorPath", relations: { clip: "crop" } },
        ],
      },
    );

    expect(d.addedNodes).toEqual(["0.2"]);
    expect(d.changedNodes).toEqual([{ id: "0.0", fields: ["geometry", "paint"] }]);
  });
});
