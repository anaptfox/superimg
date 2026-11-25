import { expect, it, vi } from "vitest";
import { exportNodeArrangement, type ArrangementExportRunner } from "./arrangement.js";

const request = { pattern: "aligned-intervals", spec: { question: "Overlap?", workRemoved: "Compare", evidence: "observation", size: { width: 1920, height: 1080 }, timeRef: { unit: "s", origin: 0 }, tracks: [{ id: "a", label: "A", intervals: [{ start: 0, end: 4 }] }, { id: "b", label: "B", intervals: [{ start: 2, end: 8 }] }], motion: { phase: "reveal", revealIds: ["b"], predict: "tick" } } };

it("exports an admitted request with the selected encoded clock and caller-owned bundle", async () => {
  const dispose = vi.fn(async () => {});
  const bundle = { artifacts: [], dispose };
  const runner = vi.fn(async (..._args: Parameters<ArrangementExportRunner>) => bundle as never);
  const result = await exportNodeArrangement({} as never, request, { for: [{ id: "still", format: "png", width: 1920, height: 1080 }], at: 0.5 }, {}, runner);
  expect(result.prepared.identity).toBeTruthy();
  expect(result.clock).toMatchObject({ encodedSeconds: 0.5 });
  expect(runner.mock.calls[0]?.[2]).toMatchObject({ at: 0.5 });
  expect(dispose).not.toHaveBeenCalled();
  await result.bundle.dispose();
  expect(dispose).toHaveBeenCalledOnce();
  await expect(exportNodeArrangement({} as never, request, { for: [{ id: "square", format: "png", width: 1080, height: 1080 }] }, {}, runner)).rejects.toMatchObject({ code: "MISSING_EDITION" });
});
