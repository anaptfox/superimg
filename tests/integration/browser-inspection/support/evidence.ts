import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { browserCapture, captureAccepted, type InspectionEntry } from "../../../../scripts/browser-inspection/capture.js";
import type { AgentBrowser } from "./agent-browser.js";
import { repoRoot } from "./fixture-server.js";

const execFile = promisify(execFileCallback);
export class Evidence {
  readonly artifacts: Array<{ path: string; sha256: string }> = [];
  readonly directory: string;
  constructor(readonly browser: AgentBrowser, readonly caseName: string) {
    this.directory = join(repoRoot, "tests/integration/output/browser-inspection", `${Date.now()}-${browser.session}-${caseName}`);
  }
  async initialize(): Promise<void> { await mkdir(this.directory, { recursive: true }); }
  async fixture(bundle: string): Promise<void> {
    const path = join(this.directory, "fixture.js");
    await copyFile(bundle, path);
    await this.record(path);
  }
  async staticExample(root: string, files: readonly string[]): Promise<void> {
    for (const file of files) {
      const path = join(this.directory, "public-example", relative(root, file));
      await mkdir(dirname(path), { recursive: true });
      await copyFile(file, path);
      await this.record(path);
    }
  }
  async json(name: string, value: unknown): Promise<void> {
    const path = join(this.directory, `${name}.json`);
    await writeFile(path, JSON.stringify(value, null, 2));
    await this.record(path);
  }
  async record(path: string): Promise<void> {
    this.artifacts.push({ path, sha256: createHash("sha256").update(await readFile(path)).digest("hex") });
  }
  async screenshot(name: string): Promise<string> {
    const path = join(this.directory, `${name}.png`);
    await this.browser.command(["screenshot", path]);
    await this.record(path);
    return path;
  }
  async acceptedScreenshot(name: string, surfaceId: string, expectedFrame: number, entry: InspectionEntry = "fixture"): Promise<string> {
    const path = join(this.directory, `${name}.png`);
    const report = await captureAccepted(browserCapture(this.browser, entry, surfaceId, path), expectedFrame);
    await this.json(`${name}-capture`, report);
    try { await this.record(path); } catch { /* report preserves an incomplete screenshot */ }
    if (report.status !== "accepted") throw new Error(`Capture rejected: ${report.issues.join(", ")}. ${report.error?.message ?? ""}`);
    return path;
  }
  async captureDiagnostics(): Promise<void> {
    for (const [name, args] of [
      ["accessibility", ["snapshot"]], ["console", ["console"]], ["page-errors", ["errors"]], ["network", ["network", "requests"]],
    ] as const) {
      try { await this.json(name, await this.browser.command(args, false)); }
      catch (error) { await this.json(name, { captureError: String(error) }); }
    }
  }
  async finish(status: "passed" | "failed", details: Record<string, unknown> = {}): Promise<void> {
    let sourceIdentity = "unknown";
    let dirtyPaths: string[] = [];
    try { sourceIdentity = (await execFile("git", ["rev-parse", "HEAD"], { cwd: repoRoot })).stdout.trim(); } catch { /* diagnostic */ }
    try { dirtyPaths = (await execFile("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: repoRoot })).stdout.trim().split("\n").filter(Boolean); } catch { /* diagnostic */ }
    let browserVersions: unknown = null;
    try { browserVersions = await this.browser.evaluate("navigator.userAgentData?.getHighEntropyValues(['fullVersionList']).then(value=>value.fullVersionList)"); } catch { /* diagnostic */ }
    const sdkVersion = (JSON.parse(await readFile(join(repoRoot, "tests/integration/node_modules/@foxworth/boundary/package.json"), "utf8")) as { version: string }).version;
    await this.json("commands", this.browser.transcript);
    await writeFile(join(this.directory, "manifest.json"), JSON.stringify({
      schemaVersion: 1, case: this.caseName, status, sourceIdentity, dirtyPaths,
      session: this.browser.session, cliVersion: await this.browser.version(), sdkVersion,
      artifacts: this.artifacts, browserVersions, ...details,
    }, null, 2));
  }
}

export async function pixel(path: string, x: number, y: number): Promise<readonly number[]> {
  const { data } = await sharp(path).extract({ left: x, top: y, width: 1, height: 1 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return [...data];
}
