import { describe, expect, it } from "vitest";
import { overlapSegments } from "./aligned-intervals.js";
import { isMediaElement } from "../tree/h.js";
import { layoutTree } from "../tree/layout.js";
import { Fill } from "../tree/primitives.js";
import type { MediaChild, MediaElement } from "../tree/node-types.js";
import { ArrangeError } from "./error.js";
import { arrange } from "./index.js";
import type { Specimen } from "./types.js";

function findById(node: MediaChild, id: string): MediaElement | undefined {
  if (!isMediaElement(node)) return undefined;
  if (node.props.id === id) return node;
  for (const child of node.children) {
    const hit = findById(child, id);
    if (hit) return hit;
  }
  return undefined;
}

function block(id: string): Specimen {
  return {
    id,
    label: id,
    view: Fill({ color: "#D9D3C7" }),
    provenance: "synthetic 1080 viewport",
  };
}

describe("arrange admission", () => {
  it("refuses a comparison that does not name the work being removed", () => {
    const failures = arrange.check.registeredComparison({
      question: "What changed?",
      workRemoved: "",
      evidence: "observation",
      states: [block("a"), block("b")],
      frame: { scale: "shared", units: "ms" },
      correspondence: ["header"],
    });
    expect(failures.some((failure) => failure.code === "missing-work")).toBe(true);
  });
});

describe("point with context", () => {
  it("fails when an inset has no locatable region", () => {
    const failures = arrange.check.pointWithContext({
      question: "Where is the broken CTA?",
      workRemoved: "Finding the object being discussed",
      evidence: "observation",
      context: block("checkout"),
      focus: block("cta"),
      correspondence: "inset",
    });
    expect(failures.some((failure) => failure.code === "focus-not-locatable")).toBe(true);
  });

  it("returns a tree when the origin stays locatable", () => {
    const node = arrange.pointWithContext({
      question: "Where is the broken CTA?",
      workRemoved: "Finding the object being discussed",
      evidence: "observation",
      context: block("checkout"),
      focus: { ...block("cta"), region: { x: 0.7, y: 0.8, width: 0.2, height: 0.12 } },
      correspondence: "inset",
      source: "checkout.png",
    });
    expect(node.type).toBe("Frame");
    expect(node.props.id).toBe("arrangement");
  });
});

describe("registered comparison", () => {
  it("fails independent scale unless declared as a mismatch", () => {
    const failures = arrange.check.registeredComparison({
      question: "What differs between these states?",
      workRemoved: "Matching corresponding elements and remembering the reference",
      evidence: "observation",
      states: [block("before"), block("after")],
      frame: { scale: "independent", units: "ms" },
      correspondence: ["header", "cta"],
    });
    expect(failures.some((failure) => failure.code === "unaligned-frame")).toBe(true);
  });

  it("fails an observation without provenance", () => {
    const bare = { id: "a", label: "A", view: Fill({ color: "#ccc" }) };
    const failures = arrange.check.registeredComparison({
      question: "What differs?",
      workRemoved: "Matching corresponding elements",
      evidence: "observation",
      states: [bare, { ...bare, id: "b", label: "B" }],
      frame: { scale: "shared", viewport: { width: 1440, height: 900 } },
      correspondence: ["nav"],
    });
    expect(failures.some((failure) => failure.code === "missing-provenance")).toBe(true);
  });

  it("throws ArrangeError when invariants fail", () => {
    expect(() =>
      arrange.registeredComparison({
        question: "What differs?",
        workRemoved: "Matching corresponding elements",
        evidence: "derived",
        states: [block("a"), block("b")],
        frame: {},
        correspondence: ["x"],
      }),
    ).toThrow(ArrangeError);
  });

  it("renders when the frame is held steady", () => {
    const node = arrange.registeredComparison({
      question: "What differs between these corresponding states?",
      workRemoved: "Matching corresponding elements and remembering the reference",
      evidence: "observation",
      states: [block("before"), block("after")],
      frame: {
        scale: "shared",
        viewport: { width: 1440, height: 900 },
        crop: "header",
      },
      correspondence: ["logo", "nav", "cta"],
    });
    expect(node.type).toBe("Frame");
  });
});

describe("aligned intervals", () => {
  it("computes positive overlap, contacts, disjoint and uncertain intersections", () => {
    const track = (id: string, intervals: { start: number; end: number; uncertain?: boolean }[]) => ({ id, label: id, intervals });
    expect(overlapSegments(track("a", [{ start: -5, end: 2 }, { start: 5, end: 10, uncertain: true }]), track("b", [{ start: 2, end: 4 }, { start: 7, end: 9 }]))).toEqual([
      { start: 2, end: 2, uncertain: false }, { start: 7, end: 9, uncertain: true },
    ]);
    expect(overlapSegments(track("a", [{ start: 0, end: 1 }]), track("b", [{ start: 2, end: 3 }]))).toEqual([]);
    expect(overlapSegments(track("a", [{ start: 0, end: 4 }, { start: 3, end: 8 }]), track("b", [{ start: 2, end: 6 }]))).toEqual([{ start: 2, end: 6, uncertain: false }]);
  });

  it("requires distinct existing comparison participants", () => {
    const spec = { question: "Overlap?", workRemoved: "Compare", evidence: "derived" as const, timeRef: { unit: "s" as const, origin: -2 }, tracks: [
      { id: "a", label: "A", intervals: [{ start: -4, end: 2 }] },
      { id: "b", label: "B", intervals: [{ start: 1, end: 4 }] },
    ] };
    expect(arrange.check.alignedIntervals({ ...spec, compare: { kind: "overlap", tracks: ["a", "b"] } })).toEqual([]);
    for (const tracks of [["a", "a"], ["a", "missing"]] as [string, string][]) {
      expect(arrange.check.alignedIntervals({ ...spec, compare: { kind: "overlap", tracks } }).some(f => f.code === "missing-correspondence")).toBe(true);
    }
    expect(arrange.check.alignedIntervals({ ...spec, tracks: [spec.tracks[0]!, spec.tracks[0]!] }).some(f => f.code === "missing-correspondence")).toBe(true);
    const uncertain = arrange.alignedIntervals({ ...spec, tracks: [
      { id: "a", label: "A", intervals: [{ start: -4, end: -3, uncertain: true }] },
      { id: "b", label: "B", intervals: [{ start: 1, end: 4 }] },
    ], compare: { kind: "overlap", tracks: ["a", "b"] } });
    expect(JSON.stringify(uncertain)).toContain("timing uncertain");
  });

  it("positions origin on the shared scale and hides comparison before reveal", () => {
    const base = { question: "Overlap?", workRemoved: "Compare", evidence: "derived" as const, timeRef: { unit: "s" as const, origin: -2 }, tracks: [
      { id: "a", label: "A", intervals: [{ start: -4, end: 2 }] },
      { id: "b", label: "B", intervals: [{ start: 1, end: 4 }] },
    ], compare: { kind: "overlap" as const, tracks: ["a", "b"] as [string, string] } };
    for (const size of [{ width: 1920, height: 1080 }, { width: 1080, height: 1080 }, { width: 1080, height: 1920 }]) {
      const tree = arrange.alignedIntervals({ ...base, size });
      const marker = findById(tree, "origin-marker")!;
      const inner = size.width - 96;
      const plot = inner - Math.max(220, Math.min(440, Math.floor(inner * 0.36))) - 12;
      expect(marker.props.x).toBe(Math.round(plot / 4));
      expect(JSON.stringify(tree)).toContain("1–2 s");
      expect(JSON.stringify(tree)).toContain("not causation");
      expect(findById(arrange.alignedIntervals({ ...base, size, motion: { phase: "predict", revealIds: ["b"] } }), "overlap-answer")).toBeUndefined();
    }
    for (const [origin, fraction] of [[-4, 0], [4, 1], [2, 0.75]] as const) {
      const tree = arrange.alignedIntervals({ ...base, timeRef: { unit: "s", origin } });
      const inner = 1080 - 96;
      const plot = inner - Math.max(220, Math.min(440, Math.floor(inner * 0.36))) - 12;
      if (fraction === 0 || fraction === 1) {
        expect(findById(tree, "origin-marker")).toBeUndefined();
        expect(JSON.stringify(findById(tree, "origin"))).toContain(`origin ${origin}`);
      } else {
        expect(findById(tree, "origin-marker")!.props.x).toBe(Math.round(plot * fraction));
        expect(JSON.stringify(findById(tree, "t-origin"))).toContain(`origin ${origin}`);
      }
    }
    const zeroInside = arrange.alignedIntervals({ ...base, timeRef: { unit: "s", origin: 0, originLabel: "Launch" } });
    expect(JSON.stringify(findById(zeroInside, "t-origin"))).toContain("origin 0");
    expect(JSON.stringify(findById(zeroInside, "origin-description"))).toContain("Launch");
    expect(findById(zeroInside, "origin")).toBeUndefined();
  });

  it("lays out multiword labels and chips without forcing one-line boxes", () => {
    for (const size of [{ width: 1920, height: 1080 }, { width: 1080, height: 1080 }, { width: 1080, height: 1920 }]) {
      const tree = layoutTree(arrange.alignedIntervals({
        size, question: "When did these systems overlap?", workRemoved: "Compare tracks", evidence: "derived",
        timeRef: { unit: "s", origin: -200 },
        tracks: [
          { id: "a", label: "First long named system", intervals: [{ start: -300, end: 100 }] },
          { id: "b", label: "Second long named system", intervals: [{ start: -100, end: 200 }] },
        ],
      }));
      const labelA = findById(tree, "track-a")!.layout!;
      const barA = findById(tree, "a-0")!.layout!;
      expect(Math.abs(labelA.y + labelA.height / 2 - barA.y - barA.height / 2)).toBeLessThanOrEqual(1);
      expect(findById(tree, "plot-b")!.layout!.y + findById(tree, "plot-b")!.layout!.height).toBeLessThanOrEqual(size.height - 48);
      expect(JSON.stringify(findById(tree, "t-origin"))).toContain("origin -200");
      expect(findById(tree, "overlap-answer")).toBeUndefined();
    }
  });
  it("allocates a stage-scaled plot, preserves origin description, and keeps the sparse answer within the stage", () => {
    for (const size of [{ width: 1920, height: 1080 }, { width: 1080, height: 1080 }, { width: 1080, height: 1920 }]) {
      const tree = layoutTree(arrange.alignedIntervals({
        size, question: "Does the spike overlap the deploy?", workRemoved: "Compare tracks", evidence: "derived",
        timeRef: { unit: "s", origin: 0, originLabel: "Deployment starts" },
        tracks: [
          { id: "deploy", label: "Deploy", intervals: [{ start: 0, end: 40 }] },
          { id: "errors", label: "Error spike", intervals: [{ start: 20, end: 70 }] },
        ],
        compare: { kind: "overlap", tracks: ["deploy", "errors"] },
        source: "Illustrative timings; overlap does not establish causality",
      }));
      const trackHeight = Math.min(180, Math.floor(size.height * (size.height > size.width ? 0.42 : 0.26) / 2));
      expect(findById(tree, "plot-deploy")!.layout!.height).toBe(trackHeight);
      expect(findById(tree, "deploy-0")!.layout!.height).toBeLessThanOrEqual(64);
      expect(findById(tree, "t-origin")).toBeUndefined();
      expect(findById(tree, "origin")).toBeUndefined();
      const overlap = findById(tree, "overlap-plot")!.layout!;
      const summary = findById(tree, "overlap-answer")!.layout!;
      expect(overlap.height).toBe(Math.max(56, Math.floor(trackHeight * 0.5)));
      expect(summary.y - (overlap.y + overlap.height)).toBeGreaterThanOrEqual(36);
      expect(findById(tree, "origin-marker")).toBeUndefined();
      expect(findById(tree, "track-deploy")!.props.size).toBeGreaterThanOrEqual(48);
      expect(findById(tree, "t-min")!.props.size).toBeGreaterThanOrEqual(42);
      expect(JSON.stringify(findById(tree, "origin-description"))).toContain("Deployment starts");
      const source = findById(tree, "source")!.layout!;
      expect(findById(tree, "source")!.props.size).toBe(36);
      expect(JSON.stringify(findById(tree, "source"))).toContain("Illustrative timings; overlap does not establish causality");
      if (size.height > size.width) expect(source.y + source.height).toBeGreaterThan(size.height * 0.7);
      expect(source.y + source.height).toBeLessThanOrEqual(size.height - 48);
    }
  });
  it("keeps a dense portrait board within the stage", () => {
    const size = { width: 1080, height: 1920 };
    const tree = layoutTree(arrange.alignedIntervals({
      size, question: "When did events occur?", workRemoved: "Compare tracks", evidence: "observed",
      timeRef: { unit: "s", origin: 0 },
      tracks: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, label: `Track ${i}`, intervals: [{ start: i, end: i + 5 }] })),
      compare: { kind: "overlap", tracks: ["t0", "t1"] },
      source: "Illustrative timings",
    }));
    const source = findById(tree, "source")!.layout!;
    expect(source.y + source.height).toBeLessThanOrEqual(size.height - 48);
  });
  it("distributes two tracks without an answer through the landscape stage", () => {
    const tree = layoutTree(arrange.alignedIntervals({
      size: { width: 1920, height: 1080 }, question: "Do events overlap?", workRemoved: "Compare tracks", evidence: "observed",
      timeRef: { unit: "s", origin: 0 },
      tracks: [{ id: "a", label: "A", intervals: [{ start: 0, end: 4 }] }, { id: "b", label: "B", intervals: [{ start: 2, end: 8 }] }],
    }));
    const last = findById(tree, "plot-b")!.layout!;
    expect(last.y + last.height).toBeGreaterThanOrEqual(1080 * .6);
    expect(findById(tree, "a-0")!.layout!.height).toBeLessThanOrEqual(64);
  });
  it("refuses a plot with too many tracks for its canvas without silently dropping data", () => {
    const tracks = Array.from({ length: 7 }, (_, index) => ({ id: `t${index}`, label: `Track ${index}`, intervals: [{ start: 0, end: 1 }] }));
    const failures = arrange.check.alignedIntervals({ size: { width: 1080, height: 1080 }, question: "When?", workRemoved: "Compare", evidence: "derived", timeRef: { unit: "s", origin: 0 }, tracks });
    expect(failures.some(f => f.code === "too-dense")).toBe(true);
  });
  it("fails without a shared time reference", () => {
    const failures = arrange.check.alignedIntervals({
      question: "Do these deploys overlap?",
      workRemoved: "Computing overlap, order, and concurrency",
      evidence: "derived",
      timeRef: { unit: "s", origin: Number.NaN },
      tracks: [{ id: "east", label: "east", intervals: [{ start: 0, end: 4 }] }],
    });
    expect(failures.some((failure) => failure.code === "missing-time-ref")).toBe(true);
  });

  it("fails intervals that cannot span time", () => {
    const failures = arrange.check.alignedIntervals({
      question: "Do these deploys overlap?",
      workRemoved: "Computing overlap, order, and concurrency",
      evidence: "derived",
      timeRef: { unit: "s", origin: 3 },
      tracks: [{ id: "east", label: "east", intervals: [{ start: 3, end: 3 }] }],
    });
    expect(failures.some((failure) => failure.code === "unaligned-frame")).toBe(true);
  });

  it("renders overlapping tracks on one axis", () => {
    const node = arrange.alignedIntervals({
      question: "Do these deploys overlap?",
      workRemoved: "Computing overlap, order, and concurrency across records",
      evidence: "derived",
      timeRef: { unit: "s", origin: 0, originLabel: "kickoff" },
      tracks: [
        { id: "east", label: "us-east", intervals: [{ start: 0, end: 40, label: "deploy" }] },
        { id: "west", label: "us-west", intervals: [{ start: 20, end: 70, uncertain: true }] },
      ],
      source: "deploy log 2026-09-01",
    });
    expect(node.type).toBe("Frame");
  });

  it("fails predict that would ink the answer with no revealIds", () => {
    const failures = arrange.check.alignedIntervals({
      question: "Will west overlap east?",
      workRemoved: "Guessing overlap before the west extent is inked",
      evidence: "derived",
      timeRef: { unit: "s", origin: 0 },
      tracks: [
        { id: "east", label: "east", intervals: [{ start: 0, end: 40 }] },
        { id: "west", label: "west", intervals: [{ start: 20, end: 70 }] },
      ],
      motion: { phase: "predict" },
    });
    expect(failures.some((failure) => failure.code === "predict-spoils")).toBe(true);
  });

  it("predict paints the answer as a tick, not a full extent", () => {
    const spec = {
      question: "Will west overlap east?",
      workRemoved: "Guessing overlap before the west extent is inked",
      evidence: "derived" as const,
      timeRef: { unit: "s" as const, origin: 0 },
      tracks: [
        { id: "east", label: "east", intervals: [{ start: 0, end: 40 }] },
        { id: "west", label: "west", intervals: [{ start: 20, end: 70 }] },
      ],
      motion: { phase: "predict" as const, predict: "tick" as const, revealIds: ["west"] },
    };
    const predict = arrange.alignedIntervals(spec);
    const reveal = arrange.alignedIntervals({
      ...spec,
      motion: { phase: "reveal", revealIds: ["west"] },
    });
    expect(findById(predict, "west-0")?.props.width).toBe(3);
    expect(Number(findById(reveal, "west-0")?.props.width)).toBeGreaterThan(3);
    expect(findById(arrange.alignedIntervals({
      ...spec,
      motion: { phase: "hold", revealIds: ["west"] },
    }), "west-0")).toBeUndefined();
  });
});

describe("value against reference", () => {
  it("fails a shared scale with mixed units", () => {
    const failures = arrange.check.valueAgainstReference({
      question: "How are the numbers?",
      workRemoved: "Remembering a baseline while scanning current values",
      evidence: "derived",
      items: [
        { id: "users", label: "Users", value: 512, unit: "ppl" },
        { id: "rev", label: "Revenue", value: 1640, unit: "USD" },
      ],
      frame: { scale: "shared" },
    });
    expect(failures.some((failure) => failure.code === "unaligned-frame")).toBe(true);
  });

  it("renders per-item rows with a reference mark", () => {
    const node = arrange.valueAgainstReference({
      question: "How are we doing?",
      workRemoved: "Remembering yesterday's baseline while scanning today's values",
      evidence: "derived",
      items: [
        { id: "users", label: "Users", value: 512, unit: "ppl", reference: 400 },
      ],
      frame: { scale: "per-item" },
      source: "daily snapshot",
    });
    expect(node.type).toBe("Frame");
    expect(findById(node, "bar-users")).toBeDefined();
    expect(findById(node, "ref-users")).toBeDefined();
  });
});
