import { EventEmitter } from "node:events";
import type { Page } from "playwright-core";
import { describe, expect, it } from "vitest";
import { collectFrameDiagnostics } from "./frame-diagnostics.js";

describe("operation-scoped browser diagnostics", () => {
  it("discloses text-only truncation without inventing dropped entries", () => {
    const page = new EventEmitter();
    const observation = collectFrameDiagnostics(page as unknown as Page, 100, 8);
    page.emit("console", { type: () => "warning", text: () => "long warning", location: () => ({ url: "fixture", lineNumber: 1, columnNumber: 0 }) });
    expect(observation.finish()).toMatchObject({ console: [{ text: "long war" }], dropped: { console: 0, errors: 0, requests: 0 }, truncated: true });
    expect(collectFrameDiagnostics(page as unknown as Page).finish()).toMatchObject({ console: [], truncated: false });
  });
  it("isolates pooled page windows, bounds content and detaches after completion", () => {
    const page = new EventEmitter();
    const consoleMessage = (value: string) => ({ type: () => "warning", text: () => value, location: () => ({ url: "fixture", lineNumber: 1, columnNumber: 0 }) });
    page.emit("console", consoleMessage("previous frame"));
    const first = collectFrameDiagnostics(page as unknown as Page, 1, 8);
    page.emit("console", consoleMessage("current warning")); page.emit("console", consoleMessage("overflow"));
    const request = { url: () => "http://fixture/missing", method: () => "GET", resourceType: () => "image", failure: () => ({ errorText: "aborted" }) };
    page.emit("request", request); page.emit("requestfailed", request);
    const facts = first.finish();
    expect(facts).toMatchObject({ scope: "operation-window", console: [{ text: "current " }], dropped: { console: 1 }, truncated: true, requests: [{ failure: "aborted" }] });
    page.emit("console", consoleMessage("late"));
    expect(first.finish()).toEqual(facts);
    expect(page.listenerCount("console")).toBe(0);
    const second = collectFrameDiagnostics(page as unknown as Page);
    expect(second.finish()).toMatchObject({ console: [], errors: [], requests: [] });
  });
});
