import { expect, it } from "vitest";
import { captureAccepted, browserCapture, comparable, selectFrame, type CaptureSnapshot } from "../../../scripts/browser-inspection/capture.js";
import type { BrowserIdentity } from "../../../scripts/browser-inspection/transport.js";
import { AgentBrowser, until } from "./support/agent-browser.js";
import { Evidence } from "./support/evidence.js";
import { startFixture } from "./support/fixture-server.js";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

function snapshot(): CaptureSnapshot {
  return { surfaceId: "story", generation: 1, requestedFrame: 6, presented: { frame: 6, revision: 8 }, readiness: { status: "ready" }, clock: { owner: "inspection" }, geometry: { dpr: 1, content: { x: 0, y: 0, width: 320, height: 180 } }, coordinates: { entryId: null, variantId: null, editionId: "default" }, width: 320, height: 180, fps: 25, totalFrames: 7, source: { id: "story", revision: "a" } };
}
function identity(): BrowserIdentity {
  return { targetId: "tab-1", browserVersion: "Chromium test", url: "http://localhost/", documentTimeOrigin: 100, viewport: { width: 800, height: 600, dpr: 1, x: 0, y: 0 } };
}
async function capture(mutate: (value: CaptureSnapshot, browser: BrowserIdentity) => void = () => {}) {
  const value = snapshot(), browser = identity();
  let calls = 0;
  const report = await captureAccepted({
    inspect: async () => structuredClone(value), identity: async () => structuredClone(browser),
    screenshot: async () => { calls++; mutate(value, browser); },
  }, 6);
  return { report, calls };
}

it("accepts only a matching presentation surrounding one screenshot", async () => {
  const { report, calls } = await capture();
  expect(calls).toBe(1);
  expect(report).toMatchObject({ status: "accepted", issues: [], before: snapshot(), after: snapshot() });
});

it.each([
  ["generation", (s: CaptureSnapshot) => { s.generation++; }],
  ["pending seek", (s: CaptureSnapshot) => { s.requestedFrame = 2; }],
  ["revision", (s: CaptureSnapshot) => { s.presented!.revision++; }],
  ["clock", (s: CaptureSnapshot) => { s.clock.owner = "live"; }],
  ["resource", (s: CaptureSnapshot) => { s.readiness.status = "pending"; }],
  ["source", (s: CaptureSnapshot) => { s.source = { id: "story", revision: "b" }; }],
  ["target", (_s: CaptureSnapshot, b: BrowserIdentity) => { b.targetId = "tab-2"; }],
  ["reload", (_s: CaptureSnapshot, b: BrowserIdentity) => { b.documentTimeOrigin++; }],
  ["viewport", (_s: CaptureSnapshot, b: BrowserIdentity) => { b.viewport.width++; }],
] as const)("retains and rejects a %s change without recapturing", async (_name, mutate) => {
  const { report, calls } = await capture(mutate);
  expect(report.status).toBe("rejected");
  expect(report.issues.length).toBeGreaterThan(0);
  expect(calls).toBe(1);
  expect(report.before).toEqual(snapshot());
});

it("retains diagnostic pixels for unready media and records screenshot failures", async () => {
  const value = snapshot(); value.readiness.status = "unverified";
  let calls = 0;
  const report = await captureAccepted({ inspect: async () => value, identity: async () => identity(), screenshot: async () => { calls++; } }, 6);
  expect(calls).toBe(1);
  expect(report).toMatchObject({ status: "rejected", issues: ["resources-not-ready"] });
  const failure = await captureAccepted({ inspect: async () => snapshot(), identity: async () => identity(), screenshot: async () => { throw new Error("Disconnected"); } }, 6);
  expect(failure).toMatchObject({ status: "rejected", error: { message: "Disconnected" }, issues: ["capture-incomplete"] });
});

it("allows comparison across source changes but rejects different frames and viewports", async () => {
  const a = (await capture()).report, b = structuredClone(a);
  b.after!.source = { id: "story", revision: "new-build" };
  b.after!.generation++;
  expect(comparable(a, b)).toEqual({ comparable: true, reasons: [] });
  b.after!.presented!.frame = 2;
  expect(comparable(a, b).reasons).toContain("frame-differs");
  b.browserAfter!.viewport.dpr = 2;
  expect(comparable(a, b).reasons).toContain("viewport-differs");
});

it("rejects an actual seek during the screenshot and keeps the old pixels", async () => {
  const fixture = await startFixture("inspection-app.ts");
  const browser = new AgentBrowser();
  const evidence = new Evidence(browser, "capture-race");
  await evidence.initialize();
  let status: "passed" | "failed" = "failed";
  try {
    await browser.command(["open", `${fixture.origin}?case=seven`]);
    await until(() => browser.evaluate("document.body.dataset.ready"), value => value === "success", "Fixture ready");
    await selectFrame(browser, "fixture", "primary", 6);
    const path = join(evidence.directory, "raced-frame.png");
    const adapter = browserCapture(browser, "fixture", "primary", path);
    const screenshot = adapter.screenshot;
    let captures = 0;
    adapter.screenshot = async () => {
      captures++;
      await screenshot();
      await selectFrame(browser, "fixture", "primary", 2);
    };
    const report = await captureAccepted(adapter, 6);
    await evidence.json("rejected-capture", report);
    await evidence.record(path);
    expect(report).toMatchObject({ status: "rejected", before: { presented: { frame: 6 } }, after: { presented: { frame: 2 } } });
    expect(captures).toBe(1);
    expect((await readFile(path)).length).toBeGreaterThan(100);
    status = "passed";
  } finally {
    await evidence.finish(status);
    try { await browser.close(); } finally { await fixture.close(); }
  }
});
