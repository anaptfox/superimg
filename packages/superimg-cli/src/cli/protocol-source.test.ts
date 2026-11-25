import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = mkdtempSync(join(tmpdir(), "superimg-protocol-"));
const cli = resolve(import.meta.dirname, "index.ts");
const fixture = resolve(import.meta.dirname, "../../../../tests/fixtures/headless-arrangement/board.arrange.json");
const plain = join(root, "plain.json");
writeFileSync(plain, readFileSync(fixture));
afterAll(() => rmSync(root, { recursive: true, force: true }));
function run(...args: string[]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", cli, ...args], { encoding: "utf8", timeout: 20000 });
  return { ...result, json: result.stdout ? JSON.parse(result.stdout) : undefined };
}

describe("source command protocol", () => {
  it("classifies an arrangement by content and does not require a project", () => {
    expect(run("check", plain, "--json").json).toMatchObject({ schemaVersion: 1, ok: true, certainty: "completed", certaintyScope: "command", scope: "admission" });
    const bad = join(root, "bad.json");
    writeFileSync(bad, "{");
    expect(run("check", bad, "--json").json).toMatchObject({ schemaVersion: 1, ok: false, phase: "preparation", error: { code: "INVALID_JSON_INPUT" } });
  }, 30000);
  it("reports missing and unknown options, including nested commands, before a job", () => {
    for (const args of [["export", plain, "--for", "--json"], ["export", plain, "--json"], ["media", "import", "--bogus", "--json"]]) {
      const result = run(...args);
      expect(result.status).toBe(2);
      expect(result.json).toMatchObject({ schemaVersion: 1, ok: false, certainty: "not-started", certaintyScope: "command" });
      expect(result.stderr).not.toContain("@foxworth/superimg/job");
    }
  }, 30000);
  it("reports an invalid arrangement export time as a usage error", () => {
    const result = run("export", plain, "--for", "1920x1080.png", "--at", "not-a-time", "--json");
    expect(result.status).toBe(2);
    expect(result.json).toMatchObject({ ok: false, certainty: "not-started", certaintyScope: "command", error: { code: "INVALID_TIME" } });
  }, 30000);
  it("rejects malformed time selectors before both inspect and authored export", () => {
    for (const args of [["inspect", plain, "--at", "not-a-time"], ["export", "missing.media.ts", "--for", "1080x1080.png", "--at", "not-a-time"]]) {
      const result = run(...args, "--json");
      expect(result.status).toBe(2);
      expect(result.json).toMatchObject({ ok: false, certainty: "not-started", certaintyScope: "command", error: { code: "INVALID_TIME" } });
    }
    const human = spawnSync(process.execPath, ["--import", "tsx", cli, "export", plain, "--for", "1920x1080.png", "--at", "bad"], { encoding: "utf8" });
    expect(human.status).toBe(2);
  }, 30000);
  it("uses the shared JSON error envelope for missing authored sources and invalid diff", () => {
    for (const args of [["check", "missing.media.ts"], ["inspect", "missing.media.ts"], ["inspect", "missing.media.ts", "--diff", "bad"]]) {
      const result = run(...args, "--json");
      expect(result.status).not.toBe(0);
      expect(result.json).toMatchObject({ schemaVersion: 1, ok: false, certainty: expect.any(String), certaintyScope: expect.any(String), error: { code: expect.any(String), message: expect.any(String) } });
    }
    expect(run("inspect", "missing.media.ts", "--diff", "bad", "--json").status).toBe(2);
  }, 30000);
  it("uses the same refusal once across check and export", () => {
    const refused = join(root, "refused.json");
    const request = JSON.parse(readFileSync(fixture, "utf8"));
    request.spec.tracks = [];
    writeFileSync(refused, JSON.stringify(request));
    const commands = [["check", refused], ["export", refused, "--for", "1920x1080.png"]];
    const outputs = commands.map(args => run(...args, "--json"));
    for (const output of outputs) {
      expect(output.status).toBe(1);
      expect(output.json).toMatchObject({ schemaVersion: 1, certainty: "completed", phase: "admission", publication: { state: "not-started" }, error: { code: "ARRANGEMENT_REFUSED" } });
      expect(output.json.findings).toEqual(outputs[0]!.json.findings);
      expect(output.json.error.failures).toBeUndefined();
    }
  }, 30000);
  it("refuses unsupported capture modes instead of treating JSON as executable source", () => {
    expect(run("inspect", plain, "--png", "--json").json.error.code).toBe("UNSUPPORTED_SELECTION");
  });
});
