import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("reuses a streamed owned input and retains file artifacts through runtime shutdown", () => {
  const script = fileURLToPath(new URL("../owned-input.e2e.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 120_000 });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}, 150_000);
