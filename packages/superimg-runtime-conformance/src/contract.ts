import { describe, expect, it } from "vitest";
import {
  Html,
  Vector,
  collection,
  image,
  svg,
  video,
  vector,
  type ImageRenderContext,
  googleFont,
} from "@foxworth/superimg";
import {
  CapabilityUnavailableError,
  ExportBundleDisposedError,
  MediaPreflightError,
  RuntimeCancelledError,
  RuntimeDisposedError,
  check,
  exportMedia,
  init,
  inspect,
  render,
  type InitOptions,
  type Runtime,
} from "@foxworth/superimg/runtime";

export interface RuntimeConformanceProfile {
  readonly name: "node" | "browser" | "edge";
  readonly providerCollections: boolean;
  /** Host hook so edge and browser can pass `defaultFonts`. */
  readonly init?: (options?: InitOptions) => Promise<Runtime>;
}

// Includes the bundled Inter 400/500/700 face hashes (fonts are part of the program digest).
const EXPECTED_STILL_PROGRAM_DIGEST = "a6fd8deccc02ff1669e870382088d8965f173a7eb0f83755d4d1fa3f5b2f6327";

export function registerRuntimeConformance(profile: RuntimeConformanceProfile): void {
  const startRuntime = (options?: InitOptions): Promise<Runtime> =>
    profile.init ? profile.init(options) : init(options);
  describe(`@foxworth/superimg/runtime ${profile.name} conformance`, () => {
    it("checks and inspects authored values without host source identity", async () => {
      const runtime = await startRuntime();
      const checked = await check(still, { runtime });
      const inspected = await inspect(still, { runtime });
      expect(checked.ok).toBe(true);
      expect(checked.programDigest).toBe(EXPECTED_STILL_PROGRAM_DIGEST);
      expect(inspected.programDigest).toBe(EXPECTED_STILL_PROGRAM_DIGEST);
      expect(checked).not.toHaveProperty("sourceId");
      expect(inspected.config).toMatchObject({ width: 160, height: 90, animated: false });
      expect(inspected.assets).toMatchObject([{ name: "mark", byteLength: 3, mimeType: "image/png" }]);
      expect(inspected.metadata).not.toHaveProperty("adapter");
      await runtime.dispose();
    });

    it("applies value variants and exact-aspect editions without changing the runtime seam", async () => {
      const runtime = await startRuntime();
      const result = await render(responsiveStill, {
        runtime,
        as: "html",
        variantId: "dark",
        editionId: "square",
      });
      expect(result.coordinates).toEqual({ variantId: "dark", editionId: "square" });
      expect(await result.text()).toContain("square:100x100:dark");

      const bundle = await exportMedia(responsiveStill, {
        runtime,
        variantIds: ["dark"],
        editionIds: ["square"],
        for: [{ id: "square-card", format: "html", width: 100, height: 100 }],
      });
      expect(bundle.artifacts).toHaveLength(1);
      expect(bundle.artifacts[0]).toMatchObject({
        path: "dark/square-card.html",
        coordinates: { variantId: "dark", editionId: "square", renditionId: "square-card" },
      });
      expect(new TextDecoder().decode(await read(bundle.artifacts[0]!.stream()))).toContain("square:100x100:dark");
      await bundle.dispose();
      await runtime.dispose();
    });

    it("uses authored posters, requires explicit time otherwise, and remains reusable after failure", async () => {
      const runtime = await startRuntime();
      const poster = await render(animatedPoster, { runtime, as: "html" });
      expect(await poster.text()).toContain("frame:10");

      const posterBundle = await exportMedia(animatedPoster, {
        runtime,
        for: [{ id: "poster", format: "html", width: 160, height: 90 }],
      });
      expect(new TextDecoder().decode(await read(posterBundle.artifacts[0]!.stream()))).toContain("frame:10");
      await posterBundle.dispose();

      await expect(render(animatedWithoutPoster, { runtime, as: "html" })).rejects.toBeInstanceOf(MediaPreflightError);
      const explicit = await render(animatedWithoutPoster, { runtime, as: "html", at: "500ms" });
      expect(await explicit.text()).toContain("frame:5");

      await expect(render(vectorStill, { runtime, as: "html" })).rejects.toBeInstanceOf(MediaPreflightError);
      const recovered = await render(vectorStill, { runtime, as: "svg" });
      expect(await recovered.text()).toContain("<svg");
      await runtime.dispose();
    });

    it("forwards export data and emits the canonical exact HTML head", async () => {
      const runtime = await startRuntime();
      const dataBundle = await exportMedia(styledStill, {
        runtime,
        data: { title: "Export override" },
        for: [{ id: "document", format: "html", width: 160, height: 90 }],
      });
      const document = new TextDecoder().decode(await read(dataBundle.artifacts[0]!.stream()));
      expect(document).toContain("Export override");
      expect(document).toContain("@layer reset,base,user");
      expect(document).toContain("html,body{margin:0;padding:0");
      expect(document).toContain('<link rel="stylesheet" href="https://styles.example/conformance.css">');
      expect(document).toContain("@tailwindcss/browser@4");
      expect(document).toContain("--conformance-accent: #663399");
      expect(document).toContain(".conformance-card{color:var(--conformance-accent)}");
      expect(dataBundle.manifest.metadata).not.toHaveProperty("adapter");
      await dataBundle.dispose();
      await runtime.dispose();
    });

    it("renders one exact portable HTML result and supports concurrent semantic jobs", async () => {
      const runtime = await startRuntime({ concurrency: 2 });
      const [first, second, report] = await Promise.all([
        render(still, { runtime, as: "html", data: { title: "First" } }),
        render(still, { runtime, as: "html", data: { title: "Second" } }),
        check(still, { runtime }),
      ]);
      expect(await first.text()).toContain("First");
      expect(await second.text()).toContain("Second");
      expect(report.ok).toBe(true);
      expect(first).not.toHaveProperty("path");
      expect(first).not.toHaveProperty("url");
      await runtime.dispose();
    });

    it("exports static collections to a portable, disposable bundle", async () => {
      const runtime = await startRuntime();
      const media = collection({
        entries: [{ id: "one", title: "One" }, { id: "two", title: "Two" }],
        media: image<{ id: string; title: string }>({
          size: { width: 160, height: 90 },
          render: (ctx) => Html({ html: `<h1>${ctx.data.title}</h1>` }),
        }),
      });
      const bundle = await exportMedia(media, {
        runtime,
        entryIds: ["two"],
        for: [{ id: "card", format: "html", width: 160, height: 90 }],
      });
      await runtime.dispose();

      expect(bundle.artifacts).toHaveLength(1);
      expect(bundle.artifacts[0]).toMatchObject({
        path: "two/card.html",
        coordinates: { entryId: "two", renditionId: "card" },
      });
      expect(new TextDecoder().decode(await read(bundle.artifacts[0]!.stream()))).toContain("Two");
      const firstRead = await read(bundle.artifacts[0]!.stream());
      expect(firstRead).toEqual(await read(bundle.artifacts[0]!.stream()));
      expect(bundle.artifacts[0]!.byteLength).toBe(firstRead.byteLength);
      expect(bundle.artifacts[0]!.sha256).toBe(await sha256(firstRead));
      expect(bundle.manifest.artifacts[0]!.sha256).toBe(bundle.artifacts[0]!.sha256);
      expect(bundle.manifest.artifacts).toEqual(bundle.artifacts.map((artifact) => ({
        path: artifact.path,
        mimeType: artifact.mimeType,
        byteLength: artifact.byteLength,
        sha256: artifact.sha256,
        coordinates: artifact.coordinates,
      })));
      for (const artifact of bundle.artifacts) {
        expect(artifact.path.startsWith("/")).toBe(false);
        expect(artifact.path).not.toMatch(/(?:^|\/)\.\.(?:\/|$)|\\|:\/\//);
        expect(artifact).not.toHaveProperty("url");
        expect(artifact).not.toHaveProperty("absolutePath");
        expect(artifact).not.toHaveProperty("buffer");
        expect(typeof artifact.blob).toBe("function");
      }

      await bundle.dispose();
      await bundle.dispose();
      expect(() => bundle.artifacts[0]!.stream()).toThrow(ExportBundleDisposedError);
    });

    it("covers every planned entry, variant, edition, and rendition in the manifest", async () => {
      const runtime = await startRuntime();
      const media = collection({
        entries: [
          { id: "one", title: "One", tone: "light" },
          { id: "two", title: "Two", tone: "light" },
        ],
        media: image<{ id: string; title: string; tone: string }>({
          size: { width: 160, height: 90 },
          variants: { dark: { tone: "dark" } },
          editions: {
            square: {
              size: { width: 100, height: 100 },
              render: (ctx) => Html({ html: `${ctx.data.title}:square:${ctx.data.tone}` }),
            },
          },
          render: (ctx) => Html({ html: `${ctx.data.title}:wide:${ctx.data.tone}` }),
        }),
      });
      const bundle = await exportMedia(media, {
        runtime,
        variantIds: ["dark"],
        editionIds: ["default", "square"],
        for: [
          { id: "wide", format: "html", width: 160, height: 90 },
          { id: "square", format: "html", width: 100, height: 100 },
        ],
      });
      expect(bundle.artifacts).toHaveLength(4);
      const covered = new Set(bundle.artifacts.map((artifact) => JSON.stringify({
        ...(artifact.coordinates.entryId !== undefined ? { entryId: artifact.coordinates.entryId } : {}),
        variantId: artifact.coordinates.variantId,
        editionId: artifact.coordinates.editionId,
      })));
      expect(covered).toEqual(new Set(bundle.manifest.coordinates.map((coordinates) => JSON.stringify(coordinates))));
      expect(bundle.manifest.artifacts).toHaveLength(bundle.artifacts.length);
      await bundle.dispose();
      await runtime.dispose();
    });

    it("advertises and renders the shipped SVG-to-PNG path", async () => {
      const runtime = await startRuntime();
      if (!runtime.capabilities.rasters.includes("png")) {
        await runtime.dispose();
        return;
      }
      const result = await render(vectorStill, { runtime, as: "png" });
      expect(Array.from((await read(result.stream())).slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      await runtime.dispose();
    });

    it("encodes every animated format it advertises without treating a poster as a video still", async () => {
      const runtime = await startRuntime();
      if (runtime.capabilities.animated.length > 0) {
        const bundle = await exportMedia(tinyAnimatedPoster, {
          runtime,
          for: runtime.capabilities.animated.map((format) => ({
            id: format,
            format,
            width: 16,
            height: 16,
          })),
        });
        expect(bundle.artifacts).toHaveLength(runtime.capabilities.animated.length);
        for (const artifact of bundle.artifacts) {
          const bytes = await read(artifact.stream());
          if (artifact.mimeType === "video/mp4") {
            expect(new TextDecoder().decode(bytes.slice(4, 8))).toBe("ftyp");
          } else if (artifact.mimeType === "video/webm") {
            expect(Array.from(bytes.slice(0, 4))).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
          } else if (artifact.mimeType === "image/gif") {
            expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("GIF8");
          }
        }
        await bundle.dispose();
      }
      await runtime.dispose();
    // This integration starts Chromium and several native encoders under the
    // repository gate. Keep a bound without treating startup as a 5s unit test.
    }, 30_000);

    it("checks every static collection entry and reports authored failures at entry coordinates", async () => {
      const runtime = await startRuntime();
      const report = await check(failingStaticCollection, { runtime });
      expect(report.ok).toBe(false);
      expect(report.findings).toContainEqual(expect.objectContaining({
        code: "RENDER_EXCEPTION",
        coordinates: { entryId: "bad", variantId: "default", editionId: "default" },
      }));
      await runtime.dispose();
    });

    it("executes providers only on explicit opt-in and only on capable runtimes", async () => {
      let calls = 0;
      const media = collection({
        entries: () => {
          calls += 1;
          return [{ id: "one", title: "One" }];
        },
        media: image<{ id: string; title: string }>({
          render: (ctx) => Html({ html: ctx.data.title }),
        }),
      });
      const runtime = await startRuntime();
      await inspect(media, { runtime });
      expect(calls).toBe(0);
      if (profile.providerCollections) {
        const report = await inspect(media, { runtime, providers: "resolve" });
        expect(report.collection).toMatchObject({ resolved: true, entryCount: 1 });
        expect(calls).toBe(1);
      } else {
        await expect(inspect(media, { runtime, providers: "resolve" })).rejects.toBeInstanceOf(CapabilityUnavailableError);
        expect(calls).toBe(0);
      }
      await runtime.dispose();
    });

    it("checks every provider entry exactly once when provider execution is explicit", async () => {
      let calls = 0;
      const media = collection({
        entries: () => {
          calls += 1;
          return [
            { id: "good", fail: false },
            { id: "bad", fail: true },
          ];
        },
        media: image<{ id: string; fail: boolean }>({
          render: (ctx) => {
            if (ctx.data.fail) throw new Error("provider entry failed");
            return Html({ html: ctx.data.id });
          },
        }),
      });
      const runtime = await startRuntime();
      if (profile.providerCollections) {
        const report = await check(media, { runtime, providers: "resolve" });
        expect(calls).toBe(1);
        expect(report.findings).toContainEqual(expect.objectContaining({
          code: "RENDER_EXCEPTION",
          coordinates: { entryId: "bad", variantId: "default", editionId: "default" },
        }));
      } else {
        await expect(check(media, { runtime, providers: "resolve" })).rejects.toBeInstanceOf(CapabilityUnavailableError);
        expect(calls).toBe(0);
      }
      await runtime.dispose();
    });

    it("rejects explicitly empty selectors with stable authored findings", async () => {
      const runtime = await startRuntime();
      for (const [key, code] of [
        ["entryIds", "EXPORT_ENTRY_SELECTOR_EMPTY"],
        ["variantIds", "EXPORT_VARIANT_SELECTOR_EMPTY"],
        ["editionIds", "EXPORT_EDITION_SELECTOR_EMPTY"],
      ] as const) {
        let failure: unknown;
        try {
          await exportMedia(still, {
            runtime,
            for: [{ id: "document", format: "html", width: 160, height: 90 }],
            [key]: [],
          });
        } catch (error) {
          failure = error;
        }
        expect(failure).toBeInstanceOf(MediaPreflightError);
        expect((failure as MediaPreflightError).findings.map((finding) => finding.code)).toContain(code);
      }
      await runtime.dispose();
    });

    it("freezes logical font bytes and embeds only opaque prepared font data", async () => {
      await withMockFetch(fontFetch, async () => {
        const runtime = await startRuntime();
        const inspected = await inspect(fontStill, { runtime });
        const authored = inspected.fonts.find((font) => font.family === "Conformance Frozen Font");
        expect(authored).toMatchObject({
          request: "ConformanceFrozenFont:wght@400",
          family: "Conformance Frozen Font",
          weight: 400,
          style: "normal",
          mimeType: "font/ttf",
          byteLength: FROZEN_FONT_BYTES.byteLength,
        });
        expect(authored!.sha256).toBe(await sha256(FROZEN_FONT_BYTES));
        // The bundled default family is always frozen alongside author fonts.
        expect(inspected.fonts.filter((font) => font.family === "Inter").map((font) => font.weight).sort())
          .toEqual([400, 500, 700]);
        const bundle = await exportMedia(fontStill, {
          runtime,
          for: [{ id: "font-document", format: "html", width: 80, height: 40 }],
        });
        expect(bundle.manifest.fonts).toEqual(inspected.fonts);
        const document = new TextDecoder().decode(await read(bundle.artifacts[0]!.stream()));
        expect(document).toContain('@font-face{font-family:"Conformance Frozen Font"');
        expect(document).toContain("data:font/ttf;base64,AAEAAAAAAAAAAAAA");
        await bundle.dispose();
        await runtime.dispose();
      });
    });

    it("honors browser quality or rejects encoding options it cannot implement", async () => {
      if (profile.name !== "browser") return;
      const runtime = await startRuntime();
      expect(runtime.capabilities.rasters).toContain("jpeg");
      const low = await render(qualityStill, {
        runtime,
        as: "jpeg",
        encoding: { still: { quality: 10 } },
      });
      const high = await render(qualityStill, {
        runtime,
        as: "jpeg",
        encoding: { still: { quality: 95 } },
      });
      expect(low.sha256).not.toBe(high.sha256);
      const scaled = await render(qualityStill, {
        runtime,
        as: "png", encoding: { capture: { dpr: 2, scale: "device" } },
      });
      const bitmap = await createImageBitmap(new Blob([await read(scaled.stream())], { type: "image/png" }));
      expect([bitmap.width, bitmap.height]).toEqual([192, 128]);
      bitmap.close();
      let unsupported: unknown;
      try {
        await render(qualityStill, {
          runtime,
          as: "png",
          encoding: { capture: { colorProfile: "display-p3" } },
        });
      } catch (error) {
        unsupported = error;
      }
      expect(unsupported).toBeInstanceOf(MediaPreflightError);
      expect((unsupported as MediaPreflightError).findings).toContainEqual(expect.objectContaining({
        code: "BROWSER_ENCODING_OPTION_UNAVAILABLE",
      }));
      await runtime.dispose();
    });

    it("throws stable cancellation and disposed-runtime errors", async () => {
      const controller = new AbortController();
      controller.abort();
      const runtime = await startRuntime();
      await expect(check(still, { runtime, signal: controller.signal })).rejects.toBeInstanceOf(RuntimeCancelledError);
      await runtime.dispose();
      await expect(check(still, { runtime })).rejects.toBeInstanceOf(RuntimeDisposedError);
    });

    it("cancels an in-flight resource preflight", async () => {
      await withMockFetch(slowAssetFetch, async () => {
        const controller = new AbortController();
        const runtime = await startRuntime();
        const pending = render(remoteAssetStill, {
          runtime,
          as: "html",
          signal: controller.signal,
        });
        await Promise.resolve();
        controller.abort();
        await expect(pending).rejects.toBeInstanceOf(RuntimeCancelledError);
        await runtime.dispose();
      });
    });
  });
}

const renderStill = ((ctx: ImageRenderContext<{ title: string }>) => Html({
  width: "fill",
  height: "fill",
  html: `<img src="${ctx.asset("mark")}"><h1>${ctx.data.title}</h1>`,
})).bind(null);

const still = image<{ title: string }>({
  size: { width: 160, height: 90 },
  sample: { title: "Hello" },
  assets: {
    mark: { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" },
  },
  render: renderStill,
});

const responsiveStill = image<{ title: string; tone: string }>({
  size: { width: 160, height: 90 },
  sample: { title: "Card", tone: "light" },
  variants: { dark: { tone: "dark" } },
  editions: {
    square: {
      size: { width: 100, height: 100 },
      render: (ctx) => Html({ html: `square:${ctx.width}x${ctx.height}:${ctx.data.tone}` }),
    },
  },
  render: (ctx) => Html({ html: `root:${ctx.width}x${ctx.height}:${ctx.data.tone}` }),
});

const styledStill = image<{ title: string }>({
  size: { width: 160, height: 90 },
  sample: { title: "Styled" },
  stylesheets: ["https://styles.example/conformance.css"],
  inlineCss: [".conformance-card{color:var(--conformance-accent)}"],
  tailwind: { css: "@theme { --conformance-accent: #663399; }" },
  render: (ctx) => Html({
    className: "conformance-card",
    html: `<h1>${ctx.data.title}</h1>`,
  }),
});

const animatedPoster = video({
  size: { width: 160, height: 90 },
  duration: "2s",
  fps: 10,
  poster: "1s",
  render: (ctx) => Html({ html: `frame:${ctx.timeline.frame}` }),
});

const animatedWithoutPoster = video({
  size: { width: 160, height: 90 },
  duration: "2s",
  fps: 10,
  render: (ctx) => Html({ html: `frame:${ctx.timeline.frame}` }),
});

const tinyAnimatedPoster = video({
  size: { width: 16, height: 16 },
  duration: "100ms",
  fps: 1,
  poster: "50ms",
  render: (ctx) => Html({
    width: "fill",
    height: "fill",
    html: `<div style="width:16px;height:16px;background:rgb(${ctx.timeline.frame * 10},40,80)"></div>`,
  }),
});

const failingStaticCollection = collection({
  entries: [
    { id: "good", fail: false },
    { id: "bad", fail: true },
  ],
  media: image<{ id: string; fail: boolean }>({
    size: { width: 80, height: 40 },
    render: (ctx) => {
      if (ctx.data.fail) throw new Error("static entry failed");
      return Html({ html: ctx.data.id });
    },
  }),
});

const fontStill = image({
  size: { width: 80, height: 40 },
  fonts: [googleFont("ConformanceFrozenFont:wght@400")],
  render: () => Html({ html: '<div style="font-family:Conformance Frozen Font">Font</div>' }),
});

const qualityStill = image({
  size: { width: 96, height: 64 },
  render: () => Html({
    width: "fill",
    height: "fill",
    html: '<div style="width:96px;height:64px;background:linear-gradient(115deg,#110022,#ff8800,#22ccff);font:700 18px system-ui;color:white">Quality</div>',
  }),
});

const remoteAssetStill = image({
  size: { width: 80, height: 40 },
  assets: { slow: { url: "https://assets.example/slow.png", type: "image" } },
  render: () => Html({ html: "slow" }),
});

const vectorStill = svg({
  size: { width: 64, height: 64 },
  render: () => Vector(
    { viewBox: { x: 0, y: 0, width: 64, height: 64 } },
    vector.path({ d: "M0 0H64V64H0Z", fill: "#225588" }),
  ),
});

async function read(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function withMockFetch<T>(mock: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: mock,
  });
  try {
    return await run();
  } finally {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: original,
    });
  }
}

// Complete SFNT header for the byte-freezing contract, not a glyph fixture.
// Actual text rendering is covered with a real TTF in core's fonts.test.ts.
const FROZEN_FONT_BYTES = new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

const fontFetch: typeof fetch = async (input) => {
  const url = requestUrl(input);
  if (url.startsWith("https://fonts.googleapis.com/css2?family=ConformanceFrozenFont")) {
    return new Response(
      "@font-face{font-family:'Conformance Frozen Font';font-style:normal;font-weight:400;src:url(https://fonts.example/conformance.ttf)}",
      { status: 200, headers: { "content-type": "text/css" } },
    );
  }
  if (url === "https://fonts.example/conformance.ttf") {
    return new Response(FROZEN_FONT_BYTES, {
      status: 200,
      headers: { "content-type": "font/ttf" },
    });
  }
  return new Response("not found", { status: 404 });
};

const slowAssetFetch: typeof fetch = async (_input, init) => {
  return await new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    const abort = () => reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
};

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
