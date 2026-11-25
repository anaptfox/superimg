import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
it("exports the accepted clock for captions and decoded A/V, audio and video cuts", () => {
  const script = fileURLToPath(new URL("../cut-plan.e2e.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 120_000 });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}, 150_000);
