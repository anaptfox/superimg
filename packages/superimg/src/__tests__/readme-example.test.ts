import { describe, expect, it } from "vitest";
import {
  collection,
  Frame,
  image,
  sequence,
  Stack,
  Text,
  time,
  video,
} from "../index.js";
import { check, exportMedia, init, render } from "../runtime.node.js";

/**
 * Runnable verification of the examples and predictions in the root README.md.
 */
const announce = video({
  size: { width: 1920, height: 1080 },
  duration: "6s",
  sample: { title: "Launch day", eyebrow: "v1.0" },
  editions: {
    square: { size: { width: 1080, height: 1080 } },
  },
  render(ctx) {
    const t = ctx.director({ enter: "20%", hold: "65%", exit: "15%" });
    const compact = ctx.width <= ctx.height;

    return Frame(
      { width: "fill", height: "fill", fill: "#0b1020" },
      Stack(
        { width: "fill", height: "fill", align: "center", justify: "center", gap: 18 },
        Text({ variant: "eyebrow", color: "#93c5fd" }, ctx.data.eyebrow),
        Text(
          {
            variant: "display",
            color: "#ffffff",
            size: compact ? 64 : 84,
            maxWidth: ctx.width * (compact ? 0.78 : 0.85),
            align: "center",
            motion: t.motion({ y: 24, exit: true }),
          },
          ctx.data.title,
        ),
      ),
    );
  },
});

describe("README examples and predictions", () => {
  it("checks cleanly, composes into a sequence, and renders deterministic HTML", async () => {
    const runtime = await init();
    try {
      const report = await check(announce, { runtime });
      expect(report.ok, JSON.stringify(report.findings, null, 2)).toBe(true);

      const html = await render(announce, {
        runtime,
        as: "html",
        at: "1.5s",
        data: { title: "Media as code" },
      });
      const markup = await html.text();
      expect(markup).toContain("Media as code");
      expect(markup).toContain("v1.0");

      const bumper = image({
        size: { width: 1920, height: 1080 },
        render: () =>
          Frame(
            { width: "fill", height: "fill", fill: "#f6f3ec" },
            Stack(
              { width: "fill", height: "fill", align: "center", justify: "center" },
              Text({ variant: "display", color: "#111827" }, "SuperImg"),
            ),
          ),
      });

      const launchProgram = sequence([
        { id: "opener", content: bumper, hold: "1.5s" },
        { id: "announce", content: announce },
      ]);
      const launchFilm = time(launchProgram, {
        size: { width: 1920, height: 1080 },
        fps: 30,
      });

      const composedReport = await check(launchFilm, { runtime });
      expect(composedReport.ok, JSON.stringify(composedReport.findings, null, 2)).toBe(true);
    } finally {
      await runtime.dispose();
    }
  });

  it("refuses square export with MISSING_EDITION when no square edition exists", async () => {
    const landscapeOnly = video({
      size: { width: 1920, height: 1080 },
      duration: "4s",
      render: () =>
        Frame(
          { width: "fill", height: "fill", fill: "#0b1020" },
          Stack(
            { width: "fill", height: "fill", align: "center", justify: "center" },
            Text({ variant: "display", color: "#ffffff" }, "Landscape only"),
          ),
        ),
    });

    const runtime = await init();
    try {
      await expect(
        exportMedia(landscapeOnly, {
          runtime,
          for: ["instagram-square"],
        }),
      ).rejects.toMatchObject({
        code: "MEDIA_PREFLIGHT_FAILED",
        findings: expect.arrayContaining([
          expect.objectContaining({ code: "MISSING_EDITION" }),
        ]),
      });
    } finally {
      await runtime.dispose();
    }
  });

  it("catches UNPAINTED_STAGE before rendering when a scene forgets its background", async () => {
    const unpainted = image({
      size: { width: 1200, height: 630 },
      render: () =>
        Stack(
          { width: "fill", height: "fill", align: "center", justify: "center" },
          Text({ variant: "display", color: "#111827" }, "Missing fill"),
        ),
    });

    const runtime = await init();
    try {
      const report = await check(unpainted, { runtime });
      expect(report.ok).toBe(false);
      expect(report.findings.some((finding) => finding.code === "UNPAINTED_STAGE")).toBe(true);
    } finally {
      await runtime.dispose();
    }
  });

  it("checks a static campaign collection without mutating entries", async () => {
    interface Product {
      id: string;
      name: string;
    }
    const kit = collection({
      entries: [
        { id: "camera", name: "Camera" },
        { id: "tripod", name: "Tripod" },
      ] satisfies readonly Product[],
      media: image<Product>({
        size: { width: 1200, height: 630 },
        render: (ctx) =>
          Frame(
            { width: "fill", height: "fill", fill: "#f6f3ec" },
            Stack(
              { width: "fill", height: "fill", align: "center", justify: "center" },
              Text({ variant: "display", color: "#111827" }, ctx.data.name),
            ),
          ),
      }),
    });

    const runtime = await init();
    try {
      const report = await check(kit, { runtime });
      expect(report.ok, JSON.stringify(report.findings, null, 2)).toBe(true);
    } finally {
      await runtime.dispose();
    }
  });
});
