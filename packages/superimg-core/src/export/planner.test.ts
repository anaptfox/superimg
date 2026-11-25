import { describe, expect, it } from "vitest";
import { collection, image, svg, video } from "@superimg/types";
import { digestData, planMediaExport, type ResolvedCollectionEntry } from "./planner.js";
import { Html, Vector } from "@superimg/stdlib/tree";

const renderHtml = () => Html({ width: "fill", height: "fill", html: "<div />" });
const renderSvg = () => Vector(
  { width: "fill", height: "fill" },
  Html({ width: "fill", height: "fill", html: "" }),
);

interface Clip {
  id: string;
  title: string;
  tags: string[];
  theme?: string;
  createdAt?: string;
}

const clips: readonly Clip[] = [
  { id: "intro", title: "Introduction", tags: ["first"] },
  { id: "architecture", title: "Architecture", tags: ["system"] },
];

function resolvedEntries(): ResolvedCollectionEntry<Clip>[] {
  return clips.map((data) => ({ id: data.id, data: { ...data, tags: [...data.tags] }, dataDigest: digestData(data) }));
}

describe("schema-0 export planner", () => {
  it("expands entry x variant x selected edition x rendition through one canonical matrix", () => {
    const media = video<Clip>({
      duration: "12s",
      sample: { id: "sample", title: "not exported", tags: ["sample"] },
      variants: {
        dark: { theme: "dark", tags: ["replacement"] },
        light: { theme: "light" },
      },
      editions: {
        square: { size: { width: 1080, height: 1080 } },
      },
      render: renderHtml,
    });
    const definition = collection({ entries: clips, media });

    const plan = planMediaExport({
      sourceId: "episodes",
      definition,
      entries: resolvedEntries(),
      targets: ["instagram-square", "youtube"],
    });

    expect(plan.schemaVersion).toBe(0);
    expect(plan.renditions).toHaveLength(12);
    expect(plan.coordinates).toHaveLength(12);
    expect(plan.renditions.map((item) => item.coordinates.variantId)).toEqual([
      "default", "default", "dark", "dark", "light", "light",
      "default", "default", "dark", "dark", "light", "light",
    ]);
    expect(plan.renditions.map((item) => item.coordinates.entryId)).toEqual([
      "architecture", "architecture", "architecture", "architecture", "architecture", "architecture",
      "intro", "intro", "intro", "intro", "intro", "intro",
    ]);
    expect(plan.renditions.find((item) =>
      item.coordinates.entryId === "intro" &&
      item.coordinates.variantId === "dark" &&
      item.coordinates.renditionId === "instagram-square"
    )).toMatchObject({
      coordinates: { editionId: "square" },
      canvas: { width: 1080, height: 1080 },
      format: "mp4",
      relativePath: "intro/dark/instagram-square.mp4",
      entryDataDigest: digestData(clips[0]!),
      data: { id: "intro", title: "Introduction", theme: "dark", tags: ["replacement"] },
    });
    expect(plan.renditions.find((item) =>
      item.coordinates.entryId === "intro" &&
      item.coordinates.variantId === "light" &&
      item.coordinates.renditionId === "youtube"
    )).toMatchObject({
      coordinates: { editionId: "default" },
      canvas: { width: 1920, height: 1080 },
      data: { id: "intro", title: "Introduction", theme: "light", tags: ["first"] },
    });
    expect(JSON.stringify(plan)).not.toContain("not exported");
    expect(plan.requestDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.renditions[0]?.data)).toBe(true);
  });

  it("reflows the root at arbitrary custom sizes and uses exact-ratio art direction", () => {
    const media = image<{ title: string }>({
      sample: { title: "hello" },
      editions: { portrait: { size: { width: 9, height: 16 } } },
      render: renderHtml,
    });
    const plan = planMediaExport({
      sourceId: "card",
      definition: media,
      targets: ["800x1200", "720x1280.png"],
    });
    expect(plan.renditions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        canvas: { width: 800, height: 1200 },
        format: "png",
        relativePath: "800x1200.png",
        coordinates: expect.objectContaining({ editionId: "default" }),
      }),
      expect.objectContaining({
        canvas: { width: 720, height: 1280 },
        coordinates: expect.objectContaining({ editionId: "portrait" }),
      }),
    ]));
  });

  it("prefers an exact canvas, then the closest same-aspect authored size", () => {
    const media = image({
      size: { width: 1200, height: 630 },
      editions: { compact: { size: { width: 600, height: 315 } } },
      render: renderHtml,
    });
    const plan = planMediaExport({
      sourceId: "og",
      definition: media,
      targets: ["1200x630.png", "600x315.png", "2400x1260.png", "700x368.png"],
    });
    expect(Object.fromEntries(plan.renditions.map((item) => [
      `${item.canvas.width}x${item.canvas.height}`,
      item.coordinates.editionId,
    ]))).toEqual({
      "1200x630": "default",
      "600x315": "compact",
      "2400x1260": "default",
      "700x368": "compact",
    });
  });

  it("resolves custom targets at capture dpr 1 unless capture.dpr is set", () => {
    const media = image({ render: renderHtml });
    expect(planMediaExport({
      sourceId: "card",
      definition: media,
      targets: ["1200x630.png"],
    }).renditions[0]?.encoding).toMatchObject({ capture: { dpr: 1 } });

    expect(planMediaExport({
      sourceId: "card",
      definition: media,
      encoding: { capture: { dpr: 3 } },
      targets: ["800x600.png"],
    }).renditions[0]?.encoding).toMatchObject({ capture: { dpr: 3 } });

    expect(planMediaExport({
      sourceId: "card",
      definition: media,
      targets: [{
        kind: "custom",
        id: "poster",
        width: 800,
        height: 600,
        format: "png",
        encoding: { capture: { dpr: 2, scale: "css" } },
      }],
    }).renditions[0]?.encoding).toMatchObject({ capture: { dpr: 2, scale: "css" } });
  });

  it("leaves native SVG custom targets without a capture block", () => {
    expect(planMediaExport({
      sourceId: "badge",
      definition: svg({ render: renderSvg }),
      targets: ["600x180.png"],
    }).renditions[0]?.encoding?.capture).toBeUndefined();

    expect(planMediaExport({
      sourceId: "card",
      definition: image({ render: renderHtml }),
      targets: ["600x180.png"],
    }).renditions[0]?.encoding?.capture?.dpr).toBe(1);
  });

  it("exports the unpatched sample before declared variants", () => {
    const media = image<{ title: string }>({
      sample: { title: "base" },
      variants: { queued: { title: "queued" } },
      render: renderHtml,
    });
    expect(planMediaExport({
      sourceId: "card",
      definition: media,
      targets: ["1200x630.png"],
    }).renditions.map((item) => [item.coordinates.variantId, (item.data as { title: string }).title])).toEqual([
      ["default", "base"],
      ["queued", "queued"],
    ]);
    expect(planMediaExport({
      sourceId: "card",
      definition: media,
      selector: { variantIds: ["queued"] },
      targets: ["1200x630.png"],
    }).renditions.map((item) => item.coordinates.variantId)).toEqual(["queued"]);
    expect(planMediaExport({
      sourceId: "card",
      definition: media,
      selector: { variantIds: ["default"] },
      targets: ["1200x630.png"],
    }).renditions.map((item) => item.coordinates.variantId)).toEqual(["default"]);

    expect(() => planMediaExport({
      sourceId: "card",
      definition: image({
        // @ts-expect-error `default` is reserved in the variant types too; this exercises the runtime guard.
        variants: { default: {} },
        render: renderHtml,
      }),
      targets: ["1200x630.png"],
    })).toThrowError(expect.objectContaining({ code: "EXPORT_VARIANT_INVALID" }));
  });

  it("layers shared encoding over destination defaults and beneath exact target policy", () => {
    const media = video({ duration: "2s", render: renderHtml });
    const plan = planMediaExport({
      sourceId: "launch",
      definition: media,
      encoding: {
        video: { quality: "high", codec: "av1" },
        capture: { dpr: 2 },
      },
      targets: [
        "youtube",
        {
          kind: "custom",
          id: "social",
          width: 1280,
          height: 720,
          format: "mp4",
          encoding: { video: { codec: "vp9" } },
        },
      ],
    });

    expect(plan.renditions.find((item) => item.target.id === "youtube")?.encoding)
      .toMatchObject({
        video: { quality: "high", codec: "av1" },
        audio: { codec: "aac" },
        capture: { dpr: 2 },
      });
    expect(plan.renditions.find((item) => item.target.id === "social")?.encoding)
      .toMatchObject({
        video: { quality: "high", codec: "vp9" },
        capture: { dpr: 2 },
      });
  });

  it("plans SVG collections through the same matrix", () => {
    const media = svg<Clip>({ render: renderSvg });
    const plan = planMediaExport({
      sourceId: "certificates",
      definition: collection({ entries: clips, media }),
      entries: resolvedEntries(),
      targets: ["750x1050.svg"],
    });
    expect(plan.renditions.map((item) => [item.format, item.relativePath])).toEqual([
      ["svg", "architecture/750x1050.svg"],
      ["svg", "intro/750x1050.svg"],
    ]);
  });

  it("selects entries without executing or consulting the collection provider", () => {
    let calls = 0;
    const media = image<Clip>({ render: renderHtml });
    const definition = collection({ entries: () => { calls++; return clips; }, media });
    const plan = planMediaExport({
      sourceId: "cards",
      definition,
      entries: resolvedEntries(),
      selector: { entryIds: ["intro"] },
      targets: ["1200x630.png"],
    });
    expect(calls).toBe(0);
    expect(plan.renditions).toHaveLength(1);
    expect(plan.renditions[0]?.coordinates.entryId).toBe("intro");
  });

  it("preserves author data keys while hashing them canonically", () => {
    const sample = { title: "release", createdAt: "2026-08-09T00:00:00Z" };
    const plan = planMediaExport({
      sourceId: "release-card",
      definition: image({ sample, render: renderHtml }),
      targets: ["1200x630.png"],
    });
    expect(plan.renditions[0]?.data).toEqual(sample);
    expect(digestData({ createdAt: sample.createdAt, title: sample.title })).toBe(digestData(sample));
  });

  it("requires an explicit freeze point for animated-to-still and rejects static-to-video", () => {
    const animated = video({ duration: "2s", render: renderHtml });
    expect(() => planMediaExport({
      sourceId: "clip",
      definition: animated,
      targets: ["1200x630.png"],
    })).toThrowError(expect.objectContaining({ code: "EXPORT_STILL_FRAME_REQUIRED" }));
    expect(planMediaExport({
      sourceId: "clip",
      definition: animated,
      targets: ["1200x630.png"],
      stillFrame: { kind: "at", at: "1.2s" },
    }).renditions[0]).toMatchObject({ stillFrame: { kind: "at", at: "1.2s" } });

    const still = image({ render: renderHtml });
    expect(() => planMediaExport({
      sourceId: "card",
      definition: still,
      targets: ["1920x1080.mp4"],
    })).toThrowError(expect.objectContaining({ code: "EXPORT_FORMAT_INCOMPATIBLE" }));
  });

  it("plans QuickTime and Matroska as animated renditions", () => {
    const media = video({ duration: "2s", render: renderHtml });
    const plan = planMediaExport({
      sourceId: "master",
      definition: media,
      targets: ["1920x1080.mov", "1920x1080.mkv"],
    });
    expect(plan.renditions.map((item) => [item.format, item.relativePath])).toEqual([
      ["mkv", "1920x1080.mkv"],
      ["mov", "1920x1080.mov"],
    ]);
  });

  it("rejects interactive and nested definitions at the runtime boundary", () => {
    const interactive = { kind: "interactive", render: renderHtml };
    expect(() => planMediaExport({
      sourceId: "lesson",
      definition: interactive as never,
      targets: ["1200x630.png"],
    })).toThrowError(expect.objectContaining({ code: "EXPORT_MEDIA_INVALID" }));

    const media = image<Clip>({ render: renderHtml });
    const nested = collection({ entries: clips, media });
    expect(() => planMediaExport({
      sourceId: "nested",
      definition: { kind: "collection", entries: clips, media: nested } as never,
      entries: resolvedEntries(),
      targets: ["1200x630.png"],
    })).toThrowError(expect.objectContaining({ code: "EXPORT_MEDIA_INVALID" }));
  });

  it("fails duplicate aspect overrides, case-folding entry collisions, and delivery-bearing variants", () => {
    const duplicateEditions = image<Clip>({
      editions: {
        square: { size: { width: 1, height: 1 } },
        alsoSquare: { size: { width: 1080, height: 1080 } },
      },
      render: renderHtml,
    });
    expect(() => planMediaExport({
      sourceId: "cards",
      definition: duplicateEditions,
      targets: ["1200x630.png"],
    })).toThrowError(expect.objectContaining({ code: "EXPORT_EDITION_ASPECT_DUPLICATE" }));

    const media = image<Clip>({ render: renderHtml });
    const colliding: ResolvedCollectionEntry<Clip>[] = [
      { id: "Ada", data: { id: "Ada", title: "Ada", tags: [] }, dataDigest: digestData({ id: "Ada", title: "Ada", tags: [] }) },
      { id: "ada", data: { id: "ada", title: "ada", tags: [] }, dataDigest: digestData({ id: "ada", title: "ada", tags: [] }) },
    ];
    expect(() => planMediaExport({
      sourceId: "cards",
      definition: collection({ entries: colliding.map((entry) => entry.data), media }),
      entries: colliding,
      targets: ["1200x630.png"],
    })).toThrowError(expect.objectContaining({ code: "EXPORT_ENTRY_DUPLICATE" }));

    const invalidVariant = image({
      variants: { bad: { width: 400 } } as never,
      render: renderHtml,
    });
    expect(() => planMediaExport({
      sourceId: "card",
      definition: invalidVariant,
      targets: ["1200x630.png"],
    })).toThrowError(expect.objectContaining({ code: "EXPORT_VARIANT_DELIVERY_FIELD" }));
  });

  it("makes request identity independent of target declaration order and rejects stale entry digests", () => {
    const media = video<Clip>({ duration: "2s", render: renderHtml });
    const definition = collection({ entries: clips, media });
    const left = planMediaExport({
      sourceId: "episodes",
      definition,
      entries: resolvedEntries(),
      targets: ["youtube", "1280x720.mp4"],
    });
    const right = planMediaExport({
      sourceId: "episodes",
      definition,
      entries: [...resolvedEntries()].reverse(),
      targets: ["1280x720.mp4", "youtube"],
    });
    expect(left.requestDigest).toBe(right.requestDigest);

    expect(() => planMediaExport({
      sourceId: "episodes",
      definition,
      entries: [{ ...resolvedEntries()[0]!, dataDigest: "0".repeat(64) }],
      targets: ["youtube"],
    })).toThrowError(expect.objectContaining({ code: "EXPORT_ENTRY_DIGEST_MISMATCH" }));

    expect(() => planMediaExport({
      sourceId: "card",
      definition: image({ render: renderHtml }),
      targets: ["1200x630", "1200x630.png"],
    })).toThrowError(expect.objectContaining({ code: "EXPORT_PATH_COLLISION" }));
  });

  it("rejects square destinations when the authored canvas is not square and no edition matches", () => {
    const landscape = image({ render: renderHtml });
    expect(() => planMediaExport({
      sourceId: "card",
      definition: landscape,
      targets: ["instagram-square"],
    })).toThrowError(expect.objectContaining({ code: "MISSING_EDITION" }));
    expect(() => planMediaExport({
      sourceId: "card",
      definition: landscape,
      targets: ["1080x1080.png"],
    })).toThrowError(expect.objectContaining({ code: "MISSING_EDITION" }));
  });

  it("exports square destinations from a square root or a matching edition", () => {
    const squareRoot = image({
      size: { width: 1080, height: 1080 },
      render: renderHtml,
    });
    expect(planMediaExport({
      sourceId: "card",
      definition: squareRoot,
      targets: ["1080x1080.png"],
    }).renditions[0]).toMatchObject({
      coordinates: { editionId: "default" },
      canvas: { width: 1080, height: 1080 },
    });

    const withEdition = image({
      editions: { square: { size: { width: 1080, height: 1080 } } },
      render: renderHtml,
    });
    expect(planMediaExport({
      sourceId: "card",
      definition: withEdition,
      targets: ["instagram-square"],
    }).renditions[0]).toMatchObject({
      coordinates: { editionId: "square" },
      canvas: { width: 1080, height: 1080 },
    });
  });
});
