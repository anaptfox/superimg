import { afterEach, expect, it, vi } from "vitest";
import { Window } from "happy-dom";
import { waitForResources } from "./readiness.js";

const windows: Window[] = [];
function fixture() {
  const window = new Window({ settings: { disableCSSFileLoading: true } });
  windows.push(window);
  const document = window.document as unknown as Document;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fixture.invalid/fonts.css";
  document.head.append(link);
  let loaded = false;
  Object.defineProperty(link, "sheet", { get: () => loaded ? { cssRules: [] } : null });
  return {
    window, document, link,
    load() { loaded = true; link.dispatchEvent(new window.Event("load") as unknown as Event); },
    fail() { link.dispatchEvent(new window.Event("error") as unknown as Event); },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => { for (const window of windows.splice(0)) window.close(); });

it("waits for an external stylesheet before checking fonts, then waits for the newly requested font", async () => {
  const f = fixture();
  const fonts = deferred();
  const reads: string[] = [];
  let stylesheetLoaded = false;
  Object.defineProperty(f.document, "fonts", { value: {
    get ready() { reads.push(stylesheetLoaded ? "after-stylesheet" : "before-stylesheet"); return stylesheetLoaded ? fonts.promise : Promise.resolve(); },
    forEach() {},
  } });
  let completed = false;
  const pending = waitForResources(f.document, "film", 500, new AbortController().signal);
  void pending.then(() => { completed = true; }, () => { completed = true; });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(reads).toEqual([]);
  expect(completed).toBe(false);
  stylesheetLoaded = true;
  f.load();
  await vi.waitFor(() => expect(reads).toContain("after-stylesheet"));
  expect(completed).toBe(false);
  fonts.resolve();
  await pending;
});

it("accepts an already-loaded stylesheet without waiting for another load event", async () => {
  const f = fixture();
  f.load();
  Object.defineProperty(f.document, "fonts", { value: { ready: Promise.resolve(), forEach() {} } });
  await expect(waitForResources(f.document, "film", 50, new AbortController().signal)).resolves.toBeUndefined();
});

it("declares a failed external stylesheet and removes its resource listeners", async () => {
  const f = fixture();
  const remove = vi.spyOn(f.link, "removeEventListener");
  const pending = waitForResources(f.document, "film", 500, new AbortController().signal);
  const rejection = expect(pending).rejects.toMatchObject({ code: "RESOURCE_FAILED", message: expect.stringContaining("fonts.css") });
  f.fail();
  await rejection;
  expect(remove).toHaveBeenCalledWith("load", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("error", expect.any(Function));
});

it.each(["abort", "timeout"] as const)("bounds a pending stylesheet on %s and removes listeners", async (mode) => {
  const f = fixture();
  const remove = vi.spyOn(f.link, "removeEventListener");
  const controller = new AbortController();
  const pending = waitForResources(f.document, "film", 25, controller.signal);
  const rejection = expect(pending).rejects.toMatchObject({ code: mode === "abort" ? "PRESENTATION_SUPERSEDED" : "RESOURCE_READINESS_TIMEOUT" });
  if (mode === "abort") controller.abort();
  await rejection;
  expect(remove).toHaveBeenCalledWith("load", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("error", expect.any(Function));
});

it.each([undefined, null, false, 0, ""])("declares a falsy host resource rejection (%s)", async (reason) => {
  const f = fixture();
  f.link.remove();
  await expect(waitForResources(f.document, "film", 100, new AbortController().signal, () => Promise.reject(reason))).rejects.toMatchObject({ code: "RESOURCE_FAILED" });
});
