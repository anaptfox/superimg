import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  assertSafePackagePath,
  compileTemplate,
  ensureInit,
  rasterizeSvgSync,
  renderToHtml,
  resolveRuntimeFonts,
} from "@superimg/core";
import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import type { PlaywrightEngine } from "@superimg/node/internal";
import type {
  EncodingOptions,
  JsonObject,
  RenderJob,
  RenderLimits,
  ResolvedAssetDeclaration,
  RuntimeProfileName,
  TemplateBundle,
  TemplatePackage,
} from "@superimg/types";
import { googleFont, raceWithExecution, throwIfExecutionCancelled } from "@superimg/types";
import type { MediaPackageRenderInteractionInput } from "./contracts.js";

export type PackageRenderExecutionResult = Readonly<{
  body: Uint8Array;
  mimeType: string;
  byteLength: number;
  sha256: string;
}>;

export type PackageRenderExecutorOptions = Readonly<{
  packageDir: string;
  package: TemplatePackage;
  input: MediaPackageRenderInteractionInput;
  profile: RuntimeProfileName;
  signal?: AbortSignal;
  deadlineMs?: number;
  limits?: RenderLimits;
  engine?: PlaywrightEngine;
}>;

export type PackageRenderExecutor = (
  options: PackageRenderExecutorOptions,
) => Promise<PackageRenderExecutionResult>;

function emptySourceMap(): TemplateBundle["sourceMap"] {
  return { version: 3, sources: [], names: [], mappings: "" };
}

export function mimeTypeForRenderFormat(format: string): string {
  switch (format) {
    case "gif": return "image/gif";
    case "webm": return "video/webm";
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "jpeg": return "image/jpeg";
    case "svg": return "image/svg+xml";
    case "html": return "text/html; charset=utf-8";
    case "mp4":
    default: return "video/mp4";
  }
}

/**
 * Execute one already-admitted, content-addressed package request.
 * Authority, durable attempts, and publication remain outside this function.
 */
export async function executePackageRender(
  options: PackageRenderExecutorOptions,
): Promise<PackageRenderExecutionResult> {
  throwIfExecutionCancelled(options);
  await verifyPackageFiles(options.packageDir, options.package);
  const programPath = join(options.packageDir, options.package.program.path);
  const programCode = await raceWithExecution(readFile(programPath, "utf8"), options);
  const data = options.input.data as JsonObject;
  const format = options.input.output.format;
  const width = options.input.output.width ?? options.package.media.canvas.width;
  const height = options.input.output.height ?? options.package.media.canvas.height;
  const fps = options.input.output.fps ?? options.package.media.clock.fps;

  let body: Uint8Array;
  if (options.package.media.medium === "svg") {
    body = await renderSvgPackage({
      programCode,
      package: options.package,
      data,
      format,
      width,
      height,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.deadlineMs === undefined ? {} : { deadlineMs: options.deadlineMs }),
    });
  } else if (format === "html") {
    const html = renderToHtml({
      template: programCode,
      width,
      height,
      data,
      fps,
      durationSeconds: options.package.media.clock.durationSeconds,
    });
    body = new TextEncoder().encode(html);
  } else {
    body = await renderHtmlPackage({
      programCode,
      packageDir: options.packageDir,
      package: options.package,
      data,
      format,
      width,
      height,
      fps,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.deadlineMs === undefined ? {} : { deadlineMs: options.deadlineMs }),
      ...(options.limits === undefined ? {} : { limits: options.limits }),
      ...(options.engine === undefined ? {} : { engine: options.engine }),
    });
  }
  throwIfExecutionCancelled(options);
  return Object.freeze({
    body,
    mimeType: mimeTypeForRenderFormat(format),
    byteLength: body.byteLength,
    sha256: hashBytes(body),
  });
}

async function verifyPackageFiles(
  packageDir: string,
  pkg: TemplatePackage,
): Promise<void> {
  const files = [pkg.program, ...pkg.assets];
  for (const file of files) {
    assertSafePackagePath(file.path, "package file path");
    const absolute = join(packageDir, file.path);
    await access(absolute);
    const metadata = await stat(absolute);
    if (!metadata.isFile() || metadata.size !== file.bytes) {
      throw new Error(`Package file length mismatch: ${file.path}`);
    }
    if ((await hashFile(absolute)) !== file.sha256) {
      throw new Error(`Package file integrity check failed: ${file.path}`);
    }
  }
}

async function renderSvgPackage(input: Readonly<{
  programCode: string;
  package: TemplatePackage;
  data: JsonObject;
  format: string;
  width: number;
  height: number;
  signal?: AbortSignal;
  deadlineMs?: number;
}>): Promise<Uint8Array> {
  throwIfExecutionCancelled(input);
  const compiled = compileTemplate(input.programCode);
  if (compiled.error || !compiled.media) {
    throw compiled.error ?? new Error("Template compilation failed");
  }
  const svg = renderToHtml({
    template: compiled.media,
    width: input.width,
    height: input.height,
    data: input.data,
    composite: false,
  });
  if (input.format === "svg") return new TextEncoder().encode(svg);

  const resolvedFonts = await raceWithExecution(
    resolveRuntimeFonts(
      (input.package.media.renderConfig.fonts ?? []).map((spec) => googleFont(spec)),
      { ...(input.signal === undefined ? {} : { signal: input.signal }) },
    ),
    input,
  );
  if (resolvedFonts.errors.length > 0) {
    throw new Error(resolvedFonts.errors.map((error) => error.message).join("\n"));
  }
  const fontBuffers = resolvedFonts.faces.map((face) => face.data);
  await raceWithExecution(ensureInit(), input);
  const png = rasterizeSvgSync(svg, {
    width: input.width,
    height: input.height,
    fontBuffers,
  });
  if (input.format !== "webp" && input.format !== "jpeg") return png;
  const { SharpStillEncoder } = await import("@superimg/node/internal");
  const encoder = new SharpStillEncoder(input.format);
  try {
    await raceWithExecution(
      encoder.init({
        width: input.width,
        height: input.height,
        fps: 1,
      }),
      input,
    );
    await raceWithExecution(encoder.addFrame(Buffer.from(png)), input);
    return await raceWithExecution(encoder.finalize(), input);
  } finally {
    await encoder.dispose();
  }
}

async function renderHtmlPackage(input: Readonly<{
  programCode: string;
  packageDir: string;
  package: TemplatePackage;
  data: JsonObject;
  format: string;
  width: number;
  height: number;
  fps: number;
  signal?: AbortSignal;
  deadlineMs?: number;
  limits?: RenderLimits;
  engine?: PlaywrightEngine;
}>): Promise<Uint8Array> {
  const bundle: TemplateBundle = {
    code: input.programCode,
    sourceMap: emptySourceMap(),
    sourceFile: input.package.program.path,
  };
  const encoding: EncodingOptions = {
    format: input.format as NonNullable<EncodingOptions["format"]>,
  };
  const duration = Math.max(
    input.package.media.clock.durationSeconds,
    1 / input.fps,
  );
  const job: RenderJob = {
    templateBundle: bundle,
    duration,
    width: input.width,
    height: input.height,
    fps: input.fps,
    fonts: (input.package.media.renderConfig.fonts ?? []).map((spec) => googleFont(spec)),
    inlineCss: input.package.media.renderConfig.inlineCss ?? [],
    stylesheets: input.package.media.renderConfig.stylesheets ?? [],
    coordinates: input.package.media.identity,
    encoding,
    data: input.data,
  };
  const assetById = new Map(
    input.package.assets.map((asset) => [asset.id, join(input.packageDir, asset.path)]),
  );
  const resolvedAssets: ResolvedAssetDeclaration[] = input.package.assets
    .filter((asset) => asset.kind === "image" || asset.kind === "video" || asset.kind === "audio")
    .map((asset) => ({
      key: asset.id,
      type: asset.kind as "image" | "video" | "audio",
      src: join(input.packageDir, asset.path),
      sourceDir: dirname(join(input.packageDir, asset.path)),
    }));

  const ownsEngine = input.engine === undefined;
  const engine = input.engine ?? new (await import("@superimg/node/internal")).PlaywrightEngine();
  try {
    if (ownsEngine) await raceWithExecution(engine.init(), input);
    const plan = await createRenderPlan(job, {
      assetResolver(name) {
        const absolute = assetById.get(name);
        if (!absolute) throw new Error(`Unknown packaged asset: ${name}`);
        return engine.registerAsset(absolute);
      },
      resolvedAssets,
      explicitOverrides: {
        width: input.width,
        height: input.height,
        fps: input.fps,
      },
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      ...(input.deadlineMs === undefined ? {} : { deadlineMs: input.deadlineMs }),
      ...(input.limits === undefined ? {} : { limits: input.limits }),
      ...(input.format === "png" || input.format === "webp" || input.format === "jpeg"
        ? { startFrame: 0, endFrame: 1 }
        : {}),
    });
    const { renderer, encoder } = engine.createAdapters({ encoding });
    return await executeRenderPlan(plan, renderer, encoder, {
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      ...(input.deadlineMs === undefined ? {} : { deadlineMs: input.deadlineMs }),
    });
  } finally {
    if (ownsEngine) await engine.dispose();
  }
}

function hashBytes(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
