//! Render semantic diff verification frames into one deterministic PNG sheet.

import {
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  readMediaArtifact,
  templateFromArtifact,
} from "@superimg/core/ir-node";
import type { MediaIR } from "@superimg/types";
import { createPreparedStdlibForTemplate, googleFontSpecs } from "@superimg/core";
import { buildCompositeHtml } from "@superimg/core/edge";
import { renderTemplateFrame } from "@superimg/core/testing";
import { PlaywrightEngine } from "@superimg/node/internal";
import type {
  BackgroundValue,
  Rasterizer,
  TemplateModule,
  WatermarkValue,
} from "@superimg/types";
import { evaluateTemplateIR } from "./ir-eval.js";
import { inspectIRAssets } from "./ir-assets.js";
import { resolveTemplatePath } from "./resolve-template.js";

export interface RenderDiffContactSheetOptions {
  targetPath: string;
  frames: number[];
  media: MediaIR;
  data?: Record<string, unknown>;
}

interface RenderableSide {
  template: TemplateModule;
  data: Record<string, unknown>;
  htmlByFrame?: Map<number, string>;
  aliases: Record<string, string>;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  fonts: string[];
  inlineCss: string[];
  stylesheets: string[];
  tailwind: NonNullable<TemplateModule["config"]>["tailwind"];
  mode: "frame" | "animation";
  readiness: NonNullable<TemplateModule["config"]>["readiness"];
  background?: BackgroundValue;
  watermark?: WatermarkValue;
}

function isArtifact(path: string): boolean {
  return (
    existsSync(path) &&
    statSync(path).isDirectory() &&
    existsSync(join(path, "artifact.json"))
  );
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function rewriteAliases(value: string, aliases: Record<string, string>): string {
  let out = value;
  for (const alias of Object.keys(aliases).sort((a, b) => b.length - a.length)) {
    out = out.split(alias).join(aliases[alias]!);
  }
  return out;
}

function rewriteBackground(
  value: BackgroundValue | undefined,
  aliases: Record<string, string>,
): BackgroundValue | undefined {
  if (typeof value === "string") {
    return rewriteAliases(value, aliases);
  }
  if (!value) return undefined;
  return { ...value, src: rewriteAliases(value.src, aliases) };
}

function rewriteWatermark(
  value: WatermarkValue | undefined,
  aliases: Record<string, string>,
): WatermarkValue | undefined {
  if (typeof value === "string") {
    return rewriteAliases(value, aliases);
  }
  if (!value || value.type !== "image") return value;
  return { ...value, content: rewriteAliases(value.content, aliases) };
}

async function loadRenderableSide(
  targetPath: string,
  frames: number[],
  engine: PlaywrightEngine,
  data?: Record<string, unknown>,
): Promise<RenderableSide> {
  if (isArtifact(targetPath)) {
    const artifact = await readMediaArtifact(targetPath);
    const template = templateFromArtifact(artifact);
    const config = template.config ?? {};
    const aliases: Record<string, string> = {};
    for (const [alias, rel] of Object.entries(artifact.job.assetMap)) {
      aliases[alias] = engine.registerAsset(join(artifact.path, rel));
    }
    for (const asset of artifact.job.resolvedAssets) {
      aliases[asset.key] = /^(?:https?:|data:)/i.test(asset.src)
        ? asset.src
        : engine.registerAsset(join(artifact.path, asset.src));
    }
    return {
      template,
      data: artifact.job.data,
      aliases,
      width: artifact.job.width,
      height: artifact.job.height,
      fps: artifact.job.fps,
      durationSeconds: artifact.job.durationSeconds,
      fonts: googleFontSpecs(config.fonts),
      inlineCss: config.inlineCss ?? [],
      stylesheets: config.stylesheets ?? [],
      tailwind: config.tailwind,
      mode: config.mode ?? "frame",
      readiness: config.readiness,
      ...(config.background !== undefined
        ? { background: config.background }
        : {}),
      ...(config.watermark !== undefined
        ? { watermark: config.watermark }
        : {}),
    };
  }

  if (!/\.(?:media\.)?[cm]?[jt]s$/i.test(targetPath)) {
    throw new Error(
      "--render-changes needs a renderable after target (template or .superimg artifact), not media.json alone",
    );
  }

  const resolvedPath = resolveTemplatePath(targetPath);
  const evaluated = await evaluateTemplateIR(resolvedPath, {
    ...(data ? { data } : {}),
    captureFrames: frames,
  });
  const inspected = inspectIRAssets(resolvedPath, evaluated.template);
  const aliases: Record<string, string> = {};
  for (const local of Object.values(inspected.localAssets)) {
    const url = engine.registerAsset(local.path);
    for (const alias of local.aliases) aliases[alias] = url;
  }
  for (const asset of inspected.additionalAssets) {
    if (
      (asset.remote || asset.src.startsWith("data:")) &&
      asset.id.startsWith("asset:")
    ) {
      aliases[asset.id.slice("asset:".length)] = asset.src;
    }
  }
  const htmlByFrame = new Map<number, string>();
  for (const [frame, capture] of evaluated.captures ?? []) {
    htmlByFrame.set(frame, capture.html);
  }
  const config = evaluated.template.config ?? {};
  return {
    template: evaluated.template,
    data: evaluated.resolvedData,
    htmlByFrame,
    aliases,
    width: evaluated.config.width,
    height: evaluated.config.height,
    fps: evaluated.config.fps,
    durationSeconds: evaluated.config.duration,
    fonts: googleFontSpecs(config.fonts),
    inlineCss: config.inlineCss ?? [],
    stylesheets: config.stylesheets ?? [],
    tailwind: config.tailwind ?? false,
    mode: config.mode ?? "frame",
    readiness: config.readiness,
    ...(config.background !== undefined
      ? { background: config.background }
      : {}),
    ...(config.watermark !== undefined
      ? { watermark: config.watermark }
      : {}),
  };
}

async function renderFrames(
  side: RenderableSide,
  frames: number[],
  engine: PlaywrightEngine,
): Promise<Buffer[]> {
  const { renderer } = engine.createAdapters({ encoding: { format: "png" } });
  const inlineCss = side.inlineCss.map((css) =>
    rewriteAliases(css, side.aliases),
  );
  const stylesheets = side.stylesheets.map((src) =>
    rewriteAliases(src, side.aliases),
  );
  await renderer.init({
    width: side.width,
    height: side.height,
    fps: side.fps,
    ...(side.template.config?.nativeModuleSets === undefined ? {} : { nativeModuleSets: side.template.config.nativeModuleSets }),
    fonts: side.fonts,
    inlineCss,
    stylesheets,
    ...(side.tailwind !== undefined
      ? {
          tailwind:
            side.tailwind as NonNullable<
              Parameters<Rasterizer<Buffer>["init"]>[0]["tailwind"]
            >,
        }
      : {}),
    mode: side.mode,
    ...(side.readiness !== undefined
      ? {
          readiness: side.readiness as Parameters<
            Rasterizer<Buffer>["init"]
          >[0]["readiness"] & {},
        }
      : {}),
  });

  const images: Buffer[] = [];
  const needsRender = frames.some((frame) => side.htmlByFrame?.get(frame) === undefined);
  const preparedStdlib = needsRender
    ? await createPreparedStdlibForTemplate(side.template)
    : undefined;
  try {
    for (const frame of frames) {
      let html = side.htmlByFrame?.get(frame);
      if (html === undefined) {
        html = renderTemplateFrame({
          template: side.template,
          frame,
          fps: side.fps,
          durationSeconds: side.durationSeconds,
          width: side.width,
          height: side.height,
          data: side.data,
          composite: false,
          assetResolver: (src) => rewriteAliases(src, side.aliases),
          ...(preparedStdlib !== undefined ? { preparedStdlib } : {}),
        }).html;
      }
      html = rewriteAliases(html, side.aliases);
      const composite = buildCompositeHtml(
        html,
        rewriteBackground(side.background, side.aliases),
        rewriteWatermark(side.watermark, side.aliases),
        side.width,
        side.height,
      );
      images.push(await renderer.rasterize(composite, { time: frame / side.fps }));
    }
  } finally {
    await renderer.dispose();
  }
  return images;
}

export async function renderDiffContactSheet(
  options: RenderDiffContactSheetOptions,
): Promise<string> {
  const lastFrame = Math.max(0, options.media.clock.totalFrames - 1);
  const frames = [
    ...new Set(
      options.frames
        .filter((frame) => Number.isInteger(frame) && frame >= 0)
        .map((frame) => Math.min(frame, lastFrame)),
    ),
  ]
    .sort((a, b) => a - b);
  if (frames.length === 0) {
    throw new Error("--render-changes found no affected verification frames");
  }

  const engine = new PlaywrightEngine();
  await engine.init();
  try {
    const side = await loadRenderableSide(
      options.targetPath,
      frames,
      engine,
      options.data,
    );
    const images = await renderFrames(side, frames, engine);
    const sharp = (await import("sharp")).default;
    const thumbWidth = Math.min(480, side.width);
    const thumbHeight = Math.max(
      1,
      Math.round((side.height / side.width) * thumbWidth),
    );
    const labelHeight = 34;
    const gap = 16;
    const padding = 20;
    const columns = Math.min(3, images.length);
    const rows = Math.ceil(images.length / columns);
    const sheetWidth =
      padding * 2 + columns * thumbWidth + (columns - 1) * gap;
    const sheetHeight =
      padding * 2 + rows * (thumbHeight + labelHeight) + (rows - 1) * gap;
    const inputs: Array<{ input: Buffer; left: number; top: number }> = [];

    for (let index = 0; index < images.length; index++) {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const left = padding + col * (thumbWidth + gap);
      const top = padding + row * (thumbHeight + labelHeight + gap);
      const thumbnail = await sharp(images[index]!)
        .resize(thumbWidth, thumbHeight, {
          fit: "contain",
          background: "#111318",
        })
        .png()
        .toBuffer();
      inputs.push({ input: thumbnail, left, top });
      const seconds = frames[index]! / side.fps;
      const label = `frame ${frames[index]}  ·  ${seconds.toFixed(2)}s`;
      inputs.push({
        input: Buffer.from(
          `<svg width="${thumbWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><text x="0" y="23" fill="#d7dce5" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15">${escapeXml(label)}</text></svg>`,
        ),
        left,
        top: top + thumbHeight,
      });
    }

    const outputPath = resolve(
      process.cwd(),
      "output",
      `${safeName(options.media.identity.sourceId || basename(options.targetPath))}-diff-${options.media.hashes.intentHash.slice(0, 10)}.png`,
    );
    mkdirSync(dirname(outputPath), { recursive: true });
    const sheet = await sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 4,
        background: "#090b10",
      },
    })
      .composite(inputs)
      .png()
      .toBuffer();
    writeFileSync(outputPath, sheet);
    return outputPath;
  } finally {
    await engine.dispose();
  }
}
