import { describe, expect, it, vi } from "vitest";
import { InteractiveGuideController } from "./guide-controller.js";

const guide = {
  id: "lesson",
  steps: [
    { id: "one", label: "One", duration: "1s", scene: { state: "one" } },
    { id: "two", label: "Two", duration: "1s", scene: { state: "two" } },
  ],
} as const;

describe("InteractiveGuideController", () => {
  it("navigates exact guide checkpoints and emits one ordered update", async () => {
    let frame = 0;
    const seekFrame = vi.fn(async (next: number) => {
      frame = next;
    });
    const controller = new InteractiveGuideController({
      get currentFrame() {
        return frame;
      },
      fps: 30,
      duration: 2,
      seekFrame,
    });
    const changes: Array<[string | null, number]> = [];
    controller.onStepChange((step, index) =>
      changes.push([step?.stepId ?? null, index]),
    );
    controller.load(guide);

    await controller.goToStep("two");
    expect(seekFrame).toHaveBeenCalledWith(30);
    expect(controller.currentStep?.stepId).toBe("two");
    expect(changes).toEqual([["two", 1]]);
  });

  it("fails explicit navigation to an unknown step", async () => {
    const controller = new InteractiveGuideController({
      currentFrame: 0,
      fps: 30,
      duration: 2,
      seekFrame() {},
    });
    controller.load(guide);
    await expect(controller.goToStep("missing")).rejects.toThrow(/Unknown/);
  });
});
