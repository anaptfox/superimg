import { describe, expect, it } from "vitest";
import { layoutInteractiveGuide, resolveInteractiveClock } from "@foxworth/superimg/interactive/define";
import lesson from "./request-journey.media.js";

describe("request-journey interactive contract", () => {
  it("declares one four-step eight-second lesson", () => {
    expect(lesson.kind).toBe("interactive");
    expect(lesson.guide.steps).toHaveLength(4);
    const clock = resolveInteractiveClock(lesson.guide);
    const layout = layoutInteractiveGuide(
      lesson.guide,
      clock.durationSeconds,
      clock.fps,
    );
    expect(clock.durationSeconds).toBe(8);
    expect(layout.checkpoints[0]?.stepId).toBe("dns");
    expect(layout.checkpoints[3]?.stepId).toBe("response");
  });
});
