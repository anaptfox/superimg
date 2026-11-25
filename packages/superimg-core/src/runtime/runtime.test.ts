import { describe, expect, it, vi } from "vitest";
import {
  CapabilityUnavailableError,
  ExportBundleDisposedError,
  MediaPreflightError,
  RuntimeDisposedError,
  RuntimeInfrastructureError,
  SuperImgError,
  type ConversionRequest,
  type ResolveInput,
  collection,
  image,
  svg,
  video,
  type MediaRuntimeCapabilities,
} from "@superimg/types";
import { Html, Vector, Frame, Fill, Text } from "@superimg/stdlib/tree";
import {
  bindRuntimeApi,
  check,
  prepareRuntimeReport,
  createRuntime,
  exportMedia,
  inspect,
  inspectFile,
  render,
  startConversion,
  startExport,
  type RuntimeAdapter,
} from "./index.js";
import { readByteStream } from "./bytes.js";
import { sequence } from "../composition/sequence.js";
import { time } from "../composition/time.js";

const capabilities: MediaRuntimeCapabilities = Object.freeze({
  schemaVersion: 0,
  check: true,
  inspect: true,
  documents: Object.freeze(["html", "svg"] as const),
  rasters: Object.freeze(["png", "jpeg", "webp"] as const),
  animated: Object.freeze(["mp4", "webm", "gif"] as const),
  collections: Object.freeze({ static: true, providers: true }),
  assets: Object.freeze({ url: true, bytes: true }),
  fonts: Object.freeze({ logical: true, frozenBytes: true }),
});

function fakeAdapter(events: string[] = []): RuntimeAdapter {
  return {
    abi: "superimg-runtime-test-v0",
    capabilities,
    async inspect() {
      events.push("inspect");
      return { metadata: { adapter: "fake" } };
    },
    async resolveCollectionEntries({ collection: definition }) {
      events.push("provider");
      if (typeof definition.entries !== "function") return definition.entries;
      return await definition.entries();
    },
    async preflight(request) {
      events.push(`preflight:${request.operation}`);
      return {
        findings: [],
        assets: [],
        fonts: [],
        dispose: () => {
          events.push(`preflight-dispose:${request.operation}`);
        },
      };
    },
    async render(request) {
      events.push("render");
      return {
        as: request.options.as,
        mimeType: request.options.as === "html" ? "text/html" : "image/png",
        coordinates: request.selection.coordinates,
        bytes: new TextEncoder().encode("<main>Hello</main>"),
      };
    },
    async exportMedia(request) {
      events.push("export");
      const entryId = request.entries?.[0]?.entryId;
      const coordinates = {
        ...(entryId !== undefined ? { entryId } : {}),
        variantId: "default",
        editionId: "default",
      };
      return {
        coordinates: [coordinates],
        artifacts: [{
          path: entryId === undefined ? "youtube.png" : `${entryId}/youtube.png`,
          mimeType: "image/png",
          coordinates: { ...coordinates, renditionId: "youtube" },
          bytes: new Uint8Array([1, 2, 3, 4]),
        }],
      };
    },
    async dispose() {
      events.push("runtime-dispose");
    },
  };
}

const still = image<{ title: string }>({
  sample: { title: "Hello" },
  render: (ctx) => Html({
    width: "fill",
    height: "fill",
    html: `<h1>${ctx.data.title}</h1>`,
  }),
});

describe("value-first runtime kernel", () => {
  it("shares frame defects and honest coverage across check, inspect, render and export preflight", async () => {
    const media = image({ size: { width: 320, height: 180 }, render: () => Frame({ width: "fill", height: "fill" }, Fill({ color: "#111111" }), Text({ id: "caption", color: "#111111", size: 24 }, "Caption")) });
    const events: string[] = [];
    const runtime = createRuntime(fakeAdapter(events));
    try {
      const checked = await check(runtime, media);
      const inspected = await inspect(runtime, media);
      expect(checked.findings).toEqual(inspected.findings);
      expect(checked.coverage).toEqual(inspected.coverage);
      expect(checked.coverage).toMatchObject({ samples: [{ frame: 0 }], geometry: { browserMeasuredNodes: 0 }, visual: "unreviewed" });
      expect(checked.coverage?.checks.every(item => item.scope === "frame")).toBe(true);
      expect(checked.findings).toContainEqual(expect.objectContaining({ code: "LOW_CONTRAST_TEXT", details: expect.objectContaining({ nodeId: "caption", frame: 0 }) }));
      for (const operation of [() => render(runtime, media, { as: "html" }), () => exportMedia(runtime, media, { for: ["320x180.png"] })]) {
        try { await operation(); throw Error("expected technical preflight rejection"); }
        catch (error) { expect(error).toBeInstanceOf(MediaPreflightError); expect((error as MediaPreflightError).findings).toContainEqual(expect.objectContaining({ code: "LOW_CONTRAST_TEXT" })); }
      }
      expect(events).not.toContain("render");
      expect(events).not.toContain("export");
    } finally { await runtime.dispose(); }
  });

  it("reuses one native command resolution while preserving canonical reports and adapter validation", async () => {
    const resolve = vi.fn(({ data }: ResolveInput<{ title: string }>) => ({ data: { title: `${data.title}-resolved` }, duration: "2f" as const }));
    const media = video({ fps: 10, duration: "1s", size: { width: 100, height: 100 }, sample: { title: "sample" }, resolve,
      render: ctx => Html({ html: `${ctx.sceneId}:${ctx.data.title}:${ctx.timeline.frame}` }),
    });
    const events: string[] = [];
    const runtime = createRuntime(fakeAdapter(events));
    const options = { data: { title: "request" }, providers: "skip" as const, at: "1f" as const };
    try {
      const expected = await inspect(runtime, media, { ...options, includeIR: true });
      const expectedCheck = await check(runtime, media, options);
      resolve.mockClear();
      events.length = 0;
      const prepared = await prepareRuntimeReport(runtime, media, options);
      expect(resolve).toHaveBeenCalledTimes(1);
      const actualCheck = await check(runtime, media, options, prepared);
      const actual = await inspect(runtime, media, { ...options, includeIR: true }, prepared);
      expect(actualCheck).toEqual(expectedCheck);
      expect(actual).toEqual(expected);
      expect(resolve).toHaveBeenCalledTimes(1);
      expect(events).toEqual(["inspect", "inspect"]);
      await render(runtime, media, { ...options, as: "html" }, prepared);
      expect(resolve).toHaveBeenCalledTimes(1);
      expect(events).toContain("preflight:render");
      expect(events).toContain("preflight-dispose:render");
      await expect(inspect(runtime, media, { ...options, data: { title: "different" } }, prepared)).rejects.toThrow(/does not match/);
      await expect(render(runtime, media, { ...options, as: "html", variantId: "other" }, prepared)).rejects.toThrow(/does not match/);
      await expect(inspect(runtime, { ...media }, options, prepared)).rejects.toThrow(/does not match/);
      const otherRuntime = createRuntime(fakeAdapter());
      try { await expect(inspect(otherRuntime, media, options, prepared)).rejects.toThrow(/does not match/); }
      finally { await otherRuntime.dispose(); }
    } finally { await runtime.dispose(); }
  });

  it("inspects native media without assigning a program digest", async () => {
    const adapter = fakeAdapter();
    adapter.inspectFile = async () => ({
      schemaVersion: 0,
      kind: "@foxworth/superimg/media-inspection",
      mimeType: "video/mp4",
      byteLength: 4,
      sha256: "a".repeat(64),
      durationSeconds: 2,
      tracks: [{ id: "video-0", kind: "video", codec: "avc", width: 100, height: 100, fps: 30 }],
    });
    const report = await inspectFile(createRuntime(adapter), { kind: "bytes", bytes: new Uint8Array([1, 2, 3, 4]) });
    expect(report).toMatchObject({ kind: "@foxworth/superimg/media-inspection", tracks: [{ id: "video-0" }] });
    expect("programDigest" in report).toBe(false);
  });

  it("creates portable conversion artifacts through the runtime queue", async () => {
    const adapter = fakeAdapter();
    adapter.convertMedia = async ({ checkpoint }) => {
      await checkpoint(1, 2);
      await checkpoint(2, 2);
      return { mimeType: "video/mp4", durationSeconds: 2, bytes: new Uint8Array([9, 8]), tracks: [{ sourceId: "source", trackId: "video-0", action: "copy" }] };
    };
    const request: ConversionRequest = {
      sources: [{ id: "source", input: { kind: "bytes", bytes: new Uint8Array([1]) } }],
      video: { sourceId: "source", trackId: "video-0" },
      audio: [],
      format: "mp4",
    };
    const artifact = await startConversion(createRuntime(adapter), request).result;
    expect(artifact).toMatchObject({ kind: "@foxworth/superimg/conversion-artifact", durationSeconds: 2, byteLength: 2 });
    expect(await readByteStream(artifact.open())).toEqual(new Uint8Array([9, 8]));
  });

  it("keeps a transferred conversion backing alive after runtime disposal", async () => {
    const adapter = fakeAdapter();
    let disposed = 0;
    adapter.convertMedia = async () => ({
      mimeType: "video/mp4", durationSeconds: 1,
      tracks: [{ sourceId: "source", trackId: "video-0", action: "copy" }],
      backing: {
        byteLength: 2, sha256: "a".repeat(64),
        open: () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([9, 8])); controller.close(); } }),
        async dispose() { disposed++; },
      },
    });
    const runtime = createRuntime(adapter);
    const artifact = await startConversion(runtime, {
      sources: [{ id: "source", input: { kind: "bytes", bytes: new Uint8Array([1]) } }],
      video: { sourceId: "source", trackId: "video-0" }, audio: [], format: "mp4",
    }).result;
    await runtime.dispose();
    expect(disposed).toBe(0);
    expect(await readByteStream(artifact.open())).toEqual(new Uint8Array([9, 8]));
    await artifact.dispose();
    expect(disposed).toBe(1);
  });

  it("disposes a conversion backing when cancellation wins after adapter completion", async () => {
    const adapter = fakeAdapter();
    const signal = new AbortController();
    const dispose = vi.fn(async () => {});
    adapter.convertMedia = async () => {
      signal.abort();
      return { mimeType: "video/mp4", durationSeconds: 1, tracks: [], backing: {
        byteLength: 0, sha256: "a".repeat(64), open: () => new ReadableStream(), dispose,
      } };
    };
    const runtime = createRuntime(adapter);
    const job = startConversion(runtime, {
      sources: [{ id: "source", input: { kind: "bytes", bytes: new Uint8Array([1]) } }],
      video: { sourceId: "source", trackId: "video-0" }, audio: [], format: "mp4", signal: signal.signal,
    });
    await expect(job.result).rejects.toThrow(/cancelled/i);
    expect(dispose).toHaveBeenCalledOnce();
    await runtime.dispose();
  });

  it("disposes a conversion backing rejected during artifact adoption", async () => {
    const adapter = fakeAdapter();
    const dispose = vi.fn(async () => {});
    adapter.convertMedia = async () => ({ mimeType: "video/mp4", durationSeconds: 0, tracks: [], backing: {
      byteLength: 0, sha256: "a".repeat(64), open: () => new ReadableStream(), dispose,
    } });
    const runtime = createRuntime(adapter);
    const job = startConversion(runtime, {
      sources: [{ id: "source", input: { kind: "bytes", bytes: new Uint8Array([1]) } }],
      video: { sourceId: "source", trackId: "video-0" }, audio: [], format: "mp4",
    });
    await expect(job.result).rejects.toThrow(/positive finite duration/);
    expect(dispose).toHaveBeenCalledOnce();
    await runtime.dispose();
  });

  it.each(["cancel", "adoption"] as const)("preserves %s and backing cleanup failures", async (failure) => {
    const adapter = fakeAdapter();
    const signal = new AbortController();
    const cleanupError = new Error("backing cleanup failed");
    const dispose = vi.fn(async () => { throw cleanupError; });
    adapter.convertMedia = async () => {
      if (failure === "cancel") signal.abort();
      return { mimeType: "video/mp4", durationSeconds: failure === "adoption" ? 0 : 1, tracks: [], backing: {
        byteLength: 0, sha256: "a".repeat(64), open: () => new ReadableStream(), dispose,
      } };
    };
    const runtime = createRuntime(adapter);
    const job = startConversion(runtime, {
      sources: [{ id: "source", input: { kind: "bytes", bytes: new Uint8Array([1]) } }],
      video: { sourceId: "source", trackId: "video-0" }, audio: [], format: "mp4", signal: signal.signal,
    });
    const error = await job.result.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors[0]).toBeInstanceOf(Error);
    expect(String((error as AggregateError).errors[0])).toMatch(failure === "cancel" ? /cancelled/i : /positive finite duration/);
    expect((error as AggregateError).errors[1]).toBe(cleanupError);
    expect(dispose).toHaveBeenCalledOnce();
    await runtime.dispose();
  });

  it("pauses export at progress checkpoints and can cancel paused work", async () => {
    const runtime = createRuntime(fakeAdapter());
    const job = startExport(runtime, still, { for: ["1200x630.png"] });
    await job.pause();
    await job.cancel("test");
    await expect(job.result).rejects.toBeInstanceOf(Error);
    expect(job.state).toBe("cancelled");
  });

  it("validates bounded concurrency during initialization", () => {
    expect(() => createRuntime(fakeAdapter(), { concurrency: 0 })).toThrow(
      /positive safe integer/,
    );
    expect(() => createRuntime(fakeAdapter(), { concurrency: 1.5 })).toThrow(
      /positive safe integer/,
    );
    const controller = new AbortController();
    controller.abort();
    expect(() => createRuntime(fakeAdapter(), { signal: controller.signal })).toThrow(
      /cancelled/,
    );
  });

  it("checks and inspects values without source paths", async () => {
    const runtime = createRuntime(fakeAdapter());
    const checked = await check(runtime, still);
    const inspected = await inspect(runtime, still);

    expect(checked.ok).toBe(true);
    expect(checked.programDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(checked).not.toHaveProperty("sourceId");
    expect(inspected.metadata).toMatchObject({ adapter: "fake" });
    expect(inspected.config).toMatchObject({ width: 1920, height: 1080, animated: false });
  });

  it("resolves selected data/config once for check, IR inspect, and exact render", async () => {
    const resolve = vi.fn(async ({ data, config }: ResolveInput<{ title: string; count: number }>) => ({
      duration: data.count * 2,
      fps: 10,
      markers: [{ id: "ready", at: 1 }],
      data: { title: `${data.title}:${config.width}` },
    }));
    const media = video({
      duration: "1s",
      size: { width: 320, height: 180 },
      sample: { title: "sample", count: 2 },
      variants: { long: { title: "variant", count: 4 } },
      editions: { square: { size: { width: 80, height: 80 } } },
      resolve,
      render: (ctx) => Html({ html: `${ctx.data.title}:frame${ctx.timeline.frame}` }),
    });
    const adapter = fakeAdapter();
    const capture = vi.fn(adapter.render);
    adapter.render = capture;
    const runtime = createRuntime(adapter);
    const selection = { data: { title: "request" }, variantId: "long", editionId: "square" };

    const checked = await check(runtime, media, selection);
    expect(checked.ok).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(1);
    resolve.mockClear();

    const inspected = await inspect(runtime, media, { ...selection, at: "20f", includeIR: true });
    expect(inspected.config).toMatchObject({ durationSeconds: 8, fps: 10, width: 80, height: 80 });
    expect(inspected.metadata).toMatchObject({ samples: [{ html: expect.stringContaining("variant:80:frame20") }] });
    expect(inspected.metadata).toMatchObject({ semanticIR: [{ scenes: [{ markers: [{ id: "ready", frame: 10 }] }] }] });
    expect(resolve).toHaveBeenCalledTimes(1);
    resolve.mockClear();

    await render(runtime, media, { ...selection, as: "html", at: "20f" });
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]![0].selection).toMatchObject({
      media: { config: { duration: 8, fps: 10, width: 80, height: 80 } },
      data: { title: "variant:80", count: 4 },
    });
    expect(capture.mock.calls[0]![0].selection.media.resolve).toBeUndefined();
    expect(media.config?.duration).toBe("1s");
    expect(media.sample?.title).toBe("sample");
    await runtime.dispose();
  });

  it("inspects the exact retained clock and clamps to its last frame", async () => {
    const media = time(sequence([{ id: "clip", content: video({
      size: { width: 320, height: 180 }, fps: 25, duration: "7f",
      render: (ctx) => Html({ html: "frame" + ctx.timeline.frame }),
    }) }]), { size: { width: 320, height: 180 }, fps: 25 });
    const runtime = createRuntime(fakeAdapter());
    try {
      const report = await inspect(runtime, media, { at: "999f", includeIR: true });
      expect(report.config).toMatchObject({ fps: 25, totalFrames: 7, durationSeconds: 0.28 });
      expect(report.metadata).toMatchObject({ samples: [{ html: expect.stringContaining("frame6") }] });
    } finally { await runtime.dispose(); }
  });

  it("defers both provider and content resolution until entries are selected", async () => {
    const resolve = vi.fn(({ data }: ResolveInput<{ id: string; count: number; label?: string }>) => ({ duration: data.count, data: { label: data.id } }));
    const provider = vi.fn(() => [{ id: "one", count: 3 }, { id: "two", count: 5 }]);
    const media = collection({
      entries: provider,
      media: video<{ id: string; count: number; label?: string }>({
        duration: "1s",
        sample: { id: "sample", count: 1, label: "sample-only" },
        resolve,
        render: (ctx) => Html({ html: ctx.data.label ?? "missing" }),
      }),
    });
    const runtime = createRuntime(fakeAdapter());
    await inspect(runtime, media);
    expect(provider).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
    const inspected = await inspect(runtime, media, { providers: "resolve", entryId: "two", includeIR: true });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve.mock.calls[0]![0].data).toEqual({ id: "two", count: 5 });
    expect(inspected.config).toMatchObject({ durationSeconds: 5 });
    await runtime.dispose();
  });

  it("does not execute collection providers by default and resolves once on opt-in", async () => {
    let providerCalls = 0;
    const media = collection({
      entries: () => {
        providerCalls += 1;
        return [{ id: "one", title: "One" }];
      },
      media: image<{ id: string; title: string }>({
        render: (ctx) => Html({ html: ctx.data.title }),
      }),
    });
    const events: string[] = [];
    const runtime = createRuntime(fakeAdapter(events));

    const deferred = await check(runtime, media);
    expect(providerCalls).toBe(0);
    expect(deferred.findings.some((finding) => finding.code === "COLLECTION_PROVIDER_DEFERRED"))
      .toBe(true);

    const resolved = await inspect(runtime, media, { providers: "resolve" });
    expect(providerCalls).toBe(1);
    expect(resolved.collection).toMatchObject({ resolved: true, entryCount: 1 });
    expect(events.filter((event) => event === "provider")).toHaveLength(1);
  });

  it("checks every selected static and resolved collection entry", async () => {
    const seen: string[] = [];
    const definition = image<{ id: string; title: string }>({
      render: (ctx) => {
        seen.push(ctx.data.id);
        if (ctx.data.id === "broken") throw new Error("broken entry render");
        return Html({ html: ctx.data.title });
      },
    });
    const staticMedia = collection({
      entries: [
        { id: "good", title: "Good" },
        { id: "broken", title: "Broken" },
      ],
      media: definition,
    });
    const runtime = createRuntime(fakeAdapter());

    const checked = await check(runtime, staticMedia);
    expect(checked.coordinates.map((item) => item.entryId)).toEqual(["good", "broken"]);
    expect(seen).toEqual(["good", "broken"]);
    expect(checked.findings).toContainEqual(expect.objectContaining({
      code: "RENDER_EXCEPTION",
      coordinates: expect.objectContaining({ entryId: "broken" }),
    }));

    seen.length = 0;
    const providerMedia = collection({
      entries: () => [
        { id: "provider-good", title: "Good" },
        { id: "broken", title: "Broken" },
      ],
      media: definition,
    });
    const inspected = await inspect(runtime, providerMedia, { providers: "resolve" });
    expect(inspected.coordinates.map((item) => item.entryId)).toEqual([
      "provider-good",
      "broken",
    ]);
    expect(seen).toEqual(["provider-good", "broken"]);
    expect(inspected.findings).toContainEqual(expect.objectContaining({
      code: "RENDER_EXCEPTION",
      coordinates: expect.objectContaining({ entryId: "broken" }),
    }));
  });

  it("applies selected data, variants, and editions before config and semantic inspection", async () => {
    const media = image<{ title: string }>({
      sample: { title: "sample" },
      variants: { dark: { title: "variant" } },
      editions: {
        square: {
          size: { width: 1080, height: 1080 },
          render: (ctx) => Html({ html: `<strong>${ctx.data.title}</strong>` }),
        },
      },
      render: (ctx) => Html({ html: ctx.data.title }),
    });
    const runtime = createRuntime(fakeAdapter());
    const report = await inspect(runtime, media, {
      data: { title: "request" },
      variantId: "dark",
      editionId: "square",
    });

    expect(report.config).toMatchObject({ width: 1080, height: 1080 });
    expect(report.coordinates).toEqual([{
      variantId: "dark",
      editionId: "square",
    }]);
    expect(report.metadata).toMatchObject({
      samples: [{
        coordinates: { variantId: "dark", editionId: "square" },
        html: expect.stringContaining("variant"),
      }],
    });
  });

  it("runs the public craft and semantic IR inspection options", async () => {
    const animated = video({
      duration: "3s",
      render: (ctx) => {
        ctx.director().motion({ x: 12, easing: "linear" });
        return Html({ html: "motion" });
      },
    });
    const runtime = createRuntime(fakeAdapter());

    const ordinary = await check(runtime, animated);
    expect(ordinary.findings.some((item) => item.code === "CRAFT_LINEAR_POSITIONAL"))
      .toBe(false);
    const crafted = await check(runtime, animated, { craft: true });
    expect(crafted.findings.some((item) => item.code === "CRAFT_LINEAR_POSITIONAL"))
      .toBe(true);

    const inspected = await inspect(runtime, still, { includeIR: true });
    expect(inspected.metadata).toMatchObject({
      semanticIR: [{
        kind: "@foxworth/superimg/runtime-semantic-ir",
        schemaVersion: 0,
        programDigest: inspected.programDigest,
      }],
    });
    expect(JSON.stringify(inspected.metadata)).not.toContain("sourceId");
  });

  it("runs complete preflight before exact render and requires animated time", async () => {
    const events: string[] = [];
    const runtime = createRuntime(fakeAdapter(events));
    const animated = video({
      duration: "2s",
      render: () => Html({ html: "motion" }),
    });

    await expect(render(runtime, animated, { as: "png" })).rejects.toBeInstanceOf(
      MediaPreflightError,
    );
    expect(events).toEqual(["preflight:render", "preflight-dispose:render"]);

    events.length = 0;
    const result = await render(runtime, animated, { as: "png", at: "1s" });
    expect(events).toEqual(["preflight:render", "render", "preflight-dispose:render"]);
    expect(result.byteLength).toBeGreaterThan(0);
    expect(await readByteStream(result.stream())).toEqual(await readByteStream(result.stream()));
  });

  it("reports authored render failures as media preflight findings", async () => {
    const events: string[] = [];
    const runtime = createRuntime(fakeAdapter(events));
    const broken = image({
      render: () => {
        throw new Error("authored boom");
      },
    });

    for (const operation of [
      () => render(runtime, broken, { as: "html" }),
      () => exportMedia(runtime, broken, { for: ["1200x630.png"] }),
    ]) {
      try {
        await operation();
        throw new Error("expected operation to reject");
      } catch (error) {
        expect(error).toBeInstanceOf(MediaPreflightError);
        expect((error as MediaPreflightError).findings).toContainEqual(
          expect.objectContaining({ code: "RENDER_EXCEPTION", message: "authored boom" }),
        );
      }
    }
    expect(events).not.toContain("render");
    expect(events).not.toContain("export");
  });

  it("prepares optional stdlib packs before authored preflight sampling", async () => {
    const events: string[] = [];
    const runtime = createRuntime(fakeAdapter(events));
    const colored = image({
      render: (ctx) => Html({ html: ctx.std.color.alpha("#ff6600", 0.5) }),
    });

    const report = await check(runtime, colored);
    expect(report.findings.filter((finding) => finding.code === "RENDER_EXCEPTION")).toEqual([]);

    await render(runtime, colored, { as: "html" });
    expect(events).toContain("render");
  });

  it("lets adapter SuperImgError codes through and keeps the cause of other failures", async () => {
    const coded = new SuperImgError(
      "Chromium missing",
      "CHROMIUM_MISSING",
      { installCommand: "superimg setup" },
      "Install the Chromium runtime with `superimg setup` or call setup().",
    );
    const codedAdapter = fakeAdapter();
    codedAdapter.render = async () => {
      throw coded;
    };
    const codedRuntime = createRuntime(codedAdapter);
    await expect(render(codedRuntime, still, { as: "html" })).rejects.toBe(coded);
    await codedRuntime.dispose();

    const cause = new Error("disk full");
    const wrappedAdapter = fakeAdapter();
    wrappedAdapter.render = async () => {
      throw cause;
    };
    const wrappedRuntime = createRuntime(wrappedAdapter);
    try {
      await render(wrappedRuntime, still, { as: "html" });
      throw new Error("expected render to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeInfrastructureError);
      expect(error).toMatchObject({
        code: "RUNTIME_INFRASTRUCTURE_ERROR",
        cause,
      });
    } finally {
      await wrappedRuntime.dispose();
    }
  });

  it("rejects square destinations that have no matching edition", async () => {
    const runtime = createRuntime(fakeAdapter());
    const landscape = image({
      render: () => Html({ html: "wide" }),
    });
    await expect(exportMedia(runtime, landscape, {
      for: ["instagram-square"],
    })).rejects.toMatchObject({
      code: "MEDIA_PREFLIGHT_FAILED",
      findings: [expect.objectContaining({ code: "MISSING_EDITION" })],
    });
  });

  it("preflights authored rendering at exact destination canvas and still-frame time", async () => {
    const events: string[] = [];
    const runtime = createRuntime(fakeAdapter(events));
    const responsive = image({
      render: (ctx) => {
        if (ctx.width === 640 && ctx.height === 360) throw new Error("destination canvas boom");
        return Html({ html: "responsive" });
      },
    });
    await expect(exportMedia(runtime, responsive, {
      for: [{ id: "small", format: "png", width: 640, height: 360 }],
    })).rejects.toMatchObject({
      code: "MEDIA_PREFLIGHT_FAILED",
      findings: [expect.objectContaining({
        code: "RENDER_EXCEPTION",
        message: "destination canvas boom",
        details: expect.objectContaining({ renditionId: "small", width: 640, height: 360 }),
      })],
    });

    const timed = video({
      duration: "2s",
      render: (ctx) => {
        if (ctx.timeline.seconds >= 0.9) throw new Error("poster time boom");
        return Html({ html: "timed" });
      },
    });
    await expect(exportMedia(runtime, timed, {
      for: [{ id: "poster", format: "png", width: 1200, height: 630 }],
      at: "1s",
    })).rejects.toMatchObject({
      code: "MEDIA_PREFLIGHT_FAILED",
      findings: [expect.objectContaining({
        code: "RENDER_EXCEPTION",
        message: "poster time boom",
        details: expect.objectContaining({ renditionId: "poster" }),
      })],
    });
    expect(events).not.toContain("export");
  });

  it("uses an authored poster only as fallback for animated still exports", async () => {
    const events: string[] = [];
    const runtime = createRuntime(fakeAdapter(events));
    const authored = video({
      duration: "2s",
      poster: "1s",
      render: (ctx) => {
        if (ctx.timeline.seconds >= 0.9) throw new Error("authored poster boom");
        return Html({ html: "animated" });
      },
    });

    const videoBundle = await exportMedia(runtime, authored, { for: ["youtube"] });
    expect(events).toContain("export");
    await videoBundle.dispose();

    events.length = 0;
    await expect(exportMedia(runtime, authored, {
      for: [{ id: "poster", format: "png", width: 1200, height: 630 }],
    })).rejects.toMatchObject({
      code: "MEDIA_PREFLIGHT_FAILED",
      findings: [expect.objectContaining({
        code: "RENDER_EXCEPTION",
        message: "authored poster boom",
        details: expect.objectContaining({ renditionId: "poster" }),
      })],
    });
    expect(events).toEqual(["preflight:export", "preflight-dispose:export"]);
  });

  it("passes request data to both semantic export and adapter execution", async () => {
    const adapter = fakeAdapter();
    let adapterTitle: unknown;
    adapter.preflight = async (request) => {
      if (request.operation === "export" && request.media.kind === "media") {
        adapterTitle = (request.media.sample as { title?: unknown } | undefined)?.title;
      }
      return { findings: [], assets: [], fonts: [] };
    };
    const runtime = createRuntime(adapter);
    const media = image<{ title: string }>({
      sample: { title: "sample" },
      render: (ctx) => {
        if (ctx.data.title !== "request") throw new Error(`wrong data: ${ctx.data.title}`);
        return Html({ html: ctx.data.title });
      },
    });
    const bundle = await exportMedia(runtime, media, {
      for: ["1200x630.png"],
      data: { title: "request" },
    });
    expect(adapterTitle).toBe("request");
    await bundle.dispose();
  });

  it("overlays request data onto every collection entry before variant data", async () => {
    const adapter = fakeAdapter();
    adapter.exportMedia = async () => {
      const coordinates = {
        entryId: "one",
        variantId: "dark",
        editionId: "default",
      } as const;
      return {
        coordinates: [coordinates],
        artifacts: [{
          path: "one/dark.png",
          mimeType: "image/png",
          coordinates: { ...coordinates, renditionId: "card" },
          bytes: new Uint8Array([1, 2, 3, 4]),
        }],
      };
    };
    const runtime = createRuntime(adapter);
    const media = collection({
      entries: [{ id: "one", title: "entry", tone: "entry" }],
      media: image<{ id: string; title: string; tone: string }>({
        variants: { dark: { title: "variant" } },
        render: (ctx) => {
          if (ctx.data.title !== "variant" || ctx.data.tone !== "request") {
            throw new Error(`wrong collection data: ${ctx.data.title}/${ctx.data.tone}`);
          }
          return Html({ html: `${ctx.data.title}/${ctx.data.tone}` });
        },
      }),
    });

    const bundle = await exportMedia(runtime, media, {
      for: [{ id: "card", format: "png", width: 1200, height: 630 }],
      data: { title: "request", tone: "request" },
      variantIds: ["dark"],
    });
    expect(bundle.manifest.coordinates).toEqual([{
      entryId: "one",
      variantId: "dark",
      editionId: "default",
    }]);
    await bundle.dispose();
  });

  it("rejects explicitly empty export selectors as authored preflight", async () => {
    const cases = [
      [{ entryIds: [] }, "EXPORT_ENTRY_SELECTOR_EMPTY"],
      [{ variantIds: [] }, "EXPORT_VARIANT_SELECTOR_EMPTY"],
      [{ editionIds: [] }, "EXPORT_EDITION_SELECTOR_EMPTY"],
    ] as const;
    for (const [selector, code] of cases) {
      const events: string[] = [];
      const runtime = createRuntime(fakeAdapter(events));
      await expect(exportMedia(runtime, still, { for: ["youtube"], ...selector }))
        .rejects.toMatchObject({
          code: "MEDIA_PREFLIGHT_FAILED",
          findings: [expect.objectContaining({ code })],
        });
      expect(events).toEqual([]);
    }
  });

  it("returns an owned bundle that outlives runtime disposal", async () => {
    const events: string[] = [];
    const runtime = createRuntime(fakeAdapter(events));
    const bundle = await exportMedia(runtime, still, { for: ["1200x630.png"] });
    await runtime.dispose();

    expect(events).toEqual([
      "preflight:export",
      "export",
      "preflight-dispose:export",
      "runtime-dispose",
    ]);
    expect(await readByteStream(bundle.artifacts[0]!.stream())).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(bundle.manifest.artifacts[0]).toMatchObject({
      path: "youtube.png",
      byteLength: 4,
      sha256: bundle.artifacts[0]!.sha256,
    });

    await bundle.dispose();
    await bundle.dispose();
    expect(() => bundle.artifacts[0]!.stream()).toThrow(ExportBundleDisposedError);
    await expect(check(runtime, still)).rejects.toBeInstanceOf(RuntimeDisposedError);
  });

  it("supports interactive reports but rejects deterministic artifacts", async () => {
    const runtime = createRuntime(fakeAdapter());
    const interactive = {
      kind: "interactive" as const,
      guide: { steps: [] },
      sample: { title: "Lesson" },
      render: () => Html({ html: "lesson" }),
    };
    const report = await check(runtime, interactive);
    expect(report.ok).toBe(true);
    expect(report.kind).toBe("interactive");
    expect(report.findings.some((finding) => finding.code === "INTERACTIVE_HOST_DRIVEN"))
      .toBe(true);

    await expect(render(runtime, interactive as never, { as: "html" })).rejects.toMatchObject({
      code: "MEDIA_PREFLIGHT_FAILED",
    });
  });

  it("exposes no partial bundle when artifact validation fails", async () => {
    const adapter = fakeAdapter();
    adapter.exportMedia = async () => ({
      coordinates: [{ variantId: "default", editionId: "default" }],
      artifacts: [{
        path: "../escape.png",
        mimeType: "image/png",
        coordinates: {
          variantId: "default",
          editionId: "default",
          renditionId: "bad",
        },
        bytes: new Uint8Array([1]),
      }],
    });
    const runtime = createRuntime(adapter);
    await expect(exportMedia(runtime, still, { for: ["1200x630.png"] })).rejects.toMatchObject({
      code: "RUNTIME_INFRASTRUCTURE_ERROR",
      message: expect.stringMatching(/normalized relative path|parent segments/),
    });
  });

  it("validates exact manifest coordinate and rendition coverage", async () => {
    const coordinate = { variantId: "default", editionId: "default" } as const;
    const adapter = fakeAdapter();
    adapter.exportMedia = async () => ({
      coordinates: [coordinate],
      artifacts: [
        {
          path: "youtube.png",
          mimeType: "image/png",
          coordinates: { ...coordinate, renditionId: "youtube" },
          bytes: new Uint8Array([1]),
        },
        {
          path: "square.png",
          mimeType: "image/png",
          coordinates: { ...coordinate, renditionId: "square" },
          bytes: new Uint8Array([2]),
        },
      ],
    });
    const runtime = createRuntime(adapter);
    const bundle = await exportMedia(runtime, still, { for: ["1200x630.png"] });
    expect(bundle.manifest.coordinates).toEqual([coordinate]);
    expect(bundle.manifest.artifacts.map((item) => item.coordinates.renditionId))
      .toEqual(["youtube", "square"]);

    adapter.exportMedia = async () => ({
      coordinates: [coordinate],
      artifacts: [
        {
          path: "first.png",
          mimeType: "image/png",
          coordinates: { ...coordinate, renditionId: "duplicate" },
          bytes: new Uint8Array([1]),
        },
        {
          path: "second.png",
          mimeType: "image/png",
          coordinates: { ...coordinate, renditionId: "duplicate" },
          bytes: new Uint8Array([2]),
        },
      ],
    });
    const duplicateRuntime = createRuntime(adapter);
    await expect(exportMedia(duplicateRuntime, still, { for: ["1200x630.png"] }))
      .rejects.toMatchObject({
        code: "RUNTIME_INFRASTRUCTURE_ERROR",
        message: expect.stringContaining("rendition coordinates are duplicated"),
      });
  });

  it("rejects missing, unplanned, duplicate, and portably colliding bundle coverage", async () => {
    const first = { variantId: "default", editionId: "default" } as const;
    const second = { variantId: "dark", editionId: "default" } as const;
    const cases = [
      {
        coordinates: [first, second],
        artifacts: [{
          path: "only.png",
          mimeType: "image/png",
          coordinates: { ...first, renditionId: "only" },
          bytes: new Uint8Array([1]),
        }],
        message: "no artifact coverage",
      },
      {
        coordinates: [first],
        artifacts: [{
          path: "unplanned.png",
          mimeType: "image/png",
          coordinates: { ...second, renditionId: "other" },
          bytes: new Uint8Array([1]),
        }],
        message: "unplanned coordinates",
      },
      {
        coordinates: [first, first],
        artifacts: [{
          path: "duplicate-coordinate.png",
          mimeType: "image/png",
          coordinates: { ...first, renditionId: "one" },
          bytes: new Uint8Array([1]),
        }],
        message: "coordinates are duplicated",
      },
      {
        coordinates: [first],
        artifacts: [
          {
            path: "Card.png",
            mimeType: "image/png",
            coordinates: { ...first, renditionId: "one" },
            bytes: new Uint8Array([1]),
          },
          {
            path: "card.png",
            mimeType: "image/png",
            coordinates: { ...first, renditionId: "two" },
            bytes: new Uint8Array([2]),
          },
        ],
        message: "collide portably",
      },
    ];

    for (const testCase of cases) {
      const adapter = fakeAdapter();
      adapter.exportMedia = async () => testCase;
      const runtime = createRuntime(adapter);
      await expect(exportMedia(runtime, still, { for: ["1200x630.png"] }))
        .rejects.toMatchObject({
          code: "RUNTIME_INFRASTRUCTURE_ERROR",
          message: expect.stringContaining(testCase.message),
        });
    }
  });

  it("rejects an adapter result that omits a semantically planned coordinate", async () => {
    const media = collection({
      entries: [
        { id: "one", title: "One" },
        { id: "two", title: "Two" },
      ],
      media: image<{ id: string; title: string }>({
        render: (ctx) => Html({ html: ctx.data.title }),
      }),
    });
    const runtime = createRuntime(fakeAdapter());
    await expect(exportMedia(runtime, media, { for: ["1200x630.png"] }))
      .rejects.toMatchObject({
        code: "RUNTIME_INFRASTRUCTURE_ERROR",
        message: expect.stringContaining("missing planned coordinates"),
      });
  });

  it("admits operations FIFO up to the configured concurrency", async () => {
    const adapter = fakeAdapter();
    let active = 0;
    let maximum = 0;
    let started = 0;
    const releases: Array<() => void> = [];
    adapter.inspect = async () => {
      started += 1;
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      return {};
    };
    const runtime = createRuntime(adapter, { concurrency: 2 });

    const first = check(runtime, still);
    const second = check(runtime, still);
    const third = check(runtime, still);
    await waitFor(() => started === 2);
    expect(maximum).toBe(2);

    releases.shift()!();
    await waitFor(() => started === 3);
    expect(maximum).toBe(2);
    for (const release of releases.splice(0)) release();
    await Promise.all([first, second, third]);
  });

  it("removes a cancelled operation from the admission queue", async () => {
    const adapter = fakeAdapter();
    let started = 0;
    let releaseFirst!: () => void;
    adapter.inspect = async () => {
      started += 1;
      if (started === 1) await new Promise<void>((resolve) => { releaseFirst = resolve; });
      return {};
    };
    const runtime = createRuntime(adapter, { concurrency: 1 });
    const first = check(runtime, still);
    await waitFor(() => started === 1);

    const controller = new AbortController();
    const queued = check(runtime, still, { signal: controller.signal });
    controller.abort();
    await expect(queued).rejects.toMatchObject({ code: "RUNTIME_CANCELLED" });
    expect(started).toBe(1);

    releaseFirst();
    await first;
    expect(started).toBe(1);
  });

  it("closes queued admission before waiting for active work during disposal", async () => {
    const events: string[] = [];
    const adapter = fakeAdapter(events);
    let started = 0;
    let releaseFirst!: () => void;
    adapter.inspect = async () => {
      started += 1;
      if (started === 1) await new Promise<void>((resolve) => { releaseFirst = resolve; });
      return {};
    };
    const runtime = createRuntime(adapter, { concurrency: 1 });
    const first = check(runtime, still);
    await waitFor(() => started === 1);
    const queued = check(runtime, still);

    const disposing = runtime.dispose();
    await expect(queued).rejects.toBeInstanceOf(RuntimeDisposedError);
    await expect(check(runtime, still)).rejects.toBeInstanceOf(RuntimeDisposedError);
    expect(events).not.toContain("runtime-dispose");
    expect(started).toBe(1);

    releaseFirst();
    await first;
    await disposing;
    expect(events).toContain("runtime-dispose");
    expect(started).toBe(1);
  });
});

describe("media-first runtime API", () => {
  it("reuses one default runtime and still accepts an explicit runtime", async () => {
    const init = vi.fn(async () => createRuntime(fakeAdapter()));
    const api = bindRuntimeApi(init);
    const html = await api.render(still, { as: "html" });
    await api.check(still);
    expect(init).toHaveBeenCalledTimes(1);
    await expect(html.text()).resolves.toContain("Hello");
    expect(await html.bytes()).toEqual(new TextEncoder().encode("<main>Hello</main>"));
    expect((await html.blob()).type).toBe("text/html");
    expect(await readByteStream(html.stream())).toEqual(await html.bytes());

    const runtime = createRuntime(fakeAdapter());
    const png = await api.render(still, { runtime, as: "png" });
    expect(init).toHaveBeenCalledTimes(1);
    await expect(png.text()).rejects.toMatchObject({ code: "NOT_TEXT" });
    await expect(png.text()).rejects.toBeInstanceOf(SuperImgError);

    const bundle = await api.exportMedia(still, { runtime, for: ["1200x630.png"] });
    const artifact = bundle.artifacts[0]!;
    expect(await artifact.bytes()).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect((await artifact.blob()).type).toBe(artifact.mimeType);
    await expect(artifact.text()).rejects.toMatchObject({ code: "NOT_TEXT" });
    expect(await readByteStream(artifact.stream())).toEqual(await artifact.bytes());
    await bundle.dispose();
    expect(() => artifact.stream()).toThrow(ExportBundleDisposedError);
    await api.shutdown();
    await runtime.dispose();
  });

  it("disposes the default runtime after 2000ms idle and creates a new one later", async () => {
    vi.useFakeTimers();
    try {
      const events: string[] = [];
      const init = vi.fn(async () => createRuntime(fakeAdapter(events)));
      const api = bindRuntimeApi(init, { idleDisposeMs: 2000 });
      await api.render(still, { as: "html" });
      await vi.advanceTimersByTimeAsync(1500);
      await api.check(still);
      expect(init).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1999);
      expect(events).not.toContain("runtime-dispose");
      await vi.advanceTimersByTimeAsync(1);
      expect(events).toContain("runtime-dispose");
      await api.inspect(still);
      expect(init).toHaveBeenCalledTimes(2);
      await api.shutdown();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a default runtime without idle disposal until shutdown", async () => {
    vi.useFakeTimers();
    try {
      const events: string[] = [];
      const init = vi.fn(async () => createRuntime(fakeAdapter(events)));
      const api = bindRuntimeApi(init);
      await api.render(still, { as: "html" });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(events).not.toContain("runtime-dispose");
      await api.shutdown();
      expect(events).toContain("runtime-dispose");
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns animated render bytes from the single export artifact", async () => {
    const payload = new Uint8Array([9, 8, 7, 6]);
    const events: string[] = [];
    const adapter = fakeAdapter(events);
    adapter.exportMedia = async () => {
      events.push("export");
      return {
        coordinates: [{ variantId: "default", editionId: "default" }],
        artifacts: [{
          path: "clip.mp4",
          mimeType: "video/mp4",
          coordinates: { variantId: "default", editionId: "default", renditionId: "mp4" },
          bytes: payload,
        }],
      };
    };
    const runtime = createRuntime(adapter);
    const clip = video({
      duration: "1s",
      size: { width: 64, height: 64 },
      render: () => Html({ html: "clip" }),
    });
    const api = bindRuntimeApi(async () => {
      throw new Error("explicit runtime");
    });
    const result = await api.render(clip, { runtime, as: "mp4" });
    expect(events).toContain("export");
    expect(events).not.toContain("render");
    expect(result.as).toBe("mp4");
    expect(result.mimeType).toBe("video/mp4");
    expect(await result.bytes()).toEqual(payload);
    await expect(api.render(clip, { runtime, as: "mov" })).rejects.toBeInstanceOf(CapabilityUnavailableError);
    await runtime.dispose();
  });

  it("injects capture dpr 1 for html media unless the caller set it", async () => {
    const seen: Array<{ encoding?: { capture?: { dpr?: number; scale?: string } } }> = [];
    const adapter = fakeAdapter();
    adapter.render = async (request) => {
      seen.push(request.options);
      return {
        as: request.options.as,
        mimeType: request.options.as === "svg" ? "image/svg+xml" : "image/png",
        coordinates: request.selection.coordinates,
        bytes: new Uint8Array([1]),
      };
    };
    const runtime = createRuntime(adapter);
    const api = bindRuntimeApi(async () => runtime);
    try {
      const card = image({
        size: { width: 320, height: 180 },
        render: () => Html({ width: "fill", height: "fill", html: "x" }),
      });
      await api.render(card, { as: "png" });
      expect(seen[0]?.encoding?.capture?.dpr).toBe(1);

      await api.render(card, { as: "png", encoding: { capture: { dpr: 2, scale: "device" } } });
      expect(seen[1]?.encoding?.capture).toEqual({ dpr: 2, scale: "device" });

      const graphic = svg({
        size: { width: 320, height: 180 },
        render: () => Vector({ width: "fill", height: "fill" }, Html({ width: 320, height: 180, html: "x" })),
      });
      await api.render(graphic, { as: "svg" });
      expect(seen[2]?.encoding).toBeUndefined();
    } finally {
      await api.shutdown();
    }
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error("Timed out waiting for runtime test condition");
}
