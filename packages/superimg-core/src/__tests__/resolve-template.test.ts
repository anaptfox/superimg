import { describe, expect, it } from "vitest";
import { define, ValidationError } from "@superimg/types";
import {
  applyTemplateResolve,
  normalizeResolveResult,
  raceAbort,
  sessionOptionsFromResolve,
} from "../rendering/resolve-template.js";
import { compileTemplate } from "../rendering/compiler.js";
import { createRenderPlan } from "../rendering/engine.js";
import { bundleTemplateCodeWithMap } from "../bundler/bundler.js";

describe("normalizeResolveResult", () => {
  it("accepts a valid result", () => {
    const r = normalizeResolveResult({
      duration: 3,
      width: 1280,
      markers: [{ id: "a", at: 1.5, label: "A" }],
      phases: { enter: "15%", hold: "85%" },
    });
    expect(r.duration).toBe(3);
    expect(r.width).toBe(1280);
    expect(r.markers?.[0]?.id).toBe("a");
  });

  it("rejects non-object", () => {
    expect(() => normalizeResolveResult(null)).toThrow(ValidationError);
    expect(() => normalizeResolveResult([])).toThrow(ValidationError);
  });

  it("rejects invalid duration string", () => {
    expect(() => normalizeResolveResult({ duration: "nope" })).toThrow(ValidationError);
  });

  it("rejects non-positive width", () => {
    expect(() => normalizeResolveResult({ width: 0 })).toThrow(ValidationError);
    expect(() => normalizeResolveResult({ width: -1 })).toThrow(ValidationError);
  });
});

describe("raceAbort", () => {
  it("returns the promise value when no signal", async () => {
    await expect(raceAbort(Promise.resolve(42))).resolves.toBe(42);
  });

  it("rejects when already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(raceAbort(Promise.resolve(1), ac.signal)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("rejects mid-flight when signal aborts", async () => {
    const ac = new AbortController();
    let release!: () => void;
    const hang = new Promise<number>((resolve) => {
      release = () => resolve(1);
    });
    const raced = raceAbort(hang, ac.signal);
    ac.abort();
    await expect(raced).rejects.toBeInstanceOf(ValidationError);
    release();
  });
});

describe("applyTemplateResolve", () => {
  it("passthrough when no resolve hook", async () => {
    const template = define({
      config: { width: 1280, height: 720, fps: 30, duration: 3 },
      sample: { title: "Hi" },
      render: () => "<div/>",
    });

    const result = await applyTemplateResolve(template, {
      data: { title: "Bye" },
    });

    expect(result.resolved).toBeNull();
    expect(result.data).toEqual({ title: "Bye" });
    expect(result.template.config?.duration).toBe(3);
  });

  it("applies duration and data from resolve", async () => {
    const template = define({
      config: { width: 1920, height: 1080, fps: 30, duration: 5 },
      sample: { items: ["a"] },
      resolve: ({ data }) => ({
        duration: (data.items as string[]).length * 2,
        data: { resolved: true },
      }),
      render: () => "<div/>",
    });

    const result = await applyTemplateResolve(template, {
      data: { items: ["a", "b", "c"] },
    });

    expect(result.resolved?.duration).toBe(6);
    expect(result.template.config?.duration).toBe(6);
    expect(result.data).toMatchObject({
      items: ["a", "b", "c"],
      resolved: true,
    });
  });

  it("allows animated define with resolve and no static duration", async () => {
    const template = define({
      config: { fps: 24, width: 800, height: 600 },
      resolve: async () => ({ duration: "2s" }),
      render: () => "<div/>",
    });

    expect(template.animated).toBe(true);
    const result = await applyTemplateResolve(template);
    expect(result.template.config?.duration).toBe("2s");
  });

  it("throws when animated template still has no duration after resolve", async () => {
    const template = define({
      config: { fps: 30 },
      resolve: async () => ({}),
      render: () => "<div/>",
    });

    await expect(applyTemplateResolve(template)).rejects.toBeInstanceOf(ValidationError);
  });

  it("job overrides win over resolve", async () => {
    const template = define({
      config: { fps: 30, duration: 5 },
      resolve: () => ({ duration: 10, width: 640 }),
      render: () => "<div/>",
    });

    const result = await applyTemplateResolve(template, {
      overrides: { duration: 2, width: 320 },
    });

    expect(result.template.config?.duration).toBe(2);
    expect(result.template.config?.width).toBe(320);
  });

  it("throws when signal is already aborted", async () => {
    const template = define({
      config: { fps: 30, duration: 1 },
      resolve: () => ({ duration: 2 }),
      render: () => "<div/>",
    });
    const ac = new AbortController();
    ac.abort();

    await expect(
      applyTemplateResolve(template, { signal: ac.signal }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws when resolve returns invalid width", async () => {
    const template = define({
      config: { fps: 30, duration: 1 },
      resolve: () => ({ width: -5 }),
      render: () => "<div/>",
    });
    await expect(applyTemplateResolve(template)).rejects.toBeInstanceOf(ValidationError);
  });

  it("compileTemplate preserves resolve from define() module", () => {
    const mod = define({
      config: { fps: 30, duration: 1 },
      resolve: () => ({ duration: 4 }),
      render: () => "<div/>",
    });

    const code = `
      var __template = { default: {
        medium: ${JSON.stringify(mod.medium)},
        animated: ${JSON.stringify(mod.animated)},
        config: ${JSON.stringify(mod.config)},
        render: function() { return "<div/>"; },
        resolve: function() { return { duration: 4 }; }
      }};
    `;
    const result = compileTemplate(code);
    expect(result.error).toBeUndefined();
    expect(result.template?.resolve).toBeTypeOf("function");
  });
});

describe("sessionOptionsFromResolve", () => {
  it("converts markers and prefers formatDims", async () => {
    const template = define({
      config: { fps: 30, duration: 5, width: 640, height: 360 },
      resolve: () => ({
        duration: 4,
        width: 800,
        markers: [{ id: "m1", at: "1s", label: "One" }],
      }),
      render: () => "<div/>",
    });
    const applied = await applyTemplateResolve(template);
    const session = sessionOptionsFromResolve(applied, {
      formatDims: { width: 1920, height: 1080 },
    });
    expect(session.width).toBe(1920);
    expect(session.height).toBe(1080);
    expect(session.durationSeconds).toBe(4);
    expect(session.markers).toEqual([
      { id: "m1", at: { type: "time", value: 1 }, label: "One" },
    ]);
  });
});

describe("define resolve animated flag", () => {
  it("marks animated when fps + resolve without duration", () => {
    const t = define({
      config: { fps: 30 },
      resolve: () => ({ duration: 1 }),
      render: () => "x",
    });
    expect(t.animated).toBe(true);
  });

  it("stays static without fps", () => {
    const t = define({
      config: { width: 100, height: 100 },
      resolve: () => ({ width: 200 }),
      render: () => "x",
    });
    expect(t.animated).toBe(false);
  });
});

describe("createRenderPlan + resolve", () => {
  it("uses resolve duration over soft job duration", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        config: { fps: 30, duration: 2 },
        sample: { n: 3 },
        resolve({ data }) {
          return { duration: data.n * 2 };
        },
        render() { return '<div/>'; }
      });
    `;
    const templateBundle = await bundleTemplateCodeWithMap(code, {
      sourcefile: "resolve-dur.video.ts",
    });
    const plan = await createRenderPlan({
      templateBundle,
      duration: 2, // soft default from config
      width: 640,
      height: 360,
      fps: 30,
      data: { n: 5 },
    });
    // resolve: 5 * 2 = 10s → 300 frames
    expect(plan.durationSeconds).toBe(10);
    expect(plan.totalFrames).toBe(300);
    expect(plan.resolveResult?.duration).toBe(10);
  });

  it("explicitOverrides win over resolve duration", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        config: { fps: 30, duration: 2 },
        resolve() { return { duration: 10 }; },
        render() { return '<div/>'; }
      });
    `;
    const templateBundle = await bundleTemplateCodeWithMap(code, {
      sourcefile: "resolve-override.video.ts",
    });
    const plan = await createRenderPlan(
      {
        templateBundle,
        duration: 2,
        width: 640,
        height: 360,
        fps: 30,
      },
      { explicitOverrides: { duration: 3 } },
    );
    expect(plan.durationSeconds).toBe(3);
    expect(plan.totalFrames).toBe(90);
  });
});
