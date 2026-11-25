import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AgentBrowser, until } from "./support/agent-browser.js";
import { Evidence, pixel } from "./support/evidence.js";
import { repoRoot, startBuiltExample } from "./support/fixture-server.js";

it("uses the public example controls, scoped native tools, admission toggle, withdrawal, and JavaScript inspection", async () => {
  const fixture = await startBuiltExample();
  const browser = new AgentBrowser();
  const evidence = new Evidence(browser, "public-example");
  await evidence.initialize();
  await evidence.staticExample(fixture.root, fixture.files);
  let status: "passed" | "failed" = "failed";
  try {
    await browser.command(["open", fixture.origin]);
    await browser.command(["set", "viewport", "1100", "1200"]);
    await until(() => browser.evaluate<string>("document.querySelector('#status').textContent"), (value) => value.includes("Presented frame"), "Public example presentation");
    await browser.command(["fill", "#frame", "6"]);
    await browser.command(["click", "button[type=submit]"]);
    await until(() => browser.evaluate<string>("document.querySelector('#status').textContent"), (value) => value.includes("Presented frame 6") && value.includes("inspection"), "Ordinary frame control accepted frame six");
    await browser.command(["select", "#route", "contrast"]);
    await until(() => browser.evaluate<string>("document.querySelector('#snapshot').textContent"), (value) => value.includes('"chapter": "contrast"') && value.includes('"status": "ready"'), "Ordinary route control accepted contrast");
    await browser.command(["click", "button[type=submit]"]);
    const selected = await until(() => browser.evaluate<Record<string, unknown>>("window.superimgInspection.inspect({surfaceId:'story'})"), (value) => (value.presented as { frame: number }).frame === 6, "Public route frame six");
    const sourceInputs = await Promise.all(["story.ts", "main.ts", "style.css"].map(file => readFile(join(repoRoot, "examples/apps/agent-inspection/src", file), "utf8")));
    expect(selected.source).toMatchObject({ revision: `host-source-sha256:${createHash("sha256").update(JSON.stringify(sourceInputs)).digest("hex")}` });
    const geometry = selected.geometry as { surface: { x: number; y: number } };
    await evidence.json("ordinary-controls-inspection", selected);
    expect(await pixel(await evidence.acceptedScreenshot("public-contrast-frame6", "story", 6, "public"), Math.round(geometry.surface.x + 20), Math.round(geometry.surface.y + 20))).toEqual([145, 59, 83]);
    const tools = await until(async () => (await browser.command(["webmcp", "list"])).data?.tools as Array<{ name: string; frameId: string }>, (value) => value.length === 6, "Public example native tool catalog");
    for (const tool of tools) browser.toolFrames.set(tool.name, tool.frameId);
    expect(tools.map((tool) => tool.name)).not.toContain("media.preview.select-step");
    const listed = await browser.invoke("media.preview.list", {});
    expect(listed).toMatchObject({ certainty: "completed", result: { kind: "returned", value: { surfaces: [expect.objectContaining({ surfaceId: "story" })] } } });
    expect(await browser.invoke("media.preview.inspect", { surfaceId: "other" })).toMatchObject({ certainty: "not-started", result: { kind: "denied", code: "CALL_NOT_ADMITTED" } });
    await browser.command(["uncheck", "#allow-agent"]);
    expect(await browser.invoke("media.preview.inspect", { surfaceId: "story" })).toMatchObject({ certainty: "not-started", result: { kind: "denied", code: "CALL_NOT_ADMITTED" } });
    await browser.command(["check", "#allow-agent"]);
    const accepted = await browser.invoke("media.preview.seek-frame", { surfaceId: "story", frame: 3, expectedGeneration: selected.generation });
    expect(accepted).toMatchObject({ certainty: "completed", result: { kind: "returned", value: { presented: { frame: 3 }, clock: { owner: "inspection" } } } });
    expect(await browser.evaluate("document.querySelector('#status').textContent")).toContain("Presented frame 3");
    await evidence.json("public-native-outcome", accepted);
    await browser.command(["click", "#withdraw"]);
    await until(async () => (await browser.command(["webmcp", "list"])).data?.tools as unknown[], (value) => value.length === 0, "Public example tool withdrawal");
    expect(await browser.evaluate("document.querySelector('#transport').textContent")).toContain("JavaScript inspection remains available");
    const fallback = await browser.evaluate<Record<string, unknown>>(`window.superimgInspection.seek({surfaceId:'story',frame:6,expectedGeneration:${selected.generation}})`);
    expect(fallback.presented).toMatchObject({ frame: 6 });
    expect(await browser.evaluate("document.querySelector('#status').textContent")).toContain("Presented frame 6");
    await evidence.json("withdrawn-javascript-inspection", fallback);
    status = "passed";
  } catch (error) {
    await evidence.json("failure", { message: String(error) });
    await evidence.screenshot("failure-screen").catch(() => undefined);
    throw error;
  } finally {
    await evidence.captureDiagnostics();
    await evidence.finish(status);
    try { await browser.close(); } finally { await fixture.close(); }
  }
});
