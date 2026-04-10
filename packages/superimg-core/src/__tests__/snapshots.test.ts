import { describe, it, expect } from "vitest";
import { compileFromString, makeTestContext } from "./__test-utils__/index.js";

const REFERENCE_TEMPLATE = `
  import { defineScene } from 'superimg';
  export default defineScene({
    config: { fps: 30, duration: 2, width: 640, height: 360 },
    data: { title: 'Snapshot Test' },
    render(ctx) {
      const eased = ctx.std.tween(0, 1, ctx.sceneProgress, 'easeOutCubic');
      return '<div class="frame" data-progress="' + ctx.sceneProgress + '" data-eased="' + eased + '">' + ctx.data.title + '</div>';
    }
  });
`;

describe("template snapshot tests", () => {
  it("template output matches snapshot at keyframes", async () => {
    const { template } = await compileFromString(REFERENCE_TEMPLATE);
    expect(template).toBeDefined();
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const html = template!.render(makeTestContext({ sceneProgress: progress }));
      expect(html).toMatchSnapshot(`progress=${progress}`);
    }
  });
});
