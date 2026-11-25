import { expect, it } from "vitest";
import { arrangementSelectionFindings } from "./arrangement-selection.js";

it("reports clamped requests and leaves an exact final-frame request warning-free", () => {
  const selected = { frame: 179, encodedSeconds: 179 / 30 };
  const late = arrangementSelectionFindings({ ...selected, requestedSeconds: 99, clamped: true });
  expect(late).toEqual([expect.objectContaining({ code: "STILL_TIME_CLAMPED", severity: "warning", details: { requestedSeconds: 99, resolvedSeconds: 179 / 30, frame: 179 } })]);
  expect(arrangementSelectionFindings({ ...selected, requestedSeconds: 179 / 30, clamped: false })).toEqual([]);
});
