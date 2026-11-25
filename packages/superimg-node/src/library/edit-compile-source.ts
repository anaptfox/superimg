//! First-party Node host compiler for exact edits and immutable executable previews.
import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { bundleMediaProgram, bundleTemplateCodeWithMap } from "@superimg/core/bundler";
import { compileTemplate, normalizeSourceId, resolveMediaIR } from "@superimg/core";
import { resolveMediaSource } from "./project.js";
import type { CompileEditableSourceArgs, NodeEditableCompilation } from "./edit-node-engine.js";
export async function compileNodeEditableSource(
  projectRoot: string,
  args: CompileEditableSourceArgs<unknown>,
): Promise<NodeEditableCompilation> {
  const resolved = resolveMediaSource(projectRoot, args.source);
  const relativePath = resolved.relativePath;
  const disk = await readFile(resolved.templatePath, "utf8");
  const overridden = args.overrides?.[relativePath];
  const sourceText = overridden ?? disk;
  const bundle = overridden === undefined
    ? await bundleMediaProgram(resolved.templatePath)
    : await bundleTemplateCodeWithMap(sourceText, {
        resolveDir: dirname(resolved.templatePath),
        sourcefile: basename(resolved.templatePath),
      });
  const compiled = compileTemplate(bundle);
  if (compiled.error) throw compiled.error;
  if (!compiled.media) {
    throw new Error(`Edit requires a deterministic media source: ${relativePath}`);
  }
  const sourceId = normalizeSourceId(resolved.sourceId);
  const { ir } = await resolveMediaIR(compiled.media, { sourceId });
  const frames = args.captureNodeSemantics ? [...new Set([0, Math.floor((ir.clock.totalFrames - 1) / 2), ir.clock.totalFrames - 1, ...(args.semanticFrames ?? [])])].filter(frame => Number.isSafeInteger(frame) && frame >= 0 && frame < ir.clock.totalFrames).sort((a, b) => a - b) : [];
  const semantic = frames.length ? await resolveMediaIR(compiled.media, { sourceId, captureFrames: frames }) : undefined;
  if (semantic && (semantic.ir.hashes.intentHash !== ir.hashes.intentHash || semantic.ir.hashes.markupHash !== ir.hashes.markupHash)) {
    throw new Error("Edit semantic captures do not match the compiled media revision");
  }
  const captures = semantic?.captures;
  const sceneId = ir.scenes.length === 1 ? ir.scenes[0]?.id : undefined;
  return Object.freeze({
    sourceId,
    coordinates: Object.freeze({
      sourceId: ir.identity.sourceId,
      variantId: ir.identity.variantId,
      editionId: ir.identity.editionId,
      ...(ir.identity.entryId === undefined ? {} : { entryId: ir.identity.entryId }),
    }),
    media: ir,
    ...(args.captureNodeSemantics ? { semanticCaptures: frames.map((frame) => ({ frame, ...(captures?.get(frame)?.tree ? { tree: captures.get(frame)!.tree! } : {}) })) } : {}),
    programCode: bundle.code,
    programBundle: bundle,
    files: Object.freeze([
      Object.freeze({
        absolutePath: resolved.templatePath,
        relativePath,
        source: sourceText,
        ...(sceneId === undefined ? {} : { sceneId }),
      }),
    ]),
  });
}
