import { describe, expect, it } from "vitest";
import { RuntimePerformanceProbe } from "./performance.js";
import { escapedTreeHtml, isEscapedTreeHtml } from "./escaped-html.js";

describe("bounded passive performance observation", () => {
  it("retains numeric observations within capacity and independently counts outcomes", () => {
    const probe = new RuntimePerformanceProbe({ capacity: 2 });
    const update = probe.request("update", 10, 0);
    update.inputRevision = 1;
    probe.evaluated(update, 12);
    update.timing("sanitize", 3);
    probe.finish(update, "accepted", 12, 8);
    probe.finish(update, "failed");
    const snapshot = probe.snapshot();
    expect(snapshot.records[0]).toMatchObject({ inputRevision: 1, requestedFrame: 10,
      evaluatedFrame: 12, acceptedFrame: 12, acceptedRevision: 8, timings: { sanitize: 3 } });
    probe.finish(probe.request("clock", 13, 1), "superseded");
    probe.finish(probe.request("render", 14, 1), "failed");
    const latest = probe.snapshot();
    expect(latest.records).toHaveLength(2);
    expect(latest.dropped).toBe(1);
    expect(latest.counters).toEqual({ requested: 3, evaluated: 1, accepted: 1, superseded: 1, failed: 1 });
    expect(latest.byKind.clock.superseded).toBe(1);
    expect(snapshot.records).toHaveLength(1);
    expect(Object.isFrozen(latest.records)).toBe(true);
    expect(Object.isFrozen(latest.records[0]?.timings)).toBe(true);
    expect(JSON.stringify(latest)).not.toMatch(/html|data|secret/);
  });
  it.each([0, -1, 1.5, 4097, Infinity, NaN])("rejects invalid retention capacity %s", capacity => {
    expect(() => new RuntimePerformanceProbe({ capacity })).toThrow(RangeError);
  });
});

describe("escaped typed-tree proof", () => {
  it("cannot be fabricated and grants only the originally lowered exact bytes", () => {
    const html = '<div>&lt;script&gt;user text&lt;/script&gt;</div>';
    const proof = escapedTreeHtml(html);
    expect(isEscapedTreeHtml({}, html)).toBe(false);
    expect(isEscapedTreeHtml(undefined, html)).toBe(false);
    expect(isEscapedTreeHtml(proof, html)).toBe(true);
    expect(isEscapedTreeHtml(proof, '<script>alert(1)</script>')).toBe(false);
  });
});
