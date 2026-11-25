import type { ConsoleMessage, Page, Request, Response } from "playwright-core";
import type { JsonObject } from "@superimg/types";

/** Event listeners cover one operation window; histories from prior pooled jobs are excluded. */
export function collectFrameDiagnostics(page: Page, limit = 100, maxTextLength = 2_000): { finish(): JsonObject } {
  const console: JsonObject[] = [], errors: JsonObject[] = [], requests: JsonObject[] = [];
  const requestEntries = new Map<Request, JsonObject>();
  const dropped = { console: 0, errors: 0, requests: 0 };
  let textTruncated = false;
  const text = (value: string) => { if (value.length > maxTextLength) textTruncated = true; return value.slice(0, maxTextLength); };
  const push = (kind: keyof typeof dropped, values: JsonObject[], value: JsonObject) => { if (values.length < limit) values.push(value); else dropped[kind]++; };
  const onConsole = (message: ConsoleMessage) => {
    const location = message.location();
    push("console", console, { type: message.type(), text: text(message.text()), location: { ...location, url: text(location.url) } });
  };
  const onError = (error: Error) => push("errors", errors, { message: text(error.message), stack: text(error.stack ?? "") });
  const onRequest = (request: Request) => {
    if (requests.length >= limit) { dropped.requests++; return; }
    const value: JsonObject = { url: text(request.url()), method: request.method(), resourceType: request.resourceType(), status: null, failure: null };
    requests.push(value); requestEntries.set(request, value);
  };
  const onResponse = (response: Response) => { const value = requestEntries.get(response.request()); if (value) value.status = response.status(); };
  const onFailed = (request: Request) => { const value = requestEntries.get(request); if (value) value.failure = text(request.failure()?.errorText ?? "request failed"); };
  page.on("console", onConsole); page.on("pageerror", onError); page.on("request", onRequest); page.on("response", onResponse); page.on("requestfailed", onFailed);
  let result: JsonObject | undefined;
  return { finish() {
    if (result) return structuredClone(result);
    page.off("console", onConsole); page.off("pageerror", onError); page.off("request", onRequest); page.off("response", onResponse); page.off("requestfailed", onFailed);
    result = { scope: "operation-window", maxEntries: limit, maxTextLength, console, errors, requests, dropped, truncated: textTruncated || Object.values(dropped).some(count => count > 0), note: "Observed events only; request bodies and prior pooled-page histories are excluded." };
    requestEntries.clear();
    return structuredClone(result);
  } };
}
