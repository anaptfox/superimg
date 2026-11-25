import { describe, expect, it, vi } from "vitest";
import { define, image, video, type Duration, type RenderContext, type ResolveFn } from "@superimg/types";
import { Html } from "@superimg/stdlib/tree";
import { sequence } from "./sequence.js";
import { prepareComposition } from "./prepare.js";
import { time } from "./time.js";
import { createRenderContext } from "../rendering/create-render-context.js";
import { lowerRenderOutput } from "../rendering/lower-output.js";

const size = { width: 1920, height: 1080 };
const options = { size, fps: 25 };

function resolvingClip(resolve: ResolveFn<{ label: string; frames: number }>) {
  return define<{ label: string; frames: number }>({
    config: { width: size.width, height: size.height, fps: 25 },
    sample: { label: "sample", frames: 1 },
    resolve,
    render: (ctx: RenderContext<{ label: string; frames: number }>) => Html({ width: "fill", height: "fill", html: ctx.data.label }),
  });
}

describe("prepareComposition", () => {
  it("passes inherited Program data to child resolve before rendering", async () => {
    const resolve = vi.fn(({ data }: { data: { title: string; color: string } }) => ({ data: { title: `${data.title}!` } }));
    const child = video({ size, fps: 25, duration: "1f", sample: { title: "sample", color: "blue" }, resolve,
      render: (ctx) => Html({ width: "fill", height: "fill", html: `${ctx.data.title}:${ctx.data.color}` }) });
    const program = sequence([{ id: "group", data: { title: "parent" }, content: sequence([
      { id: "child", content: child, data: { color: "green" } },
    ]) }]);
    const prepared = await prepareComposition(program, options);
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ data: { title: "parent", color: "green" } }));
    expect(lowerRenderOutput(time(prepared.program, options).render(createRenderContext(0, 25, 1, size.width, size.height)))).toContain("parent!:green");
  });
  it("retains portable child audio for the timed root projection", async () => {
    const source = video({
      size,
      fps: 25,
      duration: "2f",
      audio: { id: "tone", src: "data:audio/wav;base64,UklGRiQAAABXQVZF" },
      render: () => Html({ width: "fill", height: "fill", html: "audio" }),
    });
    const prepared = await prepareComposition(sequence([{ id: "clip", content: source }]), options);

    expect(time(prepared.program, options).config?.audio).toMatchObject({
      clips: [expect.objectContaining({ id: "clip/tone", at: 0, duration: 2 / 25 })],
    });
  });

  it("resolves each reused child occurrence once with scoped use and entry data", async () => {
    const resolve: ResolveFn<{ label: string; frames: number }> = vi.fn(({ data }: { data: { label: string; frames: number } }) => ({
      duration: `${data.frames}f` as Duration,
      data: { label: `${data.label}!` },
    }));
    const source = resolvingClip(resolve);
    const program = sequence([
      { id: "first", content: source, data: { label: "use-first", frames: 2 } },
      { id: "second", content: source, data: { label: "use-second", frames: 2 } },
    ]);

    const prepared = await prepareComposition(program, {
      ...options,
      data: { uses: { second: { label: "entry-second", frames: 3 } } },
    });

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: { label: "use-first", frames: 2 } }));
    expect(resolve).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { label: "entry-second", frames: 3 } }));
    expect(prepared.plan.leaves.map(({ path, startFrame, endFrame }) => ({ path, startFrame, endFrame }))).toEqual([
      { path: "first", startFrame: 0, endFrame: 2 },
      { path: "second", startFrame: 2, endFrame: 5 },
    ]);
    expect(prepared.composition.schedule.totalFrames).toBe(5);
    expect(source.resolve).toBe(resolve);
    if (prepared.program.op !== "sequence") throw new Error("expected sequence");
    expect(prepared.program.parts[0]?.data).toBeUndefined();
    expect((prepared.program.parts[1]?.content as typeof source).sample).toMatchObject({ label: "entry-second!", frames: 3 });
    expect((prepared.program.parts[1]?.content as typeof source).resolve).toBeUndefined();
  });

  it("resolves a selected variant once and retains its edition without replaying the variant patch", async () => {
    const resolve = vi.fn(({ data }: { data: { label: string } }) => ({ data: { label: `resolved:${data.label}` } }));
    const source = video({
      size,
      fps: 25,
      duration: "1f",
      sample: { label: "base" },
      variants: { alternate: { label: "variant" } },
      editions: { square: { size: { width: 1080, height: 1080 } } },
      resolve,
      render: (ctx) => Html({ width: "fill", height: "fill", html: `${ctx.data.label}:${ctx.width}x${ctx.height}` }),
    });
    const prepared = await prepareComposition(sequence([{
      id: "clip", content: source, variant: "alternate", edition: "square", fit: "contain",
    }]), options);
    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ data: { label: "variant" } }));
    expect(prepared.plan.leaves[0]).toMatchObject({ variantId: "alternate", editionId: "square", width: 1080, height: 1080 });
    const projected = time(prepared.program, options);
    const markup = lowerRenderOutput(projected.render(createRenderContext(0, 25, 1, size.width, size.height)));
    expect(markup).toContain("resolved:variant:1080x1080");
  });

  it("does not share prepared child state across concurrent jobs", async () => {
    const resolve: ResolveFn<{ label: string; frames: number }> = vi.fn(({ data }: { data: { label: string; frames: number } }) => ({ duration: `${data.frames}f` as Duration }));
    const program = sequence([{ id: "clip", content: resolvingClip(resolve), data: { label: "base", frames: 1 } }]);
    const [one, two] = await Promise.all([
      prepareComposition(program, { ...options, data: { uses: { clip: { label: "one", frames: 2 } } } }),
      prepareComposition(program, { ...options, data: { uses: { clip: { label: "two", frames: 4 } } } }),
    ]);
    expect(one.plan.totalFrames).toBe(2);
    expect(two.plan.totalFrames).toBe(4);
    expect(one.program).not.toBe(two.program);
  });

  it("keeps same-named byte assets separate by occurrence and renders their distinct bytes", async () => {
    const source = image({
      size,
      assets: { logo: { bytes: new TextEncoder().encode("one"), mimeType: "text/plain" } },
      render: (ctx) => Html({ width: "fill", height: "fill", html: ctx.asset("logo") }),
    });
    const second = image({
      size,
      assets: { logo: { bytes: new TextEncoder().encode("two"), mimeType: "text/plain" } },
      render: (ctx) => Html({ width: "fill", height: "fill", html: ctx.asset("logo") }),
    });
    const authored = sequence([
      { id: "first", content: source, hold: "1f" },
      { id: "second", content: second, hold: "1f" },
    ]);
    const direct = time(authored, options);
    expect(Object.keys(direct.config?.assets ?? {})).toEqual(["first/logo", "second/logo"]);
    expect(lowerRenderOutput(direct.render(createRenderContext(0, 25, 2, size.width, size.height)))).toContain("data:text/plain;base64,b25l");
    expect(lowerRenderOutput(direct.render(createRenderContext(1, 25, 2, size.width, size.height)))).toContain("data:text/plain;base64,dHdv");
    expect(lowerRenderOutput(direct.render(createRenderContext(0, 25, 2, size.width, size.height, {}, {}, (key) => `memory://${key}`)))).toContain("memory://first/logo");

    const prepared = await prepareComposition(authored, options);

    expect(Object.keys(prepared.assetDeclarations)).toEqual(["first/logo", "second/logo"]);
    const projection = time(prepared.program, options);
    const frame = (at: number) => projection.render(createRenderContext(at, 25, 2, size.width, size.height));
    expect(lowerRenderOutput(frame(0))).toContain("data:text/plain;base64,b25l");
    expect(lowerRenderOutput(frame(1))).toContain("data:text/plain;base64,dHdv");
  });

  it("keeps HTTP(S) child assets portable and lets a host replace their qualified URLs", async () => {
    const asset = image({
      size,
      assets: { logo: { url: "https://example.test/logo.png", type: "image" } },
      render: (ctx) => Html({ width: "fill", height: "fill", html: ctx.asset("logo") }),
    });
    const program = sequence([{ id: "asset", content: asset, hold: "1f" }]);
    const portable = await prepareComposition(program, options);
    expect(lowerRenderOutput(time(portable.program, options).render(createRenderContext(0, 25, 1, size.width, size.height)))).toContain("https://example.test/logo.png");
    const resolveAsset = vi.fn(() => ({ url: "https://cdn.example.test/asset/logo.png" }));
    const prepared = await prepareComposition(program, { ...options, assets: { resolveAsset } });
    expect(resolveAsset).toHaveBeenCalledWith(expect.objectContaining({ path: "asset", name: "logo", namespace: "asset/logo" }));
    expect(lowerRenderOutput(time(prepared.program, options).render(createRenderContext(0, 25, 1, size.width, size.height)))).toContain("https://cdn.example.test/asset/logo.png");
  });

  it("rebases explicitly based child assets before the timed projection", async () => {
    const asset = image({
      size,
      assets: { logo: { url: "./assets/logo.png", type: "image" } },
      render: (ctx) => Html({ width: "fill", height: "fill", html: ctx.asset("logo") }),
    });
    const program = sequence([{ id: "asset", content: asset, hold: "1f" }]);
    await expect(prepareComposition(program, options)).rejects.toThrow(/explicit sourceBase/);
    const prepared = await prepareComposition(program, { ...options, sourceBases: { asset: "https://cdn.example.test/media/" } });
    expect(prepared.program.op).toBe("sequence");
    expect(time(prepared.program, options).config?.assets).toEqual({ "asset/logo": { url: "https://cdn.example.test/media/assets/logo.png", type: "image" } });
    const film = time(prepared.program, options);
    expect(lowerRenderOutput(film.render(createRenderContext(0, 25, 1, size.width, size.height, {}, {}, (key) => `memory://${key}`))))
      .toContain("memory://asset/logo");
  });

  it("rebases relative fonts and audio on the same explicit occurrence base", async () => {
    const source = video({
      size,
      fps: 25,
      duration: "2f",
      fonts: [{ family: "Inter", src: "./fonts/inter.woff2" }],
      audio: { id: "voice", src: "./audio/voice.mp3" },
      render: () => Html({ width: "fill", height: "fill", html: "resources" }),
    });
    const program = sequence([{ id: "clip", content: source }]);
    const prepared = await prepareComposition(program, { ...options, sourceBases: { clip: "file:///workspace/media/" } });
    const projected = time(prepared.program, options);
    expect(projected.config?.fonts).toEqual([{ family: "Inter", src: "file:///workspace/media/fonts/inter.woff2" }]);
    expect(projected.config?.audio).toMatchObject({ clips: [expect.objectContaining({ src: "file:///workspace/media/audio/voice.mp3", id: "clip/voice" })] });
  });

  it("lets an asset provider resolve a relative declaration without inventing a module directory", async () => {
    const asset = image({ size, assets: { logo: { url: "./assets/logo.png", type: "image" } }, render: () => Html({ width: "fill", height: "fill", html: "asset" }) });
    const resolveAsset = vi.fn(() => ({ url: "https://assets.example.test/resolved/logo.png" }));
    const prepared = await prepareComposition(sequence([{ id: "asset", content: asset, hold: "1f" }]), { ...options, assets: { resolveAsset } });
    expect(resolveAsset).toHaveBeenCalledWith(expect.objectContaining({ path: "asset", name: "logo", declaration: { url: "./assets/logo.png", type: "image" } }));
    expect(time(prepared.program, options).config?.assets).toEqual({ "asset/logo": { url: "https://assets.example.test/resolved/logo.png", type: "image" } });
  });
});
