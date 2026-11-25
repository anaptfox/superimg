import { describe, expect, it } from "vitest";
import { isMediaElement } from "../tree/h.js";
import { ArrangeRequestError } from "./portable-helpers.js";
import { parseArrangeRequest, type ArrangeRequest } from "./portable.js";
import {
  ARRANGE_PATTERNS,
  arrangePattern,
  checkArrangeRequest,
  findArrangePattern,
  renderArrangeRequest,
} from "./registry.js";
import { arrange } from "./index.js";

function srcSpecimen(id: string, src = "shots/before.png") {
  return { id, label: id, view: { src }, provenance: "capture 2026-09-01 14:02" };
}

function comparisonRequest(overrides: Record<string, unknown> = {}) {
  return {
    pattern: "registered-comparison",
    spec: {
      question: "What differs between these states?",
      workRemoved: "Matching corresponding elements across states",
      evidence: "observation",
      states: [srcSpecimen("before"), srcSpecimen("after", "shots/after.png")],
      frame: { scale: "shared", viewport: { width: 1440, height: 900 } },
      correspondence: ["logo", "nav"],
      ...overrides,
    },
  };
}

function intervalsRequest(motion?: Record<string, unknown>) {
  return {
    pattern: "aligned-intervals",
    spec: {
      question: "Did these overlap?",
      workRemoved: "Computing overlap across separate records",
      evidence: "derived",
      timeRef: { unit: "min", origin: 0 },
      tracks: [
        { id: "deploy", label: "Deploy", intervals: [{ start: 0, end: 8 }] },
        { id: "errors", label: "Errors", intervals: [{ start: 4, end: 12 }] },
      ],
      ...(motion === undefined ? {} : { motion }),
    },
  };
}

describe("parseArrangeRequest envelope", () => {
  it("parses size-only editions and rejects data or invalid dimensions", () => {
    const request = parseArrangeRequest({ ...intervalsRequest(), editions: { square: { size: { width: 1080, height: 1080 } } } });
    expect(request.editions?.square?.size).toEqual({ width: 1080, height: 1080 });
    expect(() => parseArrangeRequest({ ...intervalsRequest(), editions: { square: { size: { width: 0, height: 1080 } } } })).toThrow(/positive integers/);
    expect(() => parseArrangeRequest({ ...intervalsRequest(), editions: { square: { size: { width: 1080, height: 1080 }, data: {} } } })).toThrow(/Unknown field/);
  });

  it("parses only explicit two-track overlap comparisons", () => {
    const input = intervalsRequest();
    const request = parseArrangeRequest({ ...input, spec: { ...input.spec, compare: { kind: "overlap", tracks: ["deploy", "errors"] } } });
    expect(request.pattern === "aligned-intervals" && request.spec.compare).toEqual({ kind: "overlap", tracks: ["deploy", "errors"] });
    expect(JSON.stringify(renderArrangeRequest(request, "predict"))).not.toContain("overlap-answer");
    expect(JSON.stringify(renderArrangeRequest(request, "reveal"))).toContain("overlap-answer");
    expect(() => parseArrangeRequest({ ...input, spec: { ...input.spec, compare: { kind: "overlap", tracks: ["deploy"] } } })).toThrow(/exactly two/);
    expect(() => parseArrangeRequest({ ...input, spec: { ...input.spec, compare: { kind: "causes", tracks: ["deploy", "errors"] } } })).toThrow();
  });
  it("rejects an unknown field and names its path", () => {
    expect(() => parseArrangeRequest({ ...comparisonRequest(), extra: 1 })).toThrow(
      /Unknown field 'extra'/,
    );
  });

  it("rejects an unknown field inside a spec", () => {
    expect(() => parseArrangeRequest(comparisonRequest({ vibes: true }))).toThrow(
      /Unknown field 'spec.vibes'/,
    );
  });

  it("rejects an unknown pattern and lists the known ones", () => {
    expect(() => parseArrangeRequest({ pattern: "sparkles", spec: {} })).toThrow(
      /Unknown pattern 'sparkles'/,
    );
  });

  it("carries the failing path on the error", () => {
    try {
      parseArrangeRequest(comparisonRequest({ question: 7 }));
      expect.unreachable("expected a parse error");
    } catch (error) {
      expect(error).toBeInstanceOf(ArrangeRequestError);
      expect((error as ArrangeRequestError).path).toBe("spec.question");
    }
  });

  it("accepts a well-formed request", () => {
    const request = parseArrangeRequest(comparisonRequest());
    expect(request.pattern).toBe("registered-comparison");
  });
});

describe("portable src trust rule", () => {
  const rejected: readonly [string, string, RegExp][] = [
    ["absolute path", "/etc/passwd.png", /absolute path/],
    ["UNC path", "\\\\host\\share\\a.png", /UNC path/],
    ["drive letter", "C:/secrets/a.png", /drive letter/],
    ["http url", "https://example.com/a.png", /URL scheme/],
    ["file url", "file:///a.png", /URL scheme/],
    ["data url", "data:image/png;base64,AAAA", /URL scheme/],
    ["parent traversal", "../../etc/a.png", /'\.\.' segments/],
    ["nested traversal", "shots/../../a.png", /'\.\.' segments/],
  ];

  for (const [name, src, message] of rejected) {
    it(`rejects a ${name}`, () => {
      expect(() =>
        parseArrangeRequest(comparisonRequest({ states: [srcSpecimen("a", src), srcSpecimen("b")] })),
      ).toThrow(message);
    });
  }

  it("accepts a relative path", () => {
    const request = parseArrangeRequest(
      comparisonRequest({ states: [srcSpecimen("a", "shots/a.png"), srcSpecimen("b")] }),
    );
    expect(request.pattern).toBe("registered-comparison");
  });

  it("rejects an asset reference that no asset supplies", () => {
    expect(() =>
      parseArrangeRequest(
        comparisonRequest({ states: [srcSpecimen("a", "asset:missing"), srcSpecimen("b")] }),
      ),
    ).toThrow(/unknown asset 'missing'/);
  });

  it("accepts an asset reference backed by supplied bytes", () => {
    const request = parseArrangeRequest({
      ...comparisonRequest({ states: [srcSpecimen("a", "asset:shot"), srcSpecimen("b")] }),
      assets: [{ id: "shot", mimeType: "image/png", bytes: "AAAA" }],
    });
    expect(request.assets?.[0]?.id).toBe("shot");
  });
});

describe("portable assets", () => {
  it("rejects duplicate asset ids", () => {
    expect(() =>
      parseArrangeRequest({
        ...comparisonRequest(),
        assets: [
          { id: "shot", mimeType: "image/png", bytes: "AAAA" },
          { id: "shot", mimeType: "image/png", bytes: "BBBB" },
        ],
      }),
    ).toThrow(/Duplicate asset id 'shot'/);
  });

  it("rejects bytes that are not base64", () => {
    expect(() =>
      parseArrangeRequest({
        ...comparisonRequest(),
        assets: [{ id: "shot", mimeType: "image/png", bytes: "not base64!" }],
      }),
    ).toThrow(/must be base64/);
  });
});

describe("registry", () => {
  it("registers every pattern the parser accepts", () => {
    const ids = ARRANGE_PATTERNS.map((entry) => entry.id).sort();
    expect(ids).toEqual([
      "aligned-intervals",
      "mechanism-strip",
      "point-with-context",
      "registered-comparison",
      "value-against-reference",
    ]);
  });

  it("exposes each pattern through the arrange object", () => {
    expect(arrange.patterns).toBe(ARRANGE_PATTERNS);
    expect(arrange.pattern("aligned-intervals")?.title).toBe("Aligned intervals");
    expect(arrange.pattern("nope")).toBeUndefined();
  });

  it("marks the phased patterns as motion", () => {
    const motion = ARRANGE_PATTERNS.filter((entry) => entry.motion).map((entry) => entry.id).sort();
    expect(motion).toEqual(["aligned-intervals", "mechanism-strip"]);
  });

  it("gives every pattern a schema and its failure codes", () => {
    for (const entry of ARRANGE_PATTERNS) {
      expect(entry.schema).toBeTypeOf("object");
      expect(entry.failureCodes).toContain("missing-question");
      expect(entry.workRemoved.length).toBeGreaterThan(0);
    }
  });

  it("keeps the typed lookup paired with its spec type", () => {
    expect(arrangePattern("point-with-context").id).toBe("point-with-context");
    expect(findArrangePattern("point-with-context")?.motion).toBe(false);
  });
});

/** Narrows a parsed request so a direct `check*` call keeps its exact spec type. */
function comparisonSpec(request: ArrangeRequest) {
  if (request.pattern !== "registered-comparison") {
    throw new Error(`expected registered-comparison, got ${request.pattern}`);
  }
  return request.spec;
}

describe("checkArrangeRequest", () => {
  it("matches a direct check for a valid comparison", () => {
    const request = parseArrangeRequest(comparisonRequest());
    expect(checkArrangeRequest(request)).toEqual(
      arrange.check.registeredComparison(comparisonSpec(request)),
    );
    expect(checkArrangeRequest(request)).toEqual([]);
  });

  it("matches a direct check for a failing comparison", () => {
    const request = parseArrangeRequest(comparisonRequest({ workRemoved: " " }));
    const failures = checkArrangeRequest(request);
    expect(failures).toEqual(arrange.check.registeredComparison(comparisonSpec(request)));
    expect(failures.some((failure) => failure.code === "missing-work")).toBe(true);
  });

  it("reports predict-spoils through the request path", () => {
    const request = parseArrangeRequest(intervalsRequest({ phase: "predict" }));
    expect(checkArrangeRequest(request).some((f) => f.code === "predict-spoils")).toBe(true);
  });

  it("leaves an arrangement failure to check rather than the parser", () => {
    // One state is well-formed JSON; it is the invariant that cannot hold.
    const request = parseArrangeRequest(comparisonRequest({ states: [srcSpecimen("only")] }));
    expect(checkArrangeRequest(request).some((f) => f.code === "missing-correspondence")).toBe(
      true,
    );
  });
});

describe("renderArrangeRequest", () => {
  it("renders without a phase for a static pattern", () => {
    const request = parseArrangeRequest(comparisonRequest());
    expect(isMediaElement(renderArrangeRequest(request))).toBe(true);
  });

  it("applies the phase to a motion pattern", () => {
    const request = parseArrangeRequest(
      intervalsRequest({ phase: "hold", revealIds: ["errors"] }),
    );
    const held = JSON.stringify(renderArrangeRequest(request, "hold"));
    const revealed = JSON.stringify(renderArrangeRequest(request, "reveal"));
    expect(held).not.toEqual(revealed);
  });

  it("ignores a phase on a static pattern", () => {
    const request = parseArrangeRequest(comparisonRequest());
    expect(JSON.stringify(renderArrangeRequest(request, "reveal"))).toEqual(
      JSON.stringify(renderArrangeRequest(request)),
    );
  });
});
