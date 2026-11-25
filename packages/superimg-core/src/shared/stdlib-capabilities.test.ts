import { describe, expect, it } from "vitest";
import { define, video, type JsonObject } from "@superimg/types";
import { compileTemplate } from "../rendering/compiler.js";
import { createPreparedStdlibForTemplate } from "./stdlib-capabilities.js";
import {
  detectMediaCapabilitiesFromSource,
  detectStdlibCapabilities,
  detectStdlibCapabilitiesFromSource,
  stampStdlibCapabilitiesFromSource,
} from "./stdlib-capability-detection.js";
import { Html } from "@superimg/stdlib/tree";

describe("stdlib capabilities", () => {
  it("detects capability use without loading the heavy packs into the base graph", () => {
    const template = define<JsonObject>({
      config: { duration: 1 },
      render(ctx) {
        return Html({ width: "fill", height: "fill", html: [
          ctx.std.code.highlight("const x = 1", { lang: "ts" }),
          ctx.std.svg.rough.circle(10, 10, 4),
          ctx.std.viz.equation("x"),
          ctx.std.viz.lottie({
            animationData: {},
            progress: 0,
            width: 100,
            height: 100,
          }),
          ctx.std.viz.mermaid("graph TD; A-->B"),
          (ctx.std.viz as unknown as { three: typeof import("@superimg/stdlib/compat/three") }).three.scene({
            width: 100,
            height: 100,
            progress: 0,
            setup: "",
            animate: "",
          }),
        ].join("") });
      },
    });

    expect(detectStdlibCapabilities(template)).toEqual([
      "code",
      "rough",
      "katex",
      "lottie",
      "mermaid",
      "three",
    ]);
  });

  it("prepares a detected capability before render", async () => {
    const template = define<JsonObject>({
      config: { duration: 1 },
      render(ctx) {
        return Html({ width: "fill", height: "fill", html: ctx.std.code.highlight("const answer = 42", { lang: "ts" }) });
      },
    });

    const prepared = await createPreparedStdlibForTemplate(template);
    expect(prepared.code.highlight("const answer = 42", { lang: "ts" })).toContain("answer");
  });

  it("scans the lowered runtime of retained interactive children", async () => {
    const interactive = {
      kind: "interactive" as const,
      createCompositionRuntime: () => ({
        media: define<JsonObject>({
          render(ctx) {
            return Html({ width: "fill", height: "fill", html: ctx.std.code.highlight("const answer = 42", { lang: "ts" }) });
          },
        }),
        setScene() {},
        getSnapshot: () => ({}),
        subscribe: () => () => undefined,
        attachActions: () => () => undefined,
      }),
    };
    const root = define<JsonObject>({ render: () => Html({ html: "root" }) });
    const retained = {
      ...root,
      composition: {
        schemaVersion: 0,
        program: { op: "sequence" as const, parts: [{ id: "lesson", content: interactive }] },
        outputSize: { width: 1920, height: 1080 },
        schedule: { totalFrames: 1, totalDurationSeconds: 1, selectedRoutes: {}, leaves: [] },
      },
    };
    const prepared = await createPreparedStdlibForTemplate(retained);
    expect(prepared.code.highlight("const answer = 42", { lang: "ts" })).toContain("answer");
  });

  it("detects std.code used only in a helper outside render.toString()", () => {
    // Mimic before-after-code: helper holds std.code; render only calls the helper.
    function renderCodeWindow(
      std: { code: { highlight: (source: string, options: { lang: string }) => string } },
      code: string,
    ) {
      return std.code.highlight(code, { lang: "ts" });
    }
    const template = define<JsonObject>({
      config: { duration: 1 },
      render(ctx) {
        return Html({ width: "fill", height: "fill", html: renderCodeWindow(ctx.std as never, "const x = 1") });
      },
    });

    // render.toString() does not include the helper body
    expect(template.render.toString()).not.toMatch(/\bstd\.code\b/);
    expect(detectStdlibCapabilities(template)).not.toContain("code");

    stampStdlibCapabilitiesFromSource(
      template,
      `function renderCodeWindow(std) { return std.code.highlight("x"); }
       function render(ctx) { return renderCodeWindow(ctx.std); }`,
    );
    expect(detectStdlibCapabilities(template)).toContain("code");
  });

  it("compileTemplate stamps capabilities from full IIFE source", () => {
    const iife = `
      var __template = (function(exports) {
        function renderCodeWindow(std, code) {
          return std.code.highlight(code, { lang: "ts" });
        }
        exports.default = {
          kind: "media",
          media: "video",
          fallbackFormat: "mp4",
          medium: "html",
          animated: false,
          render: function render(ctx) {
            return { $$typeof: "@foxworth/superimg/element", type: "Html", props: { width: "fill", height: "fill", html: renderCodeWindow(ctx.std, "const x = 1") }, children: [] };
          },
          config: { duration: 1 },
        };
        return exports;
      })({});
    `;
    const result = compileTemplate(iife);
    expect(result.error).toBeUndefined();
    expect(result.media).toBeDefined();
    expect(detectStdlibCapabilities(result.media!)).toContain("code");
  });

  it("survives Player-style template clone ({ ...template, config, sample })", () => {
    const iife = `
      var __template = (function(exports) {
        function renderCodeWindow(std, code) {
          return std.code.highlight(code, { lang: "ts" });
        }
        exports.default = {
          kind: "media",
          media: "video",
          fallbackFormat: "mp4",
          medium: "html",
          animated: false,
          render: function render(ctx) {
            return { $$typeof: "@foxworth/superimg/element", type: "Html", props: { width: "fill", height: "fill", html: renderCodeWindow(ctx.std, "const x = 1") }, children: [] };
          },
          config: { duration: 1, fps: 30 },
          sample: { title: "hi" },
        };
        return exports;
      })({});
    `;
    const result = compileTemplate(iife);
    expect(result.media).toBeDefined();
    // applyTemplateResolve / Player.load clones like this and would drop object WeakMap keys
    const cloned = {
      ...result.media!,
      config: { ...result.media!.config },
      sample: { ...result.media!.sample },
    };
    expect(detectStdlibCapabilities(cloned as never)).toContain("code");
  });

  it("detectStdlibCapabilitiesFromSource finds packs in arbitrary text", () => {
    expect(
      detectStdlibCapabilitiesFromSource("std.code.highlight; std.viz.equation('x')"),
    ).toEqual(["code", "katex"]);
  });

  it("detects heavy packs through local stdlib namespace aliases", () => {
    expect(
      detectStdlibCapabilitiesFromSource(`
        const viz = std.viz;
        const svg = ctx.std.svg;
        viz.katex.equation("x");
        viz.three.scene({});
        svg.rough.circle(10, 10, 4);
      `),
    ).toEqual(["rough", "katex", "three"]);
  });

  it("follows a bundled root alias into a namespace alias", () => {
    expect(
      detectStdlibCapabilitiesFromSource(`
        const runtime = ctx.std;
        const colors = runtime.color;
        colors.alpha("#fff", 0.5);
      `),
    ).toEqual(["color"]);
  });

  it("detects the destructured stdlib root in the minified Study02 render", () => {
    expect(detectStdlibCapabilitiesFromSource(
      'render(e){let{scene:t,std:n,timeline:r,width:i,height:a,data:o}=e,s=n.oscillate(r.seconds,{period:`3s`,from:-8,to:8})}',
    )).toEqual(["oscillate"]);
    expect(detectStdlibCapabilitiesFromSource(
      'const { scene, std: runtime } = ctx; const colors = runtime.color; colors.alpha("#fff", 0.5);',
    )).toEqual(["color"]);
  });

  it("uses the conservative pack for dynamic stdlib access", () => {
    expect(detectStdlibCapabilitiesFromSource(`
      const runtime = ctx.std;
      runtime[capabilityName];
    `)).toEqual([
      "math",
      "color",
      "date",
      "text",
      "layout",
      "svg",
      "viz",
      "subtitle",
      "backgrounds",
      "montage",
      "path",
      "reveal",
      "responsive",
      "carousel",
      "stack",
      "spring",
      "stagger",
      "timing",
      "phases",
      "motion",
      "safe-area",
      "oscillate",
      "ready",
      "layout-timeline",
      "interpolate",
      "code",
      "rough",
      "katex",
      "lottie",
      "mermaid",
      "three",
    ]);
  });

  it("isolates optional capability packs between prepared sessions", async () => {
    const colorTemplate = define<JsonObject>({
      render: (ctx) => Html({ html: ctx.std.color.alpha("#fff", 0.5) }),
    });
    const plainTemplate = define<JsonObject>({
      render: () => Html({ html: "plain" }),
    });

    const [withColor, plain] = await Promise.all([
      createPreparedStdlibForTemplate(colorTemplate),
      createPreparedStdlibForTemplate(plainTemplate),
    ]);

    expect(withColor.color.alpha("#fff", 0.5)).toContain("rgba");
    expect(() => plain.color.alpha("#fff", 0.5)).toThrow(/was not prepared/);
    expect(Object.isFrozen(withColor)).toBe(true);
    expect(Object.isFrozen(withColor.viz)).toBe(true);
  });

  it("bounds retained capability-source traversal when wrappers form a cycle", () => {
    const authored = video<JsonObject>({
      duration: "1s",
      render: (ctx) => Html({ html: String(ctx.std.oscillate(ctx.timeline.seconds, { period: "1s" })) }),
    });
    const wrapper = { ...authored, render: () => Html({ html: "wrapper" }),
      [Symbol.for("superimg.stdlib-capability-source")]: authored };
    Object.defineProperty(authored, Symbol.for("superimg.stdlib-capability-source"), { value: wrapper });
    expect(detectStdlibCapabilities(wrapper)).toEqual(["oscillate"]);
  });

  it("keeps an explicit empty manifest authoritative over a retained authored callback", async () => {
    const authored = video<JsonObject>({
      duration: "1s",
      render: (ctx) => Html({ html: String(ctx.std.oscillate(ctx.timeline.seconds, { period: "1s" })) }),
    });
    const template = { ...authored, mediaCapabilities: { version: 0 as const, names: [] },
      [Symbol.for("superimg.stdlib-capability-source")]: authored };
    const prepared = await createPreparedStdlibForTemplate(template);
    expect(() => prepared.oscillate(0, { period: "1s" })).toThrow(/was not prepared/);
  });

  it("detectMediaCapabilitiesFromSource stamps canvas and scripts", () => {
    const media = detectMediaCapabilitiesFromSource(
      `std.viz.canvas({ draw: "ctx.fillRect(0,0,1,1)" }); <script></script>`,
    );
    expect(media.version).toBe(0);
    expect(media.names).toContain("canvas");
    expect(media.names).toContain("scripts");
  });
});
