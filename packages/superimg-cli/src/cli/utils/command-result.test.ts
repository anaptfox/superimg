import { expect, it } from "vitest";
import { commandError, commandResult } from "./command-result.js";

it("retains the native receipt while reporting command and review outcomes", () => {
  const receipt = { schemaVersion: 0, publication: { state: "completed" }, findings: [{ code: "LOW_CONTRAST_TEXT" }] };
  expect(commandResult(receipt)).toMatchObject({ schemaVersion: 1, resultSchemaVersion: 0, ok: true, certainty: "completed", certaintyScope: "command", publication: { state: "completed" } });
  const failure = commandResult(receipt, { ok: false, code: "REVIEW_FAILED", message: "Review did not pass" });
  expect(failure).toMatchObject({ schemaVersion: 1, ok: false, publication: { state: "completed" }, error: { code: "REVIEW_FAILED" } });
  expect(failure.findings).toEqual(receipt.findings);
  expect(JSON.stringify(failure).match(/LOW_CONTRAST_TEXT/g)).toHaveLength(1);
});

it("preserves publication uncertainty and does not duplicate findings", () => {
  const usage = commandError({ code: "INVALID_TIME", message: "Bad time" });
  expect(usage).toMatchObject({ exitCode: 2, result: { ok: false, certainty: "not-started", certaintyScope: "command" } });
  const refusal = commandError({ code: "ARRANGEMENT_REFUSED", phase: "admission", effectState: "not-started", findings: [{ code: "MISSING" }], details: { findings: [{ code: "MISSING" }], cause: "layout" } });
  expect(refusal).toMatchObject({ exitCode: 1, result: { certainty: "completed", certaintyScope: "command", publication: { state: "not-started" }, error: { details: { cause: "layout" } } } });
  expect(JSON.stringify(refusal.result).match(/MISSING/g)).toHaveLength(1);
  expect(commandError({ code: "PUBLICATION_FAILED", effectState: "unknown" }).result).toMatchObject({ certainty: "unknown", certaintyScope: "publication", publication: { state: "unknown" } });
});
