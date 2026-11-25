/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import { measureBrowserDocument, waitForBrowserResources } from "@superimg/core/html";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.replaceChildren(); });

it("owns bounded text and SVG measurements independently of later DOM mutation", () => {
  document.body.innerHTML = '<div id="root"><svg><text data-si-node="label">Original label</text></svg><canvas></canvas><p>outside cap</p></div>';
  const text = document.querySelector("text")!;
  Object.defineProperties(text, {
    getBBox: { value: () => ({ x: 1, y: 2, width: 30, height: 12 }) },
    getComputedTextLength: { value: () => 28.5 },
  });
  const observation = measureBrowserDocument({ document, rootId: "root", maxNodes: 4, maxTextLength: 8 });
  expect(observation.coverage).toMatchObject({ sampledNodes: 4, truncated: true });
  expect(observation.nodes.find(node => node.id === "label")).toMatchObject({ text: "Origina…", svg: { bounds: { x: 1, y: 2, width: 30, height: 12 }, textLength: 28.5 } });
  expect(observation.coverage.opaque).toMatchObject([{ kind: "canvas" }]);
  text.textContent = "Changed";
  expect(observation.nodes.find(node => node.id === "label")?.text).toBe("Origina…");
});

it("joins measured clipping ancestors without observing outside the bounded tree", () => {
  document.body.innerHTML = '<div id="outside"><div id="root" data-si-node="clip"><div data-si-node="wrapper"><span data-si-node="label">Caption</span></div></div></div>';
  const root = document.getElementById("root")!, label = document.querySelector("span")!;
  const rootBounds = { x: 1, y: 2, width: 100, height: 40 };
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue(rootBounds as DOMRect);
  const clipping = { "overflow-x": "hidden", "overflow-y": "clip", "clip-path": "inset(0px)", "mask-image": "none", "text-overflow": "ellipsis", "white-space": "nowrap", transform: "matrix(1, 0, 0, 1, 2, 3)" };
  vi.spyOn(window, "getComputedStyle").mockImplementation(((el: Element) => ({ getPropertyValue: (name: string) => el === root ? clipping[name as keyof typeof clipping] ?? "" : "" })) as typeof window.getComputedStyle);
  const observation = measureBrowserDocument({ root, maxNodes: 3 });
  expect(observation.coverage).toMatchObject({ sampledNodes: 3, truncated: false });
  const child = observation.nodes.find(node => node.id === "label")!;
  const parent = observation.nodes[child.parentIndex!]!;
  const ancestor = observation.nodes[parent.parentIndex!]!;
  expect(parent).toMatchObject({ id: "wrapper", parentIndex: 0 });
  expect(ancestor).toMatchObject({ id: "clip", parentIndex: null, clipping, bounds: rootBounds });
  expect(observation.nodes.some(node => node.id === "outside")).toBe(false);
  const saved = JSON.stringify(observation);
  clipping["overflow-x"] = "visible"; rootBounds.width = 999; root.id = "changed"; label.textContent = "Changed";
  expect(JSON.stringify(observation)).toBe(saved);
});

it("discloses text-only truncation while preserving complete semantic identities", () => {
  document.body.innerHTML = '<div id="root"><span></span></div>';
  const label = document.querySelector("span")!, id = "node".repeat(50), occurrence = "occurrence".repeat(20);
  label.setAttribute("data-si-node", id); label.setAttribute("data-si-occurrence", occurrence); label.textContent = "caption ".repeat(30);
  const observation = measureBrowserDocument({ document, rootId: "root", maxNodes: 10 });
  expect(observation.coverage).toMatchObject({ sampledNodes: 2, truncated: true, maxTextLength: 120 });
  expect(observation.nodes[1]).toMatchObject({ id, occurrence, parentIndex: 0 });
  expect(observation.nodes[1]!.text).toHaveLength(120);
  expect(observation.nodes[1]!.text.endsWith("…")).toBe(true);
});

it("bounds clipping and typography style values and discloses style-only truncation", () => {
  document.body.innerHTML = '<div id="root">Short</div>';
  vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: (name: string) => name === "clip-path" || name === "font-family" ? "x".repeat(150) : "" } as CSSStyleDeclaration);
  const observation = measureBrowserDocument({ document, rootId: "root", maxNodes: 10 });
  expect(observation.coverage).toMatchObject({ sampledNodes: 1, truncated: true });
  expect(observation.nodes[0]).toMatchObject({ text: "Short", parentIndex: null, clipping: { "clip-path": `${"x".repeat(119)}…` }, typography: { "font-family": `${"x".repeat(119)}…` } });
});

it("uses a per-element decode barrier for duplicate source images", async () => {
  document.body.innerHTML = '<div id="root"><img src="same.png"><img src="same.png"></div>';
  let release!: () => void;
  const second = new Promise<void>(resolve => { release = resolve; });
  const images = [...document.querySelectorAll("img")];
  for (const image of images) Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 10 } });
  images[0]!.decode = vi.fn(async () => {});
  images[1]!.decode = vi.fn(() => second);
  let settled = false;
  const waiting = waitForBrowserResources({ document, rootId: "root", timeoutMs: 300, waitFonts: false }).then(result => { settled = true; return result; });
  await vi.waitFor(() => expect(images[1]!.decode).toHaveBeenCalledOnce());
  expect(settled).toBe(false);
  release();
  expect(await waiting).toEqual({ ok: true, open: [] });
});

it("includes root and pseudo-element CSS resources and SVG image URLs", async () => {
  document.body.innerHTML = '<div id="root"><svg><image href="https://fixture.test/svg.png"/></svg></div>';
  const root = document.getElementById("root")!;
  const original = document.createElement.bind(document);
  const urls: string[] = [];
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    const element = original(tag);
    if (tag === "img") {
      Object.defineProperties(element, { complete: { value: true }, naturalWidth: { value: 10 } });
      (element as HTMLImageElement).decode = async () => { urls.push((element as HTMLImageElement).src); };
    }
    return element;
  }) as typeof document.createElement);
  vi.spyOn(window, "getComputedStyle").mockImplementation(((element: Element, pseudo: string | null) => ({ getPropertyValue: (name: string) => name === "background-image" && element === root ? `url("https://fixture.test/${pseudo ? "pseudo" : "root"}.png")` : "none" })) as typeof window.getComputedStyle);
  expect(await waitForBrowserResources({ root, timeoutMs: 300, waitFonts: false })).toMatchObject({ ok: true });
  expect(new Set(urls)).toEqual(new Set(["https://fixture.test/root.png", "https://fixture.test/pseudo.png", "https://fixture.test/svg.png"]));
});

it("reports resource failure without fabricating ready output", async () => {
  document.body.innerHTML = '<div id="root"><img src="missing.png"></div>';
  const image = document.querySelector("img")!;
  Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 0 } });
  expect(await waitForBrowserResources({ document, rootId: "root", timeoutMs: 100, waitFonts: false })).toMatchObject({ ok: false, error: expect.stringContaining("missing.png") });
});

it("keeps image failure diagnostics stable when loading fails after observation", async () => {
  document.body.innerHTML = '<div id="root"><img src="late-missing.png"></div>';
  const image = document.querySelector("img")!;
  Object.defineProperty(image, "complete", { value: false });
  const listeners = vi.spyOn(image, "addEventListener");
  const waiting = waitForBrowserResources({ document, rootId: "root", timeoutMs: 300, waitFonts: false });
  await vi.waitFor(() => expect(listeners).toHaveBeenCalledWith("error", expect.any(Function), { once: true }));
  image.dispatchEvent(new Event("error"));
  expect(await waiting).toMatchObject({ ok: false, error: expect.stringContaining("Image failed to load:") });
});

it("bounds a hanging image and releases listeners when aborted", async () => {
  document.body.innerHTML = '<div id="root"><img src="pending.png"></div>';
  const image = document.querySelector("img")!;
  Object.defineProperty(image, "complete", { value: false });
  const remove = vi.spyOn(image, "removeEventListener");
  const controller = new AbortController();
  const waiting = waitForBrowserResources({ document, rootId: "root", timeoutMs: 300, waitFonts: false, signal: controller.signal });
  await Promise.resolve();
  controller.abort();
  expect(await waiting).toMatchObject({ ok: false, aborted: true });
  expect(remove).toHaveBeenCalledWith("load", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("error", expect.any(Function));
});

it.each(["timeout", "abort"] as const)("stops video polling after %s without changing its clock", async mode => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="root"><video src="pending.mp4"></video></div>';
  const video = document.querySelector("video")!;
  const reads = vi.fn(() => 0);
  Object.defineProperties(video, { readyState: { get: reads }, currentTime: { get: () => 0, set: () => { throw new Error("Probe must never seek"); } } });
  const controller = new AbortController();
  const waiting = waitForBrowserResources({ document, rootId: "root", timeoutMs: 40, waitFonts: false, waitImages: false, waitVideos: true, signal: controller.signal });
  await vi.advanceTimersByTimeAsync(20);
  if (mode === "abort") controller.abort();
  else await vi.advanceTimersByTimeAsync(25);
  expect(await waiting).toMatchObject({ ok: false, ...(mode === "abort" ? { aborted: true } : { error: "timeout" }) });
  const stoppedAt = reads.mock.calls.length;
  await vi.advanceTimersByTimeAsync(1000);
  expect(reads).toHaveBeenCalledTimes(stoppedAt);
  expect(vi.getTimerCount()).toBe(0);
});
