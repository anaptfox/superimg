import { describe, it, expect } from "vitest";
import { compileFromString, makeTestContext, makeTestContextAtProgress, asMarkup } from "./__test-utils__/index.js";

describe("render pipeline integration", () => {
  it("renders media at keyframes with correct timeline.progress", async () => {
    const code = `
      import { define, Html } from '@foxworth/superimg';
      export default define({
        config: { fps: 2, duration: 1, width: 640, height: 360 },
        render(ctx) {
          return Html({ width: 'fill', height: 'fill', html: '<div style="opacity: ' + ctx.timeline.progress + '">Frame</div>' });
        }
      });
    `;
    const { media } = await compileFromString(code);
    expect(media).toBeDefined();

    const frames = [0, 0.5, 1].map((progress) =>
      asMarkup(media!.render(makeTestContextAtProgress(progress)))
    );
    expect(frames[0]).toContain("opacity: 0");
    expect(frames[1]).toContain("opacity: 0.5");
    expect(frames[2]).toContain("opacity: 1");
  });

  it("merges data with ctx.data", async () => {
    const code = `
      import { define, Html } from '@foxworth/superimg';
      export default define({
        sample: { title: 'Default' },
        render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<div>' + ctx.data.title + '</div>' }); }
      });
    `;
    const { media } = await compileFromString(code);
    const ctx = makeTestContext({ data: { title: "Override" } });
    const html = asMarkup(media!.render(ctx));
    expect(html).toContain("Override");
  });

  it("uses stdlib interpolate in output", async () => {
    const code = `
      import { define, Html } from '@foxworth/superimg';
      export default define({
        render(ctx) {
          const eased = ctx.std.interpolate(ctx.timeline.progress, [0, 1], [0, 1], 'easeOutCubic');
          return Html({ width: 'fill', height: 'fill', html: '<div data-eased="' + eased + '"></div>' });
        }
      });
    `;
    const { media } = await compileFromString(code);
    const html = asMarkup(media!.render(makeTestContextAtProgress(0.5)));
    expect(html).toContain('data-eased="');
    const match = html.match(/data-eased="([^"]+)"/);
    expect(match).toBeTruthy();
    const eased = parseFloat(match![1]!);
    expect(eased).toBeGreaterThan(0.5);
    expect(eased).toBeLessThanOrEqual(1);
  });
});
