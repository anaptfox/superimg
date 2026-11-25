import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateTemplateIR } from "./ir-eval.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function source(contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), "superimg-ir-eval-"));
  directories.push(directory);
  const path = join(directory, "cards.media.ts");
  writeFileSync(path, contents);
  return path;
}

describe("projection-safe media evaluation", () => {
  it("captures seconds in the data-resolved fps and duration clock", async () => {
    const path = source(`
      import { video, Html } from "@foxworth/superimg";
      export default video({
        fps: 10, duration: "1s", sample: { fps: 10, duration: 1 },
        resolve: ({ data }) => ({ fps: data.fps, duration: data.duration }),
        render: (ctx) => Html({ width: "fill", height: "fill", html: \`<p>frame\${ctx.timeline.frame}</p>\` }),
      });
    `);
    const result = await evaluateTemplateIR(path, { data: { fps: 20, duration: 2 }, captureSeconds: [1], captureFrames: [1000] });
    expect(result.config).toMatchObject({ fps: 20, duration: 2, totalFrames: 40 });
    expect(result.captures?.get(20)?.html).toContain("frame20");
    expect(result.captures?.get(39)?.html).toContain("frame39");
  });

  it("selects the first static collection entry by default and an explicit entry by id", async () => {
    const path = source(`
      import { collection, image, Html } from "@foxworth/superimg";
      export default collection({
        entries: [{ id: "ada", title: "Ada" }, { id: "grace", title: "Grace" }],
        media: image({ render(ctx) { return Html({ width: "fill", height: "fill", html: \`<h1>\${ctx.data.title}</h1>\` }); } }),
      });
    `);
    const first = await evaluateTemplateIR(path, { captureFrames: [0] });
    expect(first.entryId).toBe("ada");
    expect(first.captures?.get(0)?.html).toContain("Ada");

    const selected = await evaluateTemplateIR(path, { entry: "grace", captureFrames: [0] });
    expect(selected.entryId).toBe("grace");
    expect(selected.captures?.get(0)?.html).toContain("Grace");
  });

  it("rejects --entry for ordinary media", async () => {
    const path = source(`
      import { image, Html } from "@foxworth/superimg";
      export default image({ render() { return Html({ width: "fill", height: "fill", html: "<h1>One</h1>" }); } });
    `);
    await expect(evaluateTemplateIR(path, { entry: "nope" })).rejects.toThrow(/--entry/);
  });

  it("bundles the interactive-owned lowering for offline sample evaluation", async () => {
    const path = source(`
      import { Html } from "@foxworth/superimg";
      import { defineInteractive } from "@foxworth/superimg/interactive/define";
      export default defineInteractive({
        guide: { id: "lesson", steps: [{ id: "one", label: "One", duration: "1s", scene: { state: "focus" } }] },
        sample: { title: "Live lesson" },
        render(ctx) {
          ctx.scene.states({ focus: { operations: [] } });
          return Html({ width: "fill", height: "fill", html: \`<h1>\${ctx.data.title}:\${ctx.scene.snapshot().activeState}</h1>\` });
        },
      });
    `);
    const result = await evaluateTemplateIR(path, { captureFrames: [0] });
    expect(result.captures?.get(0)?.html).toContain("Live lesson:focus");
  });
});
