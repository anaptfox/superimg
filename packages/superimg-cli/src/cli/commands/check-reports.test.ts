import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCheck } from "./check.js";

const originalCwd = process.cwd();
const roots: string[] = [];

afterEach(async () => {
  process.chdir(originalCwd);
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function source(name: string, contents: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "superimg-check-report-"));
  roots.push(root);
  process.chdir(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  const path = join(root, `${name}.media.ts`);
  await writeFile(path, contents);
  return path;
}

describe("check public evidence", { concurrent: false }, () => {
  it("keeps particle geometry private without losing identity findings or public sample metadata", async () => {
    const path = await source("grains", `
      import { video, Frame, Fill, Vector, vector } from "@foxworth/superimg";
      const bins = Array.from({ length: 32 }, (_, bin) => ({
        id: "grain-bin-" + bin,
        d: Array.from({ length: 256 }, (_, grain) => {
          const x = (bin * 7 + grain) % 310 + 1;
          const y = Math.floor(grain / 2) % 160 + 1;
          return "M" + x + "," + y + "h1v1h-1Z";
        }).join(""),
      }));
      export default video({ duration: "3f", fps: 10, size: { width: 320, height: 180 },
        render(ctx) {
          return Frame({ id: "stage", width: "fill", height: "fill" },
            Fill({ id: "ground", color: "#080e12" }),
            Vector({ id: "city", width: 320, height: 180 },
              ...bins.map(bin => vector.path({ ...bin, fill: "#bfa271" })),
              ...(ctx.timeline.frame === 1 ? [] : [vector.path({
                id: "route-marker", d: "M30,30h3v3h-3Z", fill: "#8ad8da",
              })]),
            ),
          );
        },
      });
    `);

    const report = await runCheck(path, { at: "f:0,f:1,f:2" });
    const json = JSON.stringify(report);
    const publicReport = JSON.parse(json);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: "IDENTITY_FLICKER", nodeId: "route-marker", frame: 1,
    }));
    expect(publicReport.issues).toEqual(report.issues);
    expect(publicReport.runtime.findings).toEqual(report.runtime.findings);
    expect(report.runtime.findings).toContainEqual(expect.objectContaining({ code: "IDENTITY_FLICKER", details: expect.objectContaining({ frame: 1, nodeId: "route-marker" }) }));
    expect(report.coverage).toEqual(report.runtime.coverage);
    expect(report.coverage?.samples.map(sample => sample.frame)).toEqual([0, 1, 2]);
    expect(report.coverage?.checks.find(check => check.id === "sampled-identity")?.frames).toEqual([0, 1, 2]);
    expect(publicReport.phases).toEqual(report.phases);
    expect(publicReport.samples).toHaveLength(3);
    expect(publicReport.samples[2]).toMatchObject({
      at: "f:2", frame: 2, progress: 1, seconds: 0.2, timelineSeconds: 0.3,
      htmlBytes: expect.any(Number), colors: expect.arrayContaining(["#bfa271"]),
    });
    // 8,192 authored grains remain available to internal analysis, not the JSON consumer.
    expect(Object.getOwnPropertyDescriptor(report.samples[0], "_html")?.enumerable).toBe(false);
    expect(Object.getOwnPropertyDescriptor(report.samples[0], "_nodes")?.enumerable).toBe(false);
    expect(json).not.toContain('"_html"');
    expect(json).not.toContain('"_nodes"');
    expect(json).not.toContain("grain-bin-");
    expect(Buffer.byteLength(json)).toBeLessThan(12_000);
  }, 20_000);

  it("resolves seconds, milliseconds, and frame tokens after dynamic duration resolution", async () => {
    const path = await source("clock", `
      import { video, Html } from "@foxworth/superimg";
      export default video({ duration: "0.5s", fps: 10, size: { width: 320, height: 180 },
        resolve: () => ({ duration: 2.1 }),
        render: ctx => Html({ id: "clock", width: "fill", height: "fill", html:
          "<p>frame" + ctx.timeline.frame + "|scene" + ctx.timeline.seconds.toFixed(2) + "</p>" }),
      });
    `);

    const report = await runCheck(path, { at: "1.6s,1600ms,16f,f:16,0.8,9s" });

    expect(report.config).toMatchObject({ fps: 10, duration: 2.1, totalFrames: 21 });
    expect(report.samples.slice(0, 5).map(sample => sample.frame)).toEqual([16, 16, 16, 16, 16]);
    for (const sample of report.samples.slice(0, 5)) {
      expect(sample).toMatchObject({ seconds: 1.6, text: ["frame16|scene1.68"] });
      expect(sample.timelineSeconds).toBeCloseTo(1.68);
    }
    expect(report.samples[5]).toMatchObject({
      at: "9s", frame: 20, seconds: 2, timelineSeconds: 2.1, text: ["frame20|scene2.10"],
    });
    expect(report.issues).not.toContainEqual(expect.objectContaining({ code: "RENDER_EXCEPTION" }));
  }, 20_000);
});
