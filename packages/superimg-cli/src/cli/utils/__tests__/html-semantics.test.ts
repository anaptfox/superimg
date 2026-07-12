import { describe, expect, it } from "vitest";
import { scrapeHtmlSemantics } from "../html-semantics.js";
import { parseAtList, parseDiffPair } from "../inspect-at.js";
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
});
