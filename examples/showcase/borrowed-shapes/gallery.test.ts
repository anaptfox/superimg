import { describe, expect, it } from "vitest";
import { lowerInteractiveDefinition } from "@foxworth/superimg/interactive/define";
import { createRenderContext } from "../../../packages/superimg-core/src/rendering/create-render-context";
import { galleryLive } from "./gallery";
import { INITIAL_FORMS } from "./model";

describe("host-driven Forms adapter", () => {
  it("carries host time and input identity into the accepted semantic snapshot", () => {
    const runtime = lowerInteractiveDefinition(galleryLive);
    let renders = 0;
    runtime.subscribeInteractiveScene(() => renders++);
    for (const [guideFrame, logicalSeconds, inputVersion] of [[0, 16.5, 1], [650, 4.5, 2], [12, 28.5, 3]]) {
      runtime.render(createRenderContext(guideFrame!, 30, 900, 1280, 720,
        { ...INITIAL_FORMS, logicalSeconds: logicalSeconds!, inputVersion: inputVersion! }));
      const node = runtime.getInteractiveSnapshot().nodes.find(node => node.id === "forms-observation")!;
      expect(node.metadata).toMatchObject({ seconds: logicalSeconds, inputVersion, logicalGrains: 19600, uniqueIds: 18000 });
      expect(node.metadata.parts).toEqual([3000, 3000, 3000, 3000, 3000, 3000]);
    }
    expect(renders).toBe(3);
  });
});
