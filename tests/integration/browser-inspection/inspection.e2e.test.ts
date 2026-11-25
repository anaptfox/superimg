import { describe, expect, it } from "vitest";
import { AgentBrowser, touchSession, until } from "./support/agent-browser.js";
import { Evidence, pixel } from "./support/evidence.js";
import { startFixture } from "./support/fixture-server.js";
import { traceWebMcp } from "./support/cdp-trace.js";

interface Snapshot {
  schemaVersion: number; surfaceId: string; generation: number; totalFrames: number; fps: number;
  requestedFrame: number; presented: { frame: number; revision: number }; clock: { owner: string };
  [key: string]: unknown;
}

async function withCase(caseName: string, run: (browser: AgentBrowser, evidence: Evidence) => Promise<void>): Promise<void> {
  const fixture = await startFixture("inspection-app.ts");
  const browser = new AgentBrowser();
  const evidence = new Evidence(browser, caseName);
  await evidence.initialize();
  await evidence.fixture(fixture.bundle);
  let status: "passed" | "failed" = "failed";
  try {
    await browser.command(["open", `${fixture.origin}?case=${caseName}`]);
    await browser.command(["set", "viewport", "800", "500"]);
    const ready = await until(() => browser.evaluate<{ ready?: string; error?: string }>("({ready:document.body.dataset.ready,error:document.body.dataset.error})"), (value) => value.ready !== undefined, "Inspection fixture readiness");
    expect(ready, ready.error).toMatchObject({ ready: "success" });
    expect(await browser.evaluate("window.__inspectionFixture.available"), "Native WebMCP is required for this suite").toBe(true);
    const tools = await until(async () => (await browser.command(["webmcp", "list"])).data?.tools as Array<{ name: string; frameId: string }>, (tools) => tools.some((tool) => tool.name === "media.preview.inspect"), "Public Preview tool discovery");
    for (const tool of tools) browser.toolFrames.set(tool.name, tool.frameId);
    const documentPolicy = await browser.evaluate<{ compatMode: string; sandbox: string; srcdoc: boolean }>(`(()=>{const d=window.__inspectionFixture.document();const f=d.defaultView.frameElement;return{compatMode:d.compatMode,sandbox:f.getAttribute('sandbox'),srcdoc:f.hasAttribute('srcdoc')}})()`);
    expect(documentPolicy.compatMode).toBe("CSS1Compat");
    expect(documentPolicy.sandbox.split(" ")).toContain("allow-same-origin");
    expect(documentPolicy.sandbox.split(" ").includes("allow-scripts")).toBe(caseName.startsWith("canvas"));
    expect(documentPolicy.srcdoc).toBe(false);
    await evidence.json("document-policy", documentPolicy);
    await run(browser, evidence);
    status = "passed";
  } catch (error) {
    await evidence.json("failure", { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    await evidence.screenshot("failure-screen").catch(() => undefined);
    throw error;
  } finally {
    await evidence.json("sdk-execution-outcomes-final", await browser.evaluate("window.__inspectionFixture?.sdkExecutions?.() ?? []").catch(() => []));
    await evidence.captureDiagnostics();
    await evidence.finish(status, { browserVersion: await browser.evaluate("navigator.userAgent").catch(() => "unavailable") });
    try { await browser.evaluate("window.__inspectionFixture?.dispose()"); } catch { /* diagnostic-only cleanup */ }
    try { await browser.close(); } finally { await fixture.close(); }
  }
}

function js<T>(browser: AgentBrowser, method: string, input: Record<string, unknown>): Promise<T> {
  return browser.evaluate(`window.__inspectionFixture.inspection.${method}(${JSON.stringify(input)})`);
}

const toolIds: Record<string, string> = { list: "media.preview.list", inspect: "media.preview.inspect", setMode: "media.preview.set-mode", seek: "media.preview.seek-frame", selectPart: "media.preview.select-part", selectRoute: "media.preview.select-route", selectStep: "media.preview.select-step" };

async function native<T>(browser: AgentBrowser, method: string, input: Record<string, unknown>): Promise<T> {
  const result = await browser.invoke(toolIds[method]!, input);
  expect(result, JSON.stringify(result)).toMatchObject({ certainty: "completed", result: { kind: "returned" } });
  return result.result.value as T;
}

async function inspect(browser: AgentBrowser, surfaceId = "primary"): Promise<Snapshot> {
  return native(browser, "inspect", { surfaceId });
}

async function hold(browser: AgentBrowser): Promise<Snapshot> {
  const initial = await inspect(browser);
  return native(browser, "setMode", { surfaceId: "primary", mode: "inspection", expectedGeneration: initial.generation });
}

async function seek(browser: AgentBrowser, frame: number, generation: number): Promise<Snapshot> {
  return native(browser, "seek", { surfaceId: "primary", frame, expectedGeneration: generation });
}

async function failure(browser: AgentBrowser, method: string, input: Record<string, unknown>): Promise<{ code: string }> {
  const result = await browser.invoke(toolIds[method]!, input);
  expect(result, JSON.stringify(result)).toMatchObject({ certainty: "completed", result: { kind: "declared-error" } });
  return result.result.details as { code: string };
}

async function text(browser: AgentBrowser, surfaceId = "primary"): Promise<string> {
  return browser.evaluate(`window.__inspectionFixture.document('${surfaceId}').body.innerText`);
}

describe("shared inspection in a real native browser", () => {
  it("holds the seventh authored frame through delayed capture and rejects frame seven", () => withCase("seven", async (browser, evidence) => {
    const initial = await hold(browser);
    expect(initial).toMatchObject({ schemaVersion: 1, totalFrames: 7, fps: 25, presented: { frame: 0 } });
    const shown = await seek(browser, 6, initial.generation);
    expect(shown).toMatchObject({ presented: { frame: 6 }, clock: { owner: "inspection" } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const captured = await inspect(browser);
    expect(captured.presented).toEqual(shown.presented);
    expect(await js(browser, "inspect", { surfaceId: "primary" })).toEqual(captured);
    expect(await browser.evaluate("window.__inspectionFixture.bindingInspect('primary')")).toEqual(captured);
    expect(await text(browser)).toContain("SEVEN:6");
    expect(await pixel(await evidence.acceptedScreenshot("accepted-frame6", "primary", 6), 10, 10)).toEqual([225, 29, 72]);
    expect(await failure(browser, "seek", { surfaceId: "primary", frame: 7, expectedGeneration: initial.generation })).toMatchObject({ code: "FRAME_OUT_OF_RANGE" });
    await evidence.json("accepted-inspection", captured);
  }));

  it("admits a viewer only for inspection and withdraws revoked public tool registrations", () => withCase("seven", async (browser, evidence) => {
    const initial = await hold(browser);
    await browser.evaluate("window.__inspectionFixture.setRole('viewer')");
    expect((await inspect(browser)).presented).toEqual(initial.presented);
    const denied = await browser.invoke(toolIds.seek!, { surfaceId: "primary", frame: 6, expectedGeneration: initial.generation });
    expect(denied).toMatchObject({ certainty: "not-started", result: { kind: "denied", code: "CALL_NOT_ADMITTED" } });
    expect((await inspect(browser)).presented).toEqual(initial.presented);
    await browser.evaluate("window.__inspectionFixture.setRole('owner')");
    await browser.evaluate("window.__inspectionFixture.revoke()");
    const revoked = await browser.invoke(toolIds.inspect!, { surfaceId: "primary" });
    expect(revoked.certainty).toBe("not-started");
    expect(revoked.result.kind).not.toBe("returned");
    await browser.evaluate("window.__inspectionFixture.withdraw()");
    const tools = await until(async () => (await browser.command(["webmcp", "list"])).data?.tools as Array<{ name: string }>, (value) => !value.some((tool) => tool.name.startsWith("media.preview.")), "Public tool withdrawal");
    await evidence.json("public-denial", denied);
    await evidence.json("public-revocation", revoked);
    await evidence.json("withdrawn-catalog", tools);
  }));

  it("inspects a one-frame program without dropping its sole accepted frame", () => withCase("single", async (browser, evidence) => {
    const initial = await hold(browser);
    const shown = await seek(browser, 0, initial.generation);
    expect(shown).toMatchObject({ totalFrames: 1, presented: { frame: 0 } });
    expect(await text(browser)).toContain("ONE:0");
    expect(await pixel(await evidence.screenshot("one-frame"), 10, 10)).toEqual([4, 120, 87]);
    expect(await failure(browser, "seek", { surfaceId: "primary", frame: 1, expectedGeneration: initial.generation })).toMatchObject({ code: "FRAME_OUT_OF_RANGE" });
    await evidence.json("accepted-inspection", shown);
  }));

  it("shows the known boundaries of a nested fifty-seven-frame story", () => withCase("nested", async (browser, evidence) => {
    const initial = await hold(browser);
    expect(initial.totalFrames).toBe(57);
    for (const [frame, marker, expectedPixel] of [
      [24, "OPENER", [29, 78, 216]], [25, "DEMO:0", [225, 29, 72]], [31, "DEMO:6", [225, 29, 72]],
      [32, "RESULT", [4, 120, 87]], [56, "RESULT", [4, 120, 87]],
    ] as const) {
      const shown = await seek(browser, frame, initial.generation);
      expect(shown.presented.frame).toBe(frame);
      expect(await text(browser)).toContain(marker);
      expect(shown.activeOccurrences).toEqual(expect.arrayContaining([expect.objectContaining({ path: frame < 25 ? "opener" : frame < 32 ? "chapter/demo" : "chapter/result" })]));
      expect(await pixel(await evidence.screenshot(`frame${frame}`), 10, 10)).toEqual(expectedPixel);
      await evidence.json(`inspection${frame}`, shown);
    }
  }));

  for (const caseName of ["manual", "moving"]) {
    it(`selects ${caseName} deck parts absolutely and accepts only the winning rapid load`, () => withCase(caseName, async (browser, evidence) => {
      const initial = await hold(browser);
      const second = await native<Snapshot>(browser, "selectPart", { surfaceId: "primary", partId: "second", expectedGeneration: initial.generation });
      expect(second.currentPart).toBe("second");
      expect(await text(browser)).toContain("SECOND");
      const loads = await browser.evaluate("window.__inspectionFixture.loads()");
      const repeated = await native<Snapshot>(browser, "selectPart", { surfaceId: "primary", partId: "second", expectedGeneration: second.generation });
      expect(repeated.generation).toBe(second.generation);
      expect(repeated.presented).toEqual(second.presented);
      expect(await browser.evaluate("window.__inspectionFixture.loads()")).toBe(loads);
      expect(await failure(browser, "selectPart", { surfaceId: "primary", partId: "third", expectedGeneration: initial.generation })).toMatchObject({ code: "STALE_GENERATION" });
      const rapid = await browser.evaluate(`Promise.allSettled(['third','first'].map(partId=>window.__inspectionFixture.inspection.selectPart({surfaceId:'primary',partId,expectedGeneration:${second.generation}}))).then(results=>results.map(result=>result.status==='fulfilled'?{status:result.status,value:result.value}:{status:result.status,code:result.reason.code}))`);
      const current = await inspect(browser);
      expect(current.currentPart).toBe("first");
      expect(await text(browser)).toContain("FIRST");
      expect(await pixel(await evidence.screenshot("winning-part"), 10, 10)).toEqual([29, 78, 216]);
      await evidence.json("rapid-load-results", rapid);
      await evidence.json("accepted-inspection", current);
    }));
  }

  it("commits a successful branch and preserves the displayed route after a failed replacement", () => withCase("branch", async (browser, evidence) => {
    const initial = await hold(browser);
    const trace = await traceWebMcp(browser, await browser.evaluate("location.origin"));
    let advanced: Snapshot;
    try { advanced = await native<Snapshot>(browser, "selectRoute", { surfaceId: "primary", path: "branch", selection: "advanced", expectedGeneration: initial.generation }); }
    catch (error) {
      const committed = await js<Snapshot>(browser, "inspect", { surfaceId: "primary" });
      await evidence.json("native-route-committed-state", committed);
      await evidence.json("native-route-registry", await browser.command(["webmcp", "list"]));
      await evidence.json("sdk-execution-outcomes", await browser.evaluate("window.__inspectionFixture.sdkExecutions()"));
      await evidence.json("direct-route-result", await browser.evaluate(`window.__inspectionFixture.bindingSelectRoute({surfaceId:'primary',path:'branch',selection:'advanced',expectedGeneration:${committed.generation}}).then(value=>({value}),error=>({message:error.message,code:error.code}))`));
      const detached = await browser.command(["webmcp", "invoke", toolIds.selectRoute!, "--params", JSON.stringify({ surfaceId: "primary", path: "branch", selection: "basic", expectedGeneration: committed.generation }), "--detach", "--timeout", "10000", "--frame", browser.toolFrames.get(toolIds.selectRoute!)!]);
      const detachedCompletion = await until(async () => (await browser.command(["webmcp", "result", detached.data?.invocationId as string, "--timeout", "1000"])).data!, (value) => value.status !== "pending", "Detached route diagnostic completion");
      await evidence.json("detached-route-completion", detachedCompletion);
      await evidence.json("detached-route-committed-state", await js(browser, "inspect", { surfaceId: "primary" }));
      await evidence.json("detached-sdk-execution-outcomes", await browser.evaluate("window.__inspectionFixture.sdkExecutions()"));
      const restored = await js<Snapshot>(browser, "inspect", { surfaceId: "primary" });
      const detachedVideo = await browser.command(["webmcp", "invoke", toolIds.selectRoute!, "--params", JSON.stringify({ surfaceId: "primary", path: "branch", selection: "advanced", expectedGeneration: restored.generation }), "--detach", "--timeout", "10000", "--frame", browser.toolFrames.get(toolIds.selectRoute!)!]);
      await evidence.json("detached-video-route-completion", await until(async () => (await browser.command(["webmcp", "result", detachedVideo.data?.invocationId as string, "--timeout", "1000"])).data!, (value) => value.status !== "pending", "Detached video route diagnostic completion"));
      await evidence.json("detached-video-route-state", await js(browser, "inspect", { surfaceId: "primary" }));
      await evidence.json("detached-video-sdk-execution-outcomes", await browser.evaluate("window.__inspectionFixture.sdkExecutions()"));
      throw error;
    } finally { await evidence.json("raw-cdp-route-events", trace.events); trace.close(); }
    expect(advanced.routes).toEqual({ branch: "advanced" });
    expect(advanced.totalFrames).toBe(12);
    await evidence.json("candidate-document-policy", await browser.evaluate(`(()=>{const d=window.__inspectionFixture.document();return {compatMode:d.compatMode,iframe:d.defaultView.frameElement.outerHTML}})()`));
    expect(await text(browser)).toContain("ADVANCED:0");
    const prepared = await browser.evaluate<Array<{ routes: { branch: string }; resolvedAsset: string }>>("window.__inspectionFixture.preparations()");
    expect(prepared.map((entry) => entry.routes.branch)).toEqual(["basic", "advanced"]);
    expect(prepared[1]!.resolvedAsset).toBe(prepared[0]!.resolvedAsset);
    expect(await browser.evaluate("window.__inspectionFixture.document().querySelector('video').readyState")).toBeGreaterThanOrEqual(2);
    expect(await failure(browser, "selectRoute", { surfaceId: "primary", path: "branch", selection: "broken", expectedGeneration: advanced.generation })).toMatchObject({ code: "ROUTE_LOAD_FAILED" });
    const preserved = await inspect(browser);
    expect(preserved.routes).toEqual(advanced.routes);
    expect(preserved.presented).toEqual(advanced.presented);
    expect(preserved.generation).toBe(advanced.generation);
    expect(await text(browser)).toContain("ADVANCED:0");
    expect(await pixel(await evidence.screenshot("preserved-route"), 10, 10)).toEqual([124, 58, 237]);
    await evidence.json("accepted-inspection", preserved);
  }));

  it("measures simultaneous nested media and shows decoded native-video pixels", () => withCase("mixed", async (browser, evidence) => {
    const initial = await hold(browser);
    const shown = await seek(browser, 6, initial.generation);
    expect(shown.activeOccurrences).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "gallery/wide", width: 160, height: 90 }),
      expect.objectContaining({ path: "gallery/nested/picture", width: 80, height: 80 }),
      expect.objectContaining({ path: "gallery/nested/movie", width: 160, height: 90 }),
    ]));
    const video = await browser.evaluate<{ readyState: number; width: number; height: number; pixel: number[] }>(`(()=>{const v=window.__inspectionFixture.document().querySelector('video');const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const x=c.getContext('2d');x.drawImage(v,0,0);return{readyState:v.readyState,width:v.videoWidth,height:v.videoHeight,pixel:[...x.getImageData(1,1,1,1).data]}})()`);
    expect(video).toMatchObject({ width: 64, height: 48 });
    expect(video.readyState).toBeGreaterThanOrEqual(2);
    expect(video.pixel[0]).toBeGreaterThan(200);
    expect(video.pixel[1]).toBeLessThan(50);
    expect(video.pixel[2]).toBeGreaterThan(100);
    const screenshot = await evidence.screenshot("mixed-media");
    expect(await pixel(screenshot, 10, 55)).toEqual([29, 78, 216]);
    expect(await pixel(screenshot, 170, 10)).toEqual([34, 197, 94]);
    const moviePixel = await pixel(screenshot, 200, 92);
    expect(moviePixel[0]).toBeGreaterThan(200);
    expect(moviePixel[1]).toBeLessThan(50);
    await evidence.json("accepted-inspection", shown);
    await evidence.json("decoded-video", video);
  }));

  it("seeks a paused native video from frame zero to frame one before acknowledging readiness", () => withCase("paused-video", async (browser, evidence) => {
    const initial = await hold(browser);
    expect(initial.presented.frame).toBe(0);
    const shown = await seek(browser, 1, initial.generation).catch(async (error) => {
      await evidence.json("unaccepted-native-video", await browser.evaluate(`(()=>{const v=window.__inspectionFixture.document().querySelector('video');return {currentTime:v.currentTime,targetTime:Number(v.dataset.t),paused:v.paused,seeking:v.seeking,readyState:v.readyState}})()`));
      throw error;
    });
    expect(shown).toMatchObject({ fps: 25, totalFrames: 7, presented: { frame: 1 }, readiness: { status: "ready", error: null }, clock: { owner: "inspection" } });
    const video = await browser.evaluate<{ currentTime: number; targetTime: number; paused: boolean; seeking: boolean; readyState: number }>(`(()=>{const v=window.__inspectionFixture.document().querySelector('video');return {currentTime:v.currentTime,targetTime:Number(v.dataset.t),paused:v.paused,seeking:v.seeking,readyState:v.readyState}})()`);
    expect(video.currentTime).toBeCloseTo(1 / 25, 3);
    expect(video.targetTime).toBeCloseTo(1 / 25, 3);
    expect(video.paused).toBe(true);
    expect(video.seeking).toBe(false);
    expect(video.readyState).toBeGreaterThanOrEqual(2);
    const nativePixel = await pixel(await evidence.screenshot("paused-video-frame1"), 10, 10);
    expect(nativePixel[0]).toBeGreaterThan(200);
    expect(nativePixel[1]).toBeLessThan(50);
    expect(nativePixel[2]).toBeGreaterThan(100);
    await evidence.json("accepted-inspection", shown);
    await evidence.json("paused-native-video", video);
  }));

  it("selects an interactive guide step, clicks the measured real target, and accepts the host update", () => withCase("lesson", async (browser, evidence) => {
    const initial = await hold(browser);
    const selected = await native<Snapshot>(browser, "selectStep", { surfaceId: "primary", stepId: "finish", expectedGeneration: initial.generation });
    expect(selected.stepId).toBe("finish");
    const nodes = selected.nodes as Array<{ id: string; actions: string[]; bounds: { x: number; y: number; width: number; height: number } }>;
    const target = nodes.find((node) => node.id === "accept")!;
    expect(target.actions).toContain("accept");
    expect(target.bounds.width).toBe(140);
    expect(target.bounds.height).toBe(50);
    await browser.command(["mouse", "move", String(target.bounds.x + target.bounds.width / 2), String(target.bounds.y + target.bounds.height / 2)]);
    await browser.command(["mouse", "down"]);
    await browser.command(["mouse", "up"]);
    await until(() => browser.evaluate<unknown[]>("window.__inspectionFixture.actions()"), (actions) => actions.length === 1, "One real interactive click action");
    expect(await browser.evaluate("window.__inspectionFixture.actions()" )).toEqual([expect.objectContaining({ action: "accept", nodeId: "accept" })]);
    await until(() => text(browser), (value) => value.includes("SELECTED"), "Accepted host data update");
    const updated = await inspect(browser);
    expect(updated.presented.revision).toBeGreaterThan(selected.presented.revision);
    expect(updated.presented.frame).toBe(selected.presented.frame);
    expect(await pixel(await evidence.screenshot("lesson-selected"), 10, 10)).toEqual([4, 120, 87]);
    await evidence.json("accepted-inspection", updated);
    await evidence.json("real-actions", await browser.evaluate("window.__inspectionFixture.actions()"));
  }));

  for (const caseName of ["scroll", "pointer"]) {
    it(`retains an accepted inspection across real ${caseName} surface resize and resumes input`, () => withCase(caseName, async (browser, evidence) => {
      const held = await hold(browser);
      const shown = await seek(browser, 6, held.generation);
      await browser.command(["set", "viewport", "240", "500"]);
      const resized = await until(() => inspect(browser), (snapshot) => (snapshot.geometry as { surface: { width: number } }).surface.width === 240, "Resized host surface geometry");
      expect(resized.presented).toEqual(shown.presented);
      expect(resized.nodes).toContainEqual(expect.objectContaining({ id: "shared-node", bounds: { x: -40, y: 0, width: 320, height: 180 }, authoredBounds: { x: 0, y: 0, width: 320, height: 180 } }));
      await evidence.screenshot(`${caseName}-resized-inspection`);
      await native(browser, "setMode", { surfaceId: "primary", mode: "live", expectedGeneration: resized.generation });
      if (caseName === "scroll") await browser.command(["scroll", "down", "700"]);
      else await browser.command(["mouse", "move", "180", "90"]);
      const resumed = await until(() => inspect(browser), (snapshot) => snapshot.presented.frame > 30, "Input after resized inspection");
      expect(resumed.clock.owner).toBe(caseName);
      await evidence.json("resized-inspection", resized);
      await evidence.json("resized-live-inspection", resumed);
    }));

    it(`honors real reduced-motion emulation for ${caseName} input and responds when restored`, () => withCase(caseName, async (browser, evidence) => {
      if (caseName === "scroll") await browser.command(["scroll", "down", "700"]);
      else await browser.command(["mouse", "move", "260", "90"]);
      await until(() => inspect(browser), (snapshot) => snapshot.presented.frame > 10, "Input before reduced motion");
      await browser.command(["set", "media", "light", "reduced-motion"]);
      expect(await browser.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")).toBe(true);
      const reduced = await until(() => inspect(browser), (snapshot) => snapshot.presented.frame === 0, "Reduced motion accepted first frame");
      if (caseName === "scroll") await browser.command(["scroll", "down", "300"]);
      else await browser.command(["mouse", "move", "100", "90"]);
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect((await inspect(browser)).presented).toEqual(reduced.presented);
      await browser.command(["set", "media", "light"]);
      expect(await browser.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")).toBe(false);
      if (caseName === "scroll") await browser.command(["scroll", "up", "250"]);
      else await browser.command(["mouse", "move", "200", "90"]);
      const restored = await until(() => inspect(browser), (snapshot) => snapshot.presented.frame > 10, "Restored motion input");
      await evidence.json("reduced-motion-inspection", reduced);
      await evidence.json("restored-motion-inspection", restored);
    }));

    it(`suspends real ${caseName} input while inspecting and responds after returning to live mode`, () => withCase(caseName, async (browser, evidence) => {
      if (caseName === "scroll") await browser.command(["scroll", "down", "800"]);
      else {
        await browser.command(["mouse", "move", "20", "90"]);
        await browser.command(["mouse", "down"]);
        await browser.command(["mouse", "move", "260", "90", "--duration", "200", "--steps", "10"]);
        await browser.command(["mouse", "up"]);
      }
      await until(() => inspect(browser), (snapshot) => snapshot.presented.frame > 0, `Real ${caseName} changes the accepted frame`);
      const held = await hold(browser);
      const shown = await seek(browser, 6, held.generation);
      if (caseName === "scroll") await browser.command(["scroll", "down", "400"]);
      else await browser.command(["mouse", "move", "300", "90"]);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const captured = await inspect(browser);
      expect(captured.presented).toEqual(shown.presented);
      expect(await text(browser)).toContain("DRIVEN:6");
      await evidence.screenshot("inspection-held");
      await native(browser, "setMode", { surfaceId: "primary", mode: "live", expectedGeneration: captured.generation });
      if (caseName === "scroll") await browser.command(["scroll", "up", "600"]);
      else await browser.command(["mouse", "move", "120", "90"]);
      const resumed = await until(() => inspect(browser), (snapshot) => snapshot.presented.frame !== 6, `Resumed ${caseName} accepted frame`);
      expect(resumed.clock.owner).toBe(caseName);
      if (caseName === "pointer") {
        const input = await touchSession(browser);
        try {
          input.send("touchStart", [{ x: 20, y: 90 }]);
          await until(() => browser.evaluate<Array<{ type: string; trusted: boolean }>>("window.__inspectionFixture.pointerEvents()"), (events) => events.filter((event) => event.type === "pointerdown" && event.trusted).length >= 2, "Native touch pointerdown");
          input.send("touchMove", [{ x: 80, y: 90 }]);
          await until(() => inspect(browser), (snapshot) => snapshot.presented.frame > 10 && snapshot.presented.frame < 35, "Native touch seek");
          input.send("touchCancel", []);
          await until(() => browser.evaluate<Array<{ type: string; trusted: boolean }>>("window.__inspectionFixture.pointerEvents()"), (events) => events.some((event) => event.type === "pointercancel" && event.trusted), "Trusted native pointer cancellation");
          const cancelled = await inspect(browser);
          await new Promise((resolve) => setTimeout(resolve, 300));
          expect((await inspect(browser)).presented).toEqual(cancelled.presented);
          await evidence.json("native-cancel-events", await browser.evaluate("window.__inspectionFixture.pointerEvents()"));
        } finally { input.close(); }
      }
      await evidence.json("held-inspection", captured);
      await evidence.json("resumed-inspection", resumed);
    }));
  }

  it("isolates two surfaces with repeated node IDs and rejects a generation from before reload", () => withCase("isolation", async (browser, evidence) => {
    const { surfaces } = await native<{ surfaces: Array<{ surfaceId: string }> }>(browser, "list", {});
    expect(surfaces.map((surface) => surface.surfaceId).sort()).toEqual(["primary", "secondary"]);
    const primary = await hold(browser);
    const secondary = await inspect(browser, "secondary");
    const primaryNode = (primary.nodes as Array<{ id: string; bounds: { x: number } }>).find((node) => node.id === "shared-node");
    const secondaryNode = (secondary.nodes as Array<{ id: string; bounds: { x: number } }>).find((node) => node.id === "shared-node");
    expect(primaryNode?.bounds.x).toBe(0);
    expect(secondaryNode?.bounds.x).toBe(340);
    await seek(browser, 6, primary.generation);
    expect(await text(browser, "secondary")).toContain("SECONDARY");
    expect((await inspect(browser, "secondary")).presented).toEqual(secondary.presented);
    await browser.evaluate("window.__inspectionFixture.reload()");
    const reloaded = await inspect(browser);
    expect(reloaded.generation).toBeGreaterThan(primary.generation);
    expect(await failure(browser, "seek", { surfaceId: "primary", frame: 6, expectedGeneration: primary.generation })).toMatchObject({ code: "STALE_GENERATION" });
    await browser.evaluate("window.__inspectionFixture.disposePrimary()");
    expect((await native<{ surfaces: Array<{ surfaceId: string }> }>(browser, "list", {})).surfaces).toEqual([expect.objectContaining({ surfaceId: "secondary" })]);
    expect(await text(browser, "secondary")).toContain("SECONDARY");
    expect(await pixel(await evidence.screenshot("secondary-isolated"), 350, 10)).toEqual([4, 120, 87]);
    await evidence.json("secondary-inspection", await inspect(browser, "secondary"));
  }));

  it("publishes a list restricted to host-authorized surfaces and denies an unexposed surface", () => withCase("isolation-scoped", async (browser, evidence) => {
    expect((await native<{ surfaces: Array<{ surfaceId: string }> }>(browser, "list", {})).surfaces.map((surface) => surface.surfaceId)).toEqual(["primary"]);
    expect((await js<Array<{ surfaceId: string }>>(browser, "list", {})).map((surface) => surface.surfaceId).sort()).toEqual(["primary", "secondary"]);
    expect(await browser.invoke(toolIds.inspect!, { surfaceId: "secondary" })).toMatchObject({ certainty: "not-started", result: { kind: "denied", code: "CALL_NOT_ADMITTED" } });
    await evidence.json("exposed-inspection", await inspect(browser));
  }));

  it("disposes a surface during a pending native resource invocation without changing another surface", () => withCase("isolation-pending", async (browser, evidence) => {
    const initial = await hold(browser);
    const invocation = await browser.command(["webmcp", "invoke", "media.preview.seek-frame", "--params", JSON.stringify({ surfaceId: "primary", frame: 1, expectedGeneration: initial.generation }), "--detach", "--timeout", "10000"]);
    const invocationId = invocation.data?.invocationId;
    expect(typeof invocationId).toBe("string");
    await until(() => js<Snapshot>(browser, "inspect", { surfaceId: "primary" }), (snapshot) => (snapshot.readiness as { status: string }).status === "pending", "Pending native resource barrier");
    await browser.evaluate("window.__inspectionFixture.disposePrimary()");
    const completion = await until(async () => (await browser.command(["webmcp", "result", invocationId as string, "--timeout", "1000"])).data!, (value) => value.status !== "pending", "Disposed native invocation completion");
    expect(completion.status).toBe("completed");
    const output = typeof completion.output === "string" ? JSON.parse(completion.output) : completion.output;
    expect(output).toMatchObject({ certainty: "completed", result: { kind: "declared-error", details: { code: "PRESENTATION_SUPERSEDED" } } });
    expect(await text(browser, "secondary")).toContain("SECONDARY");
    expect((await native<{ surfaces: Array<{ surfaceId: string }> }>(browser, "list", {})).surfaces).toEqual([expect.objectContaining({ surfaceId: "secondary" })]);
    await evidence.json("disposed-native-invocation", completion);
    await evidence.json("secondary-inspection", await inspect(browser, "secondary"));
  }));

  it("awaits font loading and image/video decoding before reporting resource readiness", () => withCase("resource-success", async (browser, evidence) => {
    const initial = await hold(browser);
    const started = Date.now();
    const shown = await seek(browser, 1, initial.generation);
    expect(Date.now() - started).toBeGreaterThanOrEqual(800);
    expect(shown.readiness).toMatchObject({ status: "ready", error: null });
    const resources = await browser.evaluate<{ image: number; video: number; font: boolean }>(`(()=>{const d=window.__inspectionFixture.document();return{image:d.querySelector('img').naturalWidth,video:d.querySelector('video').readyState,font:d.fonts.check('20px Fixture')}})()`);
    expect(resources.image).toBe(80);
    expect(resources.video).toBeGreaterThanOrEqual(2);
    expect(resources.font).toBe(true);
    expect(await pixel(await evidence.acceptedScreenshot("decoded-resources", "primary", 1), 10, 20)).toEqual([34, 197, 94]);
    await evidence.json("accepted-inspection", shown);
    await evidence.json("decoded-resources", resources);
  }));

  it("awaits a delayed external stylesheet and the font it starts loading", () => withCase("resource-stylesheet", async (browser, evidence) => {
    const initial = await hold(browser);
    await browser.evaluate("window.__inspectionFixture.restartStylesheet()");
    const started = Date.now();
    const shown = await seek(browser, 1, initial.generation);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1800);
    expect(shown.readiness).toMatchObject({ status: "ready", error: null });
    await evidence.json("stylesheet-dom", await browser.evaluate(`(()=>{const d=window.__inspectionFixture.document();return {html:d.documentElement.outerHTML,stylesheets:[...d.styleSheets].map(s=>({href:s.href,owner:s.ownerNode.outerHTML}))}})()`));
    const resources = await browser.evaluate<{ stylesheet: boolean; family: string; font: boolean }>(`(()=>{const d=window.__inspectionFixture.document();return{stylesheet:Boolean(d.querySelector('link')?.sheet),family:d.defaultView.getComputedStyle(d.querySelector('#resource-text')).fontFamily,font:d.fonts.check('20px Fixture')}})()`);
    expect(resources).toMatchObject({ stylesheet: true, family: "Fixture", font: true });
    await evidence.json("accepted-inspection", shown);
    await evidence.json("stylesheet-font-readiness", resources);
    await evidence.screenshot("stylesheet-font-ready");
  }));

  for (const [caseName, code] of [["resource-timeout", "RESOURCE_READINESS_TIMEOUT"], ["resource-failure", "RESOURCE_FAILED"], ["resource-font-failure", "RESOURCE_FAILED"], ["resource-video-failure", "RESOURCE_FAILED"]] as const) {
    it(`reports bounded ${caseName} without a ready snapshot`, () => withCase(caseName, async (browser, evidence) => {
      const initial = await hold(browser);
      const error = await failure(browser, "seek", { surfaceId: "primary", frame: 1, expectedGeneration: initial.generation });
      expect(error).toMatchObject({ code });
      const shown = await inspect(browser);
      expect(shown.readiness).toMatchObject({ status: "failed" });
      if (!caseName.includes("timeout")) expect((shown.readiness as { error: string }).error).toContain(caseName.includes("font") ? "Font failed" : caseName.includes("video") ? "Video failed" : "Image failed");
      await evidence.json("declared-resource-failure", error);
      await evidence.json("failed-readiness", shown);
    }));
  }

  for (const caseName of ["canvas", "canvas-sidecar"]) {
    it(`keeps ${caseName} pixel coverage opaque and identifies supplied host semantics`, () => withCase(caseName, async (browser, evidence) => {
      const initial = await hold(browser);
      const shown = await seek(browser, 0, initial.generation);
      expect(await browser.evaluate("window.__inspectionFixture.document().querySelector('canvas').constructor.name")).toBe("HTMLCanvasElement");
      await evidence.json("canvas-dom", await browser.evaluate(`(()=>{const d=window.__inspectionFixture.document();const c=d.querySelector('canvas');return {html:d.body.innerHTML,canvas:c.outerHTML,chain:[c,...(()=>{const out=[];let p=c.parentElement;while(p){out.push(p);p=p.parentElement}return out})()].map(e=>{const r=e.getBoundingClientRect(),s=d.defaultView.getComputedStyle(e);return{tag:e.tagName,id:e.id,rect:{x:r.x,y:r.y,width:r.width,height:r.height},display:s.display,visibility:s.visibility,position:s.position,width:s.width,height:s.height}})}})()`));
      const coverage = shown.coverage as { opaque: Array<{ kind: string; bounds: { width: number; height: number } }> };
      expect(coverage.opaque).toContainEqual(expect.objectContaining({ kind: "canvas", bounds: expect.objectContaining({ width: 320, height: 180 }) }));
      const nodes = shown.nodes as Array<{ id: string }>;
      if (caseName === "canvas-sidecar") {
        expect(nodes).toContainEqual(expect.objectContaining({ id: "orange-target" }));
        expect(shown.semantic).toMatchObject({ $host: { suppliedBy: "fixture-host", paint: "orange" } });
      } else expect(nodes.some((node) => node.id === "orange-target")).toBe(false);
      expect(await pixel(await evidence.screenshot("opaque-canvas"), 10, 10)).toEqual([245, 158, 11]);
      await evidence.json("accepted-inspection", shown);
    }));
  }
});
