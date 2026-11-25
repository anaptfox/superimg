import { describe, expect, it, vi } from "vitest";
import type { TemplateBundle } from "@superimg/types";
import { loadPreviewCandidate, PreviewRequestGate } from "./preview-request";
import { createTemplateLoader, templateSource, type BundleState } from "./template-loader";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function bundle(revision: string): TemplateBundle {
  return { code: revision, source: { id: "city.media.ts", revision } } as TemplateBundle;
}

const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe("live preview request acceptance", () => {
  it("routes prepared native imports through the preview host", async () => {
    const identity = "a".repeat(64);
    const module = { identity, moduleUrl: `https://superimg-native.invalid/${identity}/surface.js`, bridgeUrl: `https://superimg-native.invalid/${identity}/bridge.js` };
    const template = { config: { nativeModuleSets: [module] }, render: () => module.moduleUrl };
    const load = createTemplateLoader({ fetch: vi.fn<typeof fetch>().mockResolvedValue(response(bundle("native"))), importCode: async () => ({ default: template }), showError: vi.fn() });
    await load("/api/template", { current: null });
    expect(template.render()).toBe(`/api/template-output/${identity}/surface.js`);
    expect(module.bridgeUrl).toBe(`/api/template-output/${identity}/bridge.js`);
  });
  it("loads a multi-chunk candidate via its revision URL and retains the prior bundle when import fails", async () => {
    const sourceMap = { version: 3, sources: [], names: [], mappings: "" };
    const candidate = { ...bundle("next"), moduleUrl: "/api/template-output/abc/main.js", outputs: [
      { type: "chunk", fileName: "main.js", code: "entry", isEntry: true, sourceMap },
      { type: "chunk", fileName: "helper.js", code: "helper", isEntry: false, sourceMap },
    ] };
    const importUrl = vi.fn().mockRejectedValueOnce(new Error("companion missing")).mockResolvedValueOnce({ default: { name: "next" } });
    const importCode = vi.fn();
    const load = createTemplateLoader({ fetch: vi.fn<typeof fetch>().mockImplementation(async () => response(candidate)), importCode, importUrl, showError: vi.fn() });
    const state: BundleState = { current: bundle("previous") };
    await expect(load("/api/template", state)).rejects.toThrow("companion missing");
    expect(state.current?.source?.revision).toBe("previous");
    await expect(load("/api/template", state)).resolves.toEqual({ name: "next" });
    expect(importUrl).toHaveBeenCalledWith(candidate.moduleUrl);
    expect(importCode).not.toHaveBeenCalled();
    expect(state.current?.source?.revision).toBe("next");
  });
  it("keeps the newer helper revision when an older bundle response arrives last", async () => {
    const older = deferred<Response>();
    const showError = vi.fn();
    const imported = vi.fn(async (code: string) => ({ default: { camera: code } }));
    const transport = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => older.promise)
      .mockResolvedValueOnce(response(bundle("corrected-camera")));
    const load = createTemplateLoader({ fetch: transport, importCode: imported, showError });
    const state: BundleState = { current: null };
    const gate = new PreviewRequestGate(vi.fn());
    const present = vi.fn(async (template: unknown) => template);
    const firstRequest = gate.begin(531, false);
    const first = loadPreviewCandidate(firstRequest, (signal) => load("/api/template", state, { signal }), present)
      .catch((error: unknown) => error);
    const nextRequest = gate.begin(0, false);
    const next = await loadPreviewCandidate(nextRequest, (signal) => load("/api/template", state, { signal, fresh: true }), present);
    older.resolve(response(bundle("old-camera")));

    expect(await first).toMatchObject({ name: "AbortError" });
    expect(present).toHaveBeenCalledExactlyOnceWith(next.template);
    expect(imported).toHaveBeenCalledExactlyOnceWith("corrected-camera");
    expect(state.current?.source?.revision).toBe("corrected-camera");
    expect(templateSource(next.template)?.revision).toBe("corrected-camera");
    expect(transport.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(String(transport.mock.calls[1]?.[0])).toContain("reload=1");
    expect(showError).not.toHaveBeenCalled();
  });

  it("does not activate or publish a delayed old Blob import after a newer load", async () => {
    const olderImport = deferred<{ default: unknown }>();
    const importStarted = deferred<void>();
    const oldTemplate = { camera: "old" };
    const load = createTemplateLoader({
      fetch: vi.fn<typeof fetch>()
        .mockResolvedValueOnce(response(bundle("old")))
        .mockResolvedValueOnce(response(bundle("new"))),
      importCode: async (code) => {
        if (code === "old") { importStarted.resolve(); return olderImport.promise; }
        return { default: { camera: code } };
      },
      showError: vi.fn(),
    });
    const state: BundleState = { current: null };
    const gate = new PreviewRequestGate(vi.fn());
    const present = vi.fn(async (template: unknown) => template);
    const first = loadPreviewCandidate(gate.begin(531, false), (signal) => load("/api/template", state, { signal }), present)
      .catch((error: unknown) => error);
    await importStarted.promise;
    const next = await loadPreviewCandidate(gate.begin(531, false), (signal) => load("/api/template", state, { signal }), present);
    olderImport.resolve({ default: oldTemplate });

    expect(await first).toMatchObject({ name: "AbortError" });
    expect(present).toHaveBeenCalledExactlyOnceWith(next.template);
    expect(state.current?.source?.revision).toBe("new");
    expect(templateSource(oldTemplate)).toBeUndefined();
  });

  it.each(["network", "compile"] as const)("ignores an obsolete %s error without clearing current source or showing an overlay", async (failure) => {
    const older = deferred<Response>();
    const showError = vi.fn();
    const load = createTemplateLoader({
      fetch: vi.fn<typeof fetch>()
        .mockImplementationOnce(() => older.promise)
        .mockResolvedValueOnce(response(bundle("new"))),
      importCode: async (code) => ({ default: { camera: code } }),
      showError,
    });
    const state: BundleState = { current: null };
    const gate = new PreviewRequestGate(vi.fn());
    const oldRequest = gate.begin(531, false);
    const first = load("/api/template", state, { signal: oldRequest.signal }).catch((error: unknown) => error);
    const newRequest = gate.begin(531, false);
    await load("/api/template", state, { signal: newRequest.signal });
    if (failure === "network") older.reject(new Error("old request disconnected"));
    else older.resolve(response({ error: { code: "COMPILE_ERROR", message: "old camera is invalid" } }, 500));

    expect(await first).toMatchObject({ name: "AbortError" });
    expect(state.current?.source?.revision).toBe("new");
    expect(showError).not.toHaveBeenCalled();
  });

  it("ignores an old compile diagnostic whose JSON body finishes after the next import", async () => {
    const oldBody = deferred<unknown>();
    const bodyStarted = deferred<void>();
    const showError = vi.fn();
    const slowErrorResponse = new Response(null, { status: 500 });
    vi.spyOn(slowErrorResponse, "json").mockImplementation(() => {
      bodyStarted.resolve();
      return oldBody.promise;
    });
    const load = createTemplateLoader({
      fetch: vi.fn<typeof fetch>()
        .mockResolvedValueOnce(slowErrorResponse)
        .mockResolvedValueOnce(response(bundle("new"))),
      importCode: async (code) => ({ default: { camera: code } }),
      showError,
    });
    const state: BundleState = { current: null };
    const gate = new PreviewRequestGate(vi.fn());
    const oldRequest = gate.begin(531, false);
    const first = load("/api/template", state, { signal: oldRequest.signal }).catch((error: unknown) => error);
    await bodyStarted.promise;
    const nextRequest = gate.begin(531, false);
    await load("/api/template", state, { signal: nextRequest.signal });
    oldBody.resolve({ error: { code: "COMPILE_ERROR", message: "stale error" } });

    expect(await first).toMatchObject({ name: "AbortError" });
    expect(state.current?.source?.revision).toBe("new");
    expect(showError).not.toHaveBeenCalled();
  });

  it("cancels pending Player preparation before fetching the next revision and retains playback intent", async () => {
    const oldPresentation = deferred<void>();
    const presentationStarted = deferred<void>();
    let playerGeneration = 0;
    let visible = "accepted-city";
    const cancelPendingLoad = vi.fn(() => { playerGeneration++; });
    const gate = new PreviewRequestGate(cancelPendingLoad);
    const accepted: string[] = [];
    const firstRequest = gate.begin(531, true);
    const first = loadPreviewCandidate(firstRequest, async () => "old-camera", async (template) => {
      const generation = playerGeneration;
      presentationStarted.resolve();
      await oldPresentation.promise;
      if (generation === playerGeneration) visible = template;
      return template;
    }).then(({ template }) => accepted.push(template)).catch((error: unknown) => error);
    await presentationStarted.promise;
    // A previous load may have reset its clock before the held frame is sought.
    const nextRequest = gate.begin(0, false);
    const next = await loadPreviewCandidate(nextRequest, async () => {
      expect(cancelPendingLoad).toHaveBeenCalledTimes(2);
      return "corrected-camera";
    }, async (template) => { visible = template; return template; });
    accepted.push(next.template);
    gate.finish(nextRequest);
    oldPresentation.resolve();

    expect(await first).toMatchObject({ name: "AbortError" });
    expect(visible).toBe("corrected-camera");
    expect(accepted).toEqual(["corrected-camera"]);
    expect(nextRequest).toMatchObject({ frame: 531, wasPlaying: true });
    expect(gate.begin(531, false).wasPlaying).toBe(false);
  });
});
