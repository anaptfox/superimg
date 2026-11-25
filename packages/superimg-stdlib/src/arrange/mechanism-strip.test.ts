import { describe, expect, it } from "vitest";
import { isMediaElement } from "../tree/h.js";
import { checkMechanismStrip, mechanismStrip } from "./mechanism-strip.js";
import {
  connectorGeometry,
  innerWidthFor,
  pipelineCapacity,
  type NodeBox,
} from "./mechanism-geometry.js";
import { parseArrangeRequest } from "./portable.js";
import { checkArrangeRequest, renderArrangeRequest } from "./registry.js";
import { ArrangeError } from "./error.js";
import type { MediaChild, MediaElement } from "../tree/node-types.js";
import type { MechanismStripSpec } from "./types.js";

function findById(node: MediaChild, id: string): MediaElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findById(child, id);
      if (hit) return hit;
    }
    return null;
  }
  if (!isMediaElement(node)) return null;
  if (node.props.id === id) return node;
  for (const child of node.children) {
    const hit = findById(child, id);
    if (hit) return hit;
  }
  return null;
}

function box(id: string, x: number, y: number): NodeBox {
  return { id, ordinal: "01", x, y, width: 160, height: 100 };
}

function spec(overrides: Partial<MechanismStripSpec> = {}): MechanismStripSpec {
  return {
    question: "How does a media program become bytes?",
    workRemoved: "Tracing which stage hands what to the next",
    evidence: "derived",
    nodes: [
      { id: "core", label: "core" },
      { id: "node", label: "node" },
    ],
    edges: [{ from: "core", to: "node", claim: "derived" }],
    layout: { kind: "pipeline", order: ["core", "node"] },
    ...overrides,
  } as MechanismStripSpec;
}

function codes(failures: ReturnType<typeof checkMechanismStrip>): string[] {
  return failures.map((failure) => failure.code);
}

describe("mechanism strip admission", () => {
  it("accepts a well-formed pipeline", () => {
    expect(checkMechanismStrip(spec())).toEqual([]);
  });

  it("still enforces the shared admission questions", () => {
    expect(codes(checkMechanismStrip(spec({ workRemoved: " " })))).toContain("missing-work");
  });

  it("refuses an edge with no evidence kind", () => {
    const bad = spec({
      edges: [{ from: "core", to: "node", claim: "vibes" as never }],
    });
    expect(codes(checkMechanismStrip(bad))).toContain("unsupported-claim");
  });

  it("refuses an edge pointing at an undeclared node", () => {
    const bad = spec({ edges: [{ from: "core", to: "ghost", claim: "derived" }] });
    expect(codes(checkMechanismStrip(bad))).toContain("missing-correspondence");
  });

  it("refuses duplicate node ids", () => {
    const bad = spec({
      nodes: [
        { id: "core", label: "core" },
        { id: "core", label: "again" },
      ],
      layout: { kind: "pipeline", order: ["core"] },
    });
    expect(codes(checkMechanismStrip(bad))).toContain("missing-correspondence");
  });

  it("refuses a node missing from the declared order", () => {
    const bad = spec({ layout: { kind: "pipeline", order: ["core"] } });
    expect(codes(checkMechanismStrip(bad))).toContain("unaligned-frame");
  });

  it("refuses a node placed twice in the declared order", () => {
    const bad = spec({ layout: { kind: "pipeline", order: ["core", "node", "core"] } });
    expect(codes(checkMechanismStrip(bad))).toContain("unaligned-frame");
  });

  it("refuses more nodes than the stage can render legibly", () => {
    const cap = pipelineCapacity(innerWidthFor(1080));
    const nodes = Array.from({ length: cap + 1 }, (_, index) => ({
      id: `n${index}`,
      label: `n${index}`,
    }));
    const bad = spec({
      nodes,
      edges: [{ from: "n0", to: "n1", claim: "derived" }],
      layout: { kind: "pipeline", order: nodes.map((node) => node.id) },
    });
    expect(codes(checkMechanismStrip(bad))).toContain("too-dense");
  });

  it("refuses predict without revealIds", () => {
    const bad = spec({ motion: { phase: "predict" } });
    expect(codes(checkMechanismStrip(bad))).toContain("predict-spoils");
  });

  it("refuses a predict that hides every edge", () => {
    const bad = spec({ motion: { phase: "predict", revealIds: ["core->node"] } });
    expect(codes(checkMechanismStrip(bad))).toContain("predict-spoils");
  });
});

describe("mechanism strip render", () => {
  it("renders a pipeline layout", () => {
    expect(isMediaElement(mechanismStrip(spec()))).toBe(true);
  });

  it("renders a layers layout", () => {
    const layered = spec({ layout: { kind: "layers", layers: [["core"], ["node"]] } });
    expect(isMediaElement(mechanismStrip(layered))).toBe(true);
  });

  it("throws rather than drawing an arrangement that cannot hold", () => {
    expect(() => mechanismStrip(spec({ edges: [] }))).toThrow(ArrangeError);
  });

  it("paints a proposal edge differently from a derived one", () => {
    const derived = JSON.stringify(mechanismStrip(spec()));
    const proposed = JSON.stringify(
      mechanismStrip(spec({ edges: [{ from: "core", to: "node", claim: "proposal" }] })),
    );
    expect(derived).not.toEqual(proposed);
  });

  it("sizes a card to its words, not to the leftover stage", () => {
    const square = mechanismStrip(spec({ size: { width: 1080, height: 1080 } }));
    const tall = mechanismStrip(spec({ size: { width: 1080, height: 1920 } }));
    const a = findById(square, "node-core");
    const b = findById(tall, "node-core");
    expect(a?.props.height).toBeGreaterThan(0);
    expect(a?.props.height).toEqual(b?.props.height);
  });

  it("names only the claims the mechanism actually uses", () => {
    const derived = JSON.stringify(mechanismStrip(spec()));
    expect(derived).toContain("Derived");
    expect(derived).not.toContain("Interpreted");
    const mixed = JSON.stringify(
      mechanismStrip(spec({ edges: [{ from: "core", to: "node", claim: "interpretation" }] })),
    );
    expect(mixed).toContain("Interpreted");
  });

  it("distinguishes each motion phase", () => {
    const withMotion = (phase: "hold" | "predict" | "reveal") =>
      JSON.stringify(
        mechanismStrip(
          spec({
            nodes: [
              { id: "a", label: "a" },
              { id: "b", label: "b" },
              { id: "c", label: "c" },
            ],
            edges: [
              { from: "a", to: "b", claim: "derived" },
              { from: "b", to: "c", claim: "derived" },
            ],
            layout: { kind: "pipeline", order: ["a", "b", "c"] },
            motion: { phase, revealIds: ["b->c"] },
          }),
        ),
      );
    expect(withMotion("hold")).not.toEqual(withMotion("reveal"));
    expect(withMotion("predict")).not.toEqual(withMotion("reveal"));
  });
});

describe("mechanism strip through the portable door", () => {
  const request = {
    pattern: "mechanism-strip",
    spec: {
      question: "How does a media program become bytes?",
      workRemoved: "Tracing which stage hands what to the next",
      evidence: "derived",
      nodes: [
        { id: "core", label: "core" },
        { id: "node", label: "node" },
      ],
      edges: [{ from: "core", to: "node", claim: "derived" }],
      layout: { kind: "pipeline", order: ["core", "node"] },
    },
  };

  it("parses and admits identically to a direct check", () => {
    const parsed = parseArrangeRequest(request);
    expect(parsed.pattern).toBe("mechanism-strip");
    expect(checkArrangeRequest(parsed)).toEqual(checkMechanismStrip(spec()));
    expect(checkArrangeRequest(parsed)).toEqual([]);
  });

  it("renders through the registry with a phase", () => {
    const parsed = parseArrangeRequest(request);
    expect(isMediaElement(renderArrangeRequest(parsed, "reveal"))).toBe(true);
  });

  it("rejects an unknown field naming its path", () => {
    expect(() =>
      parseArrangeRequest({ ...request, spec: { ...request.spec, sparkle: true } }),
    ).toThrow(/Unknown field 'spec.sparkle'/);
  });

  it("rejects an edge claim that is not an evidence kind at parse time", () => {
    expect(() =>
      parseArrangeRequest({
        ...request,
        spec: { ...request.spec, edges: [{ from: "core", to: "node", claim: "vibes" }] },
      }),
    ).toThrow(/claim/);
  });
});

describe("mechanism connector geometry", () => {
  it("parks a straight label in the gap, clear of both cards", () => {
    const from = box("a", 0, 0);
    const to = box("b", 260, 0);
    const geometry = connectorGeometry(from, to);
    expect(geometry.label.x).toBeGreaterThanOrEqual(from.x + from.width);
    expect(geometry.label.x + geometry.label.width).toBeLessThanOrEqual(to.x);
    expect(geometry.label.bottom).toBeLessThan(from.y + from.height / 2);
  });

  it("keeps an elbow label out of the column its bend occupies", () => {
    const from = box("a", 0, 0);
    const to = box("b", 260, 140);
    const geometry = connectorGeometry(from, to);
    const bendX = Number(geometry.line.split("L")[1]?.split(",")[0]);
    expect(Number.isFinite(bendX)).toBe(true);
    expect(geometry.label.x + geometry.label.width).toBeLessThan(bendX);
    expect(geometry.label.bottom).toBeLessThan(from.y + from.height / 2);
  });

  it("draws one bend and no curve", () => {
    const geometry = connectorGeometry(box("a", 0, 0), box("b", 260, 140));
    expect(geometry.line).not.toMatch(/[CcQqSsTtAa]/);
    expect(geometry.line.split("L")).toHaveLength(4);
  });
});
