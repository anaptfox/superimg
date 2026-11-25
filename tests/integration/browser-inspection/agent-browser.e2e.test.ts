import { describe, expect, it } from "vitest";
import { AgentBrowser, until } from "./support/agent-browser.js";
import { Evidence, pixel } from "./support/evidence.js";
import { startFixture } from "./support/fixture-server.js";

interface Tool { name: string; frameId: string; inputSchema?: Record<string, unknown>; }

describe("real agent-browser and Boundary WebMCP", () => {
  it("discovers an installed binding, checks success and admission, captures pixels, and withdraws", async () => {
    const fixture = await startFixture("native-binding-app.ts");
    const browser = new AgentBrowser();
    const evidence = new Evidence(browser, "native-binding");
    await evidence.initialize();
    await evidence.fixture(fixture.bundle);
    let status: "passed" | "failed" = "failed";
    let details: Record<string, unknown> = {};
    try {
      expect(await browser.version()).toBe("agent-browser 0.39.1");
      await browser.command(["open", fixture.origin]);
      await browser.command(["set", "viewport", "800", "500"]);
      const ready = await until(() => browser.evaluate<{ ready?: string; error?: string }>("({ready:document.body.dataset.ready,error:document.body.dataset.error})"), (value) => value.ready !== undefined, "Fixture readiness");
      expect(ready, ready.error).toMatchObject({ ready: "success" });
      expect(await browser.evaluate("window.__inspectionFixture.available"), "Required native WebMCP API must be present").toBe(true);
      const tools = await until(async () => (await browser.command(["webmcp", "list"])).data?.tools as Tool[], (value) => value.some((tool) => tool.name === "fixture.preview.inspect"), "Native tool discovery");
      const tool = tools.find((candidate) => candidate.name === "fixture.preview.inspect")!;
      const schema = await browser.command(["webmcp", "list", tool.name, "--frame", tool.frameId]);
      await evidence.json("tool-catalog", tools);
      await evidence.json("tool-schema", schema);
      expect(JSON.stringify(schema)).toContain("surfaceId");
      const succeeded = await browser.invoke(tool.name, { surfaceId: "primary" }, tool.frameId);
      await evidence.json("boundary-success", succeeded);
      expect(succeeded).toMatchObject({ certainty: "completed", result: { kind: "returned", value: { surfaceId: "primary", frame: 0, frameCount: 7, fps: 25 } } });
      await browser.evaluate("window.__inspectionFixture.deny()");
      const denied = await browser.invoke(tool.name, { surfaceId: "primary" }, tool.frameId);
      await evidence.json("boundary-denial", denied);
      expect(denied.certainty).toBe("not-started");
      expect(denied.result.kind).toBe("denied");
      expect(JSON.stringify(denied)).toContain("denied");
      await browser.evaluate("window.__inspectionFixture.seek(6)");
      await until(() => browser.evaluate<string>("document.querySelector('#primary iframe').contentDocument.body.innerText"), (value) => value.includes("frame6"), "Real displayed last-frame marker");
      const screenshot = await evidence.screenshot("frame6");
      expect(await pixel(screenshot, 10, 10)).toEqual([225, 29, 72]);
      await browser.evaluate("window.__inspectionFixture.withdraw()");
      const withdrawn = await until(async () => (await browser.command(["webmcp", "list"])).data?.tools as Tool[], (value) => !value.some((candidate) => candidate.name === tool.name), "Native registration withdrawal");
      await evidence.json("withdrawn-catalog", withdrawn);
      details = { browserVersion: await browser.evaluate("navigator.userAgent"), outcome: succeeded, deniedOutcome: denied, assertions: ["native-discovery", "object-input", "checked-success", "host-denial", "frame6-pixel", "withdrawal"] };
      status = "passed";
    } finally {
      await evidence.captureDiagnostics();
      await evidence.finish(status, details);
      try { await browser.evaluate("window.__inspectionFixture?.dispose()"); } catch { /* retain earlier failure */ }
      try { await browser.close(); } finally { await fixture.close(); }
    }
  });

  it("keeps the ordinary JavaScript fixture usable when native WebMCP is disabled", async () => {
    const fixture = await startFixture("native-binding-app.ts");
    // --no-webmcp disables agent-browser's observation/enable flags. Newer
    // Chromium can expose the page API independently, so disable that runtime
    // feature explicitly to exercise the actual unavailable-host fallback.
    const browser = new AgentBrowser({ globalArgs: ["--no-webmcp", "--args", "--disable-blink-features=WebMCP"] });
    const evidence = new Evidence(browser, "javascript-fallback");
    await evidence.initialize();
    await evidence.fixture(fixture.bundle);
    await evidence.json("browser-configuration", { globalArgs: browser.options.globalArgs });
    let status: "passed" | "failed" = "failed";
    try {
      await browser.command(["open", fixture.origin]);
      await until(() => browser.evaluate<string>("document.body.dataset.ready"), (value) => value !== undefined, "JavaScript fallback readiness");
      expect(await browser.evaluate("window.__inspectionFixture.available")).toBe(false);
      const catalog = await browser.command(["webmcp", "list"]);
      await evidence.json("disabled-native-catalog", catalog);
      expect(catalog.data?.tools).toEqual([]);
      expect(await browser.evaluate("window.__inspectionFixture.inspect()")).toEqual({ frame: 0, frameCount: 7, fps: 25 });
      await browser.evaluate("window.__inspectionFixture.seek(6)");
      await until(() => browser.evaluate<string>("document.querySelector('#primary iframe').contentDocument.body.innerText"), (value) => value.includes("frame6"), "Fallback frame pixels");
      expect(await pixel(await evidence.screenshot("fallback-frame6"), 10, 10)).toEqual([225, 29, 72]);
      status = "passed";
    } finally {
      await evidence.captureDiagnostics();
      await evidence.finish(status, { assertions: ["explicit-runtime-feature-disabled", "absence-feature-detection", "empty-native-catalog", "ordinary-js", "frame6-pixel"] });
      try { await browser.close(); } finally { await fixture.close(); }
    }
  });
});
