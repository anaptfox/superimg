import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lockBrowserSession } from "../../../scripts/browser-inspection/session.js";
import { captureAccepted, comparable, mediaCrop, type CaptureSnapshot } from "../../../scripts/browser-inspection/capture.js";
import { browserDiagnostics, finishBrowserObservation } from "../../../scripts/browser-inspection/diagnostics.js";
import type { BrowserConnection, BrowserIdentity } from "../../../scripts/browser-inspection/transport.js";

const snapshot = (): CaptureSnapshot => ({ surfaceId: "media", generation: 1, requestedFrame: 0, presented: { frame: 0, revision: 1 }, readiness: { status: "ready" }, clock: { owner: "inspection" }, source: { id: "media", revision: "a" }, coordinates: { entryId: null, variantId: null, editionId: "square" }, width: 100, height: 100, fps: 30, totalFrames: 1, geometry: { content: { x: 20, y: 30, width: 100, height: 100 } } });
const identity = (): BrowserIdentity => ({ targetId: "tab", browserVersion: "Chromium test", url: "http://localhost/", documentTimeOrigin: 1, viewport: { width: 200, height: 200, dpr: 2, x: 0, y: 0 } });
describe("browser evidence", () => {
  it("serializes named and recorded callers by daemon namespace and releases the lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-session-lock-"));
    try {
      const release = await lockBrowserSession("same", {}, root);
      await expect(lockBrowserSession("same", {}, root)).rejects.toThrow("Session is busy");
      const other = await lockBrowserSession("other", {}, root); await other();
      await release(); await (await lockBrowserSession("same", {}, root))();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("locks the effective socket despite inactive overrides, relative paths, and filesystem aliases", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-session-path-"));
    const releases: Array<() => Promise<void>> = [];
    try {
      const sockets = join(root, "agent-browser"), alias = join(root, "socket-alias"), locks = join(root, "locks");
      await mkdir(sockets); await symlink(sockets, alias, "dir");
      releases.push(await lockBrowserSession("same", { AGENT_BROWSER_SOCKET_DIR: sockets, HOME: "/one", XDG_RUNTIME_DIR: "/ignored-one" }, locks));
      for (const environment of [
        { AGENT_BROWSER_SOCKET_DIR: sockets, HOME: "/two", XDG_RUNTIME_DIR: "/ignored-two" },
        { AGENT_BROWSER_SOCKET_DIR: "", XDG_RUNTIME_DIR: root, HOME: "/three" },
        { AGENT_BROWSER_SOCKET_DIR: alias },
        { AGENT_BROWSER_SOCKET_DIR: "agent-browser" },
      ]) await expect(lockBrowserSession("same", environment, locks, root)).rejects.toThrow("Session is busy");
      releases.push(await lockBrowserSession("same", { AGENT_BROWSER_SOCKET_DIR: join(root, "another-daemon") }, locks));
      releases.push(await lockBrowserSession("same", { HOME: root, AGENT_BROWSER_SOCKET_DIR: "", XDG_RUNTIME_DIR: "" }, locks));
      await expect(lockBrowserSession("same", { AGENT_BROWSER_SOCKET_DIR: join(root, ".agent-browser") }, locks)).rejects.toThrow("Session is busy");
    } finally { for (const release of releases.reverse()) await release(); await rm(root, { recursive: true, force: true }); }
  });
  it("separates namespaces while serializing aliases normalized by agent-browser 0.39.1", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-session-namespace-"));
    const releases: Array<() => Promise<void>> = [];
    const environment = { AGENT_BROWSER_SOCKET_DIR: join(root, "sockets") };
    try {
      releases.push(await lockBrowserSession("same", environment, root));
      releases.push(await lockBrowserSession("same", { ...environment, AGENT_BROWSER_NAMESPACE: "Worktree: One" }, root));
      await expect(lockBrowserSession("same", { ...environment, AGENT_BROWSER_NAMESPACE: "worktree-one" }, root)).rejects.toThrow("Session is busy");
      releases.push(await lockBrowserSession("same", { ...environment, AGENT_BROWSER_NAMESPACE: "other" }, root));
      await expect(lockBrowserSession("same", { ...environment, AGENT_BROWSER_NAMESPACE: " ---___ " }, root)).rejects.toThrow("Session is busy");
    } finally { for (const release of releases.reverse()) await release(); await rm(root, { recursive: true, force: true }); }
  });
  it("uses content geometry and captured pixel scale, recording clipping", () => {
    expect(mediaCrop(snapshot(), identity(), { width: 400, height: 400 })).toMatchObject({ left: 40, top: 60, width: 200, height: 200, clipped: false, scaleX: 2 });
    const value = snapshot(); value.geometry = { content: { x: -10, y: 20, width: 100, height: 100 } };
    expect(mediaCrop(value, identity(), { width: 200, height: 200 })).toMatchObject({ left: 0, width: 90, clipped: true });
    value.geometry = {};
    expect(() => mediaCrop(value, identity(), { width: 200, height: 200 })).toThrow("geometry");
  });
  it("compares media across inspector movement but rejects missing coordinates and renderer changes", async () => {
    const a = await captureAccepted({ inspect: async () => snapshot(), identity: async () => identity(), screenshot: async () => {} }, 0);
    const b = structuredClone(a); b.after!.geometry = { content: { x: 80, y: 30, width: 100, height: 100 } };
    expect(comparable(a, b)).toEqual({ comparable: true, reasons: [] });
    delete b.after!.coordinates;
    expect(comparable(a, b).reasons).toContain("selection-coordinates-unknown");
    b.browserAfter!.browserVersion = "another";
    expect(comparable(a, b).reasons).toContain("browser-version-differs");
  });
  it("bounds diagnostics and stops observation after uncertainty", async () => {
    let calls = 0;
    const browser = { command: async () => { calls++; if (calls === 2) throw Object.assign(new Error("unknown"), { code: "COMMAND_UNCERTAIN" }); return { success: true, data: { messages: Array.from({ length: 200 }, () => ({ text: "x".repeat(10_000) })) } }; } } as unknown as BrowserConnection;
    const result = await browserDiagnostics(browser);
    expect(calls).toBe(2);
    expect(JSON.stringify(result).length).toBeLessThan(66_000);
    expect(result).toMatchObject({ observations: { console: { truncated: true, scope: "buffered-unscoped" }, errors: { code: "COMMAND_UNCERTAIN" } } });
  });
  it("stops all daemon commands after uncertain trace cleanup and retains the failure code", async () => {
    const calls: string[][] = [];
    const browser = { command: async (args: string[]) => { calls.push(args); throw Object.assign(new Error("trace reply lost"), { code: "COMMAND_UNCERTAIN" }); } } as unknown as BrowserConnection;
    const finished = await finishBrowserObservation(browser, { enabled: true, tracePath: "/tmp/owned-trace.json" });
    expect(calls).toEqual([["trace", "stop", "/tmp/owned-trace.json"]]);
    expect(finished).toMatchObject({ traceError: { code: "COMMAND_UNCERTAIN" }, diagnostics: { reason: "transport-outcome-unknown" } });
    calls.splice(0);
    await finishBrowserObservation(browser, { enabled: true, tracePath: "/tmp/owned-trace.json", priorError: { code: "COMMAND_UNCERTAIN" } });
    expect(calls).toEqual([]);
  });
});
