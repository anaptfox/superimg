import { describe, it, expect } from "vitest";
import type { MediaIRMotion, MediaIRScene, MediaIR } from "@superimg/types";
import { lintMediaIR } from "../ir/pure/index.js";

function makeIR(
  motions: Partial<MediaIRMotion>[],
  scenes?: Partial<MediaIRScene>[],
): MediaIR {
  const fullScenes = (scenes ?? [{}]).map((s, i) => ({
    id: "default",
    index: i,
    range: { startFrame: 0, endFrame: 90 },
    phases: [
      { name: "enter", start: 0, end: 0.2 },
      { name: "hold", start: 0.2, end: 0.8 },
      { name: "exit", start: 0.8, end: 1 },
    ],
    markers: [],
    transitions: [],
    ...s,
  }));
  const fullMotions = motions.map((m, i) => ({
    id: `default::m${i}`,
    localId: `m${i}`,
    sceneId: "default",
    kind: "motion" as const,
    enter: { startFrame: 0, endFrame: 12 },
    easing: { kind: "named" as const, name: "easeOutCubic" },
    ...m,
  }));
  return {
    kind: "@foxworth/superimg/media-ir",
    schemaVersion: 0,
    identity: { sourceId: "demo", variantId: "default", editionId: "default" },
    medium: "html",
    animated: true,
    canvas: { width: 100, height: 100 },
    renderConfig: {
      fonts: [],
      inlineCss: [],
      stylesheets: [],
      tailwind: null,
      background: null,
      watermark: null,
      readiness: null,
      mode: "frame",
    },
    clock: { fps: 30, durationSeconds: 3, totalFrames: 90 },
    capabilities: {
      temporal: "canonical",
      motion: "declarative",
      visual: "opaque-html",
      portability: "self-contained",
      determinism: "unverified",
      issues: [],
    },
    provenance: {
      programHash: "a".repeat(64),
      sourceId: "demo",
      compiler: "superimg",
      compilerVersion: 0,
    },
    scenes: fullScenes,
    tracks: [],
    motions: fullMotions,
    assets: [],
    observations: { markupRuns: [], sceneRuns: [] },
    hashes: {
      intentHash: "d".repeat(64),
      markupHash: "e".repeat(64),
      programHash: "a".repeat(64),
    },
    extensions: {},
  };
}

const codes = (ir: MediaIR, opts?: Parameters<typeof lintMediaIR>[1]) =>
  lintMediaIR(ir, opts).map((i) => i.code);

describe("CRAFT_IR_LINEAR_NON_LOOP", () => {
  it("flags linear easing on positional motion", () => {
    const ir = makeIR([{ easing: { kind: "named", name: "linear" } }]);
    expect(codes(ir)).toContain("CRAFT_IR_LINEAR_NON_LOOP");
  });
  it("allows linear on loop-safe properties and sampled motions", () => {
    const ir = makeIR([
      { kind: "tween", property: "rotate", easing: { kind: "named", name: "linear" } },
      { kind: "sampled", easing: { kind: "named", name: "linear" } },
    ]);
    expect(codes(ir)).not.toContain("CRAFT_IR_LINEAR_NON_LOOP");
  });
});

describe("CRAFT_IR_EXIT_NOT_FASTER", () => {
  it("flags exits slower than enters", () => {
    const ir = makeIR([
      { enter: { startFrame: 0, endFrame: 10 }, exit: { startFrame: 60, endFrame: 80 } },
    ]);
    expect(codes(ir)).toContain("CRAFT_IR_EXIT_NOT_FASTER");
  });
  it("accepts faster exits", () => {
    const ir = makeIR([
      { enter: { startFrame: 0, endFrame: 12 }, exit: { startFrame: 60, endFrame: 69 } },
    ]);
    expect(codes(ir)).not.toContain("CRAFT_IR_EXIT_NOT_FASTER");
  });
});

describe("CRAFT_IR_OVERSHOOT_ON_EXIT", () => {
  it("flags named overshoot curves on exit", () => {
    const ir = makeIR([
      {
        enter: { startFrame: 0, endFrame: 10 },
        exit: { startFrame: 60, endFrame: 68 },
        exitEasing: { kind: "named", name: "easeOutBack" },
      },
    ]);
    expect(codes(ir)).toContain("CRAFT_IR_OVERSHOOT_ON_EXIT");
  });
  it("flags underdamped exit springs, accepts critically damped", () => {
    const spring = (damping: number) =>
      makeIR([
        {
          enter: { startFrame: 0, endFrame: 10 },
          exit: { startFrame: 60, endFrame: 68 },
          exitEasing: { kind: "spring", stiffness: 100, damping, mass: 1 },
        },
      ]);
    // 2·√(100·1) = 20
    expect(codes(spring(10))).toContain("CRAFT_IR_OVERSHOOT_ON_EXIT");
    expect(codes(spring(20))).not.toContain("CRAFT_IR_OVERSHOOT_ON_EXIT");
  });
});

describe("CRAFT_IR_NO_EASING_CONTRAST", () => {
  it("flags scenes where 4+ motions share one easing", () => {
    const ir = makeIR([{}, {}, {}, {}]);
    expect(codes(ir)).toContain("CRAFT_IR_NO_EASING_CONTRAST");
  });
  it("stays quiet with easing variety or fewer motions", () => {
    expect(codes(makeIR([{}, {}, {}]))).not.toContain("CRAFT_IR_NO_EASING_CONTRAST");
    const varied = makeIR([{}, {}, {}, { easing: { kind: "named", name: "easeOutBack" } }]);
    expect(codes(varied)).not.toContain("CRAFT_IR_NO_EASING_CONTRAST");
  });
});

describe("CRAFT_IR_HOLD_OCCUPIED_BY_MOTION", () => {
  it("flags a motion moving through the entire hold phase", () => {
    // hold = frames 18..72; enter spans it fully
    const ir = makeIR([{ enter: { startFrame: 10, endFrame: 80 } }]);
    expect(codes(ir)).toContain("CRAFT_IR_HOLD_OCCUPIED_BY_MOTION");
  });
  it("accepts motion that settles before the hold", () => {
    const ir = makeIR([{ enter: { startFrame: 0, endFrame: 18 } }]);
    expect(codes(ir)).not.toContain("CRAFT_IR_HOLD_OCCUPIED_BY_MOTION");
  });
});

describe("stagger rules", () => {
  it("flags 3+ siblings starting on the same frame", () => {
    const ir = makeIR([
      { enter: { startFrame: 10, endFrame: 22 } },
      { enter: { startFrame: 10, endFrame: 22 } },
      { enter: { startFrame: 11, endFrame: 23 } },
    ]);
    expect(codes(ir)).toContain("CRAFT_IR_STAGGER_COLLISION");
  });
  it("flags staggered items with too little overlap", () => {
    // 6-frame gaps, 8-frame items → 8 < 3·6
    const ir = makeIR([
      { enter: { startFrame: 0, endFrame: 8 } },
      { enter: { startFrame: 6, endFrame: 14 } },
      { enter: { startFrame: 12, endFrame: 20 } },
    ]);
    const c = codes(ir);
    expect(c).toContain("CRAFT_IR_STAGGER_TOO_TIGHT");
    expect(c).not.toContain("CRAFT_IR_STAGGER_COLLISION");
  });
  it("accepts well-overlapped staggers", () => {
    // 3-frame gaps, 12-frame items → 12 ≥ 3·3
    const ir = makeIR([
      { enter: { startFrame: 0, endFrame: 12 } },
      { enter: { startFrame: 3, endFrame: 15 } },
      { enter: { startFrame: 6, endFrame: 18 } },
    ]);
    const c = codes(ir);
    expect(c).not.toContain("CRAFT_IR_STAGGER_TOO_TIGHT");
    expect(c).not.toContain("CRAFT_IR_STAGGER_COLLISION");
  });
});

describe("CRAFT_IR_ASYMMETRIC_POP", () => {
  it("flags pop-in with eased exit", () => {
    const ir = makeIR([
      { enter: { startFrame: 0, endFrame: 1 }, exit: { startFrame: 60, endFrame: 70 } },
    ]);
    expect(codes(ir)).toContain("CRAFT_IR_ASYMMETRIC_POP");
  });
});

describe("CRAFT_IR_LONG_ENTER", () => {
  it("reports enters over 1s as info", () => {
    const ir = makeIR([{ enter: { startFrame: 0, endFrame: 45 } }]); // 1.5s @ 30fps
    const issue = lintMediaIR(ir).find((i) => i.code === "CRAFT_IR_LONG_ENTER");
    expect(issue?.severity).toBe("info");
  });
});

describe("options", () => {
  it("disable suppresses rules", () => {
    const ir = makeIR([{ easing: { kind: "named", name: "linear" } }]);
    expect(codes(ir, { disable: ["CRAFT_IR_LINEAR_NON_LOOP"] })).not.toContain(
      "CRAFT_IR_LINEAR_NON_LOOP",
    );
  });
  it("strict escalates warnings to errors but leaves info alone", () => {
    const ir = makeIR([
      { easing: { kind: "named", name: "linear" }, enter: { startFrame: 0, endFrame: 45 } },
    ]);
    const issues = lintMediaIR(ir, { strict: true });
    expect(issues.find((i) => i.code === "CRAFT_IR_LINEAR_NON_LOOP")?.severity).toBe("error");
    expect(issues.find((i) => i.code === "CRAFT_IR_LONG_ENTER")?.severity).toBe("info");
  });
});
