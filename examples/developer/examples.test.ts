import { describe, expect, it } from "vitest";
import { applyTemplateResolve } from "../../packages/superimg-core/src/index";
import { renderTemplateFrame } from "../../packages/superimg-core/src/rendering/render-frame";
import { createPreparedStdlibForTemplate } from "../../packages/superimg-core/src/shared/stdlib-capabilities";
import terminal from "./terminal/terminal.media";
import faq from "../data/faq/faq.media";
import timeline from "../data/timeline/timeline.media";
import contributors from "../data/contributors/contributors.media";
import list from "../data/list/list.media";
import npmStats from "./npm-stats/npm-stats.media";
import karaoke from "./karaoke/karaoke.media";
import markdown from "./markdown/markdown.media";
import diff from "./before-after-code/before-after-code.media";
import httpTrace from "./http-trace/http-trace.media";

type Media = Parameters<typeof applyTemplateResolve>[0];

async function resolved(media: Media, data: Record<string, unknown> = {}) {
  const result = await applyTemplateResolve(media, { data });
  const preparedStdlib = await createPreparedStdlibForTemplate(result.template);
  const duration = Number.parseFloat(String(result.template.config?.duration));
  return {
    duration,
    at(progress: number) {
      return renderTemplateFrame({ template: result.template, data: result.data, progress, composite: false, preparedStdlib }).compositeHtml;
    },
  };
}

describe("example content contracts", () => {
  it("honors terminal outputDelay in both duration and actual output arrival", async () => {
    const command = { prompt: "$ ", command: "go", output: "READY", outputDelay: 0 };
    const immediate = await resolved(terminal, { commands: [command] });
    const delayed = await resolved(terminal, { commands: [{ ...command, outputDelay: 3 }] });
    expect(delayed.duration).toBeGreaterThan(immediate.duration + 2);
    expect(immediate.at(1.8 / immediate.duration)).toContain("READY");
    expect(delayed.at(1.8 / delayed.duration)).not.toContain("READY");
  });

  it("renders terminal prompts, commands, outputs, and titles as literal text", async () => {
    const media = await resolved(terminal, {
      title: "<window>",
      commands: [{ prompt: "$ < ", command: 'echo "<raw>"', output: "<b>literal & output</b>", outputDelay: 0 }],
    });
    const html = media.at(0.85);
    expect(html).toContain("&lt;window&gt;");
    expect(html).toContain("&lt;raw&gt;");
    expect(html).toContain("&lt;b&gt;literal &amp; output&lt;/b&gt;");
    expect(html).not.toContain("<b>literal");
  });

  it.each([
    [timeline, { events: [] }, "No milestones scheduled"],
    [faq, { items: [] }, "No questions yet"],
    [contributors, { contributors: [] }, "No contributors yet"],
    [list, { items: [] }, "No list items yet"],
    [npmStats, { downloads: [] }, "No download observations"],
  ] as const)("renders an honest empty state (%#)", async (media, data, message) => {
    const html = (await resolved(media, data)).at(0.5);
    expect(html).toContain(message);
    expect(html).not.toMatch(/\b(?:NaN|Infinity)\b/);
  });

  it("fits FAQ duration to the number of questions", async () => {
    const one = await resolved(faq, { items: [{ question: "One?", answer: "A." }] });
    const five = await resolved(faq, { items: Array.from({ length: 5 }, (_, i) => ({ question: `Q${i}?`, answer: "A." })) });
    expect(five.duration).toBeGreaterThan(one.duration * 2);
  });

  it("fits karaoke to the last ending cue without mutating input order", async () => {
    const transcript = [{ text: "late", start: 2, end: 5 }, { text: "early", start: 0, end: 1 }];
    const media = await resolved(karaoke, { transcript });
    expect(media.duration).toBeGreaterThan(7);
    expect(transcript[0]!.text).toBe("late");
  });

  it("does not invent npm observations when dates are invalid", async () => {
    const media = await resolved(npmStats, { downloads: [{ date: "invalid", count: 8 }] });
    expect(media.at(0.5)).toContain("No download observations");
    for (const downloads of [
      [{ date: "2026-01-01", count: 5 }],
      [{ date: "2026-04-01", count: 4 }, { date: "2026-01-01", count: 2 }],
    ]) {
      expect((await resolved(npmStats, { downloads })).at(0.5)).not.toMatch(/\b(?:NaN|Infinity)\b/);
    }
  });

  it("falls back from invalid HTTP timings to a finite trace", async () => {
    const media = await resolved(httpTrace, { timings: [{ label: "bad", ms: NaN }], responseTimeMs: NaN });
    expect(media.at(0.5)).not.toMatch(/\b(?:NaN|Infinity)\b/);
  });

  it("preserves ordered-list markers and preformatted prose", async () => {
    const media = await resolved(markdown, { html: "<ol><li>First</li><li>Second</li></ol><pre><code>a\n  b</code></pre>" });
    const html = media.at(0.8);
    expect(html).toContain("1.</span>");
    expect(html).toContain("2.</span>");
    expect(html).toContain("white-space:pre-wrap");
  });

  it("finishes every added line when a diff grows beyond the sample", async () => {
    const code = Array.from({ length: 12 }, (_, i) => `const added${i} = ${i};`).join("\n");
    const media = await resolved(diff, { before: { code: "const removed = 0;" }, after: { code } });
    // The deleted line is collapsed; none of the twelve additions may remain collapsed.
    expect(media.at(0.8).match(/class="drow" style="height:0\.00px/g)).toHaveLength(1);
  });
});
