import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BrowserConnection } from "../../../scripts/browser-inspection/transport.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

/** A real child CLI that records dispatch before returning a controlled response. */
async function fixture(response: { stdout: string; stderr?: string; exitCode?: number }) {
  const directory = await mkdtemp(join(tmpdir(), "superimg-browser-transport-"));
  directories.push(directory);
  const script = join(directory, "cli.mjs");
  const calls = join(directory, "calls.jsonl");
  await writeFile(script, `
    import { appendFileSync } from "node:fs";
    appendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + "\\n");
    process.stdout.write(${JSON.stringify(response.stdout)});
    process.stderr.write(${JSON.stringify(response.stderr ?? "")});
    process.exitCode = ${response.exitCode ?? 0};
  `);
  const browser = new BrowserConnection({
    executable: process.execPath, globalArgs: [script], session: "owned-fixture", cwd: directory,
  });
  return {
    browser,
    calls: async () => (await readFile(calls, "utf8")).trim().split("\n").map(line => JSON.parse(line)),
  };
}

describe("browser inspection CLI transport", () => {
  it.each([true, false])("preserves an unknown daemon outcome without replay (requireSuccess=%s)", async requireSuccess => {
    const envelope = { success: false, error: "The request reached the daemon; response was lost", code: "outcome_unknown" };
    const stdout = JSON.stringify(envelope) + "\n";
    const { browser, calls } = await fixture({ stdout, stderr: "socket reset\n", exitCode: 1 });
    await expect(browser.command(["eval", "window.superimgInspection.seek({frame:6})"], requireSuccess))
      .rejects.toMatchObject({ code: "COMMAND_UNCERTAIN", upstreamCode: "outcome_unknown" });
    expect(await calls()).toEqual([["--session", "owned-fixture", "--json", "eval", "window.superimgInspection.seek({frame:6})"]]);
    expect(browser.transcript).toHaveLength(1);
    expect(browser.transcript[0]).toMatchObject({ stdout, stderr: "socket reset\n", exitCode: 1, response: envelope });
    expect(browser.transcript[0].parseError).toBeUndefined();
  });

  it("rejects an unknown outcome even when the CLI exits successfully", async () => {
    const { browser, calls } = await fixture({ stdout: JSON.stringify({ success: false, code: "outcome_unknown" }) });
    await expect(browser.command(["close"], false)).rejects.toMatchObject({ code: "COMMAND_UNCERTAIN" });
    expect(await calls()).toHaveLength(1);
  });

  it.each([true, false])("keeps malformed output uncertain and retains raw diagnostics (requireSuccess=%s)", async requireSuccess => {
    const { browser, calls } = await fixture({ stdout: '{"success":', stderr: "daemon exited\n", exitCode: 1 });
    await expect(browser.command(["open", "http://localhost/"], requireSuccess)).rejects.toMatchObject({ code: "COMMAND_UNCERTAIN" });
    expect(await calls()).toHaveLength(1);
    expect(browser.transcript[0]).toMatchObject({ stdout: '{"success":', stderr: "daemon exited\n", exitCode: 1, parseError: expect.any(String) });
  });

  it("returns a known command failure only when the caller requests diagnostics", async () => {
    const envelope = { success: false, error: "Surface unavailable", code: "surface_not_found" };
    const { browser, calls } = await fixture({ stdout: JSON.stringify(envelope), exitCode: 1 });
    await expect(browser.command(["webmcp", "list"])).rejects.toMatchObject({ code: "COMMAND_FAILED" });
    await expect(browser.command(["webmcp", "list"], false)).resolves.toEqual(envelope);
    expect(await calls()).toHaveLength(2);
  });

  it.each([true, false])("rejects a changed browser lifecycle even for diagnostic callers (requireSuccess=%s)", async requireSuccess => {
    const { browser } = await fixture({ stdout: JSON.stringify({ success: true, data: { lifecycle: { relaunchedBrowser: true } } }) });
    await expect(browser.command(["snapshot"], requireSuccess)).rejects.toMatchObject({ code: "SESSION_RESTARTED" });
  });

  it("passes one argument vector and returns a successful envelope", async () => {
    const envelope = { success: true, data: { result: { frame: 6 } } };
    const { browser, calls } = await fixture({ stdout: JSON.stringify(envelope) });
    await expect(browser.evaluate("window.superimgInspection.inspect({surfaceId:'a b'})")).resolves.toEqual({ frame: 6 });
    expect(await calls()).toEqual([["--session", "owned-fixture", "--json", "eval", "window.superimgInspection.inspect({surfaceId:'a b'})"]]);
  });
});
