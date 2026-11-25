//! Edge/workerd core surface.
//! This barrel intentionally avoids the Node-bound root entrypoint.

export { renderToHtml } from "./edge.js";
export {
  createRenderContext,
  createImageRenderContext,
  createSvgRenderContext,
} from "./rendering/create-render-context.js";
export {
  resolveRuntimeTemplateInfo,
} from "./rendering/runtime-info.js";
export {
  compileTemplate,
  validateTemplate,
} from "./rendering/compiler.js";
export { CheckpointResolver } from "./rendering/checkpoint-resolver.js";
export { renderTemplateFrame } from "./rendering/render-frame.js";
export { assertNoNativeSurfaceMarkup } from "./rendering/native-markup.js";
export { compose } from "./composition/compose.js";
export { sequence } from "./composition/sequence.js";
export { choose } from "./composition/choose.js";
export { together } from "./composition/together.js";
export { time } from "./composition/time.js";
export { rebaseCompositionSources } from "./composition/rebase.js";
export type { CompositionSourceBases } from "./composition/rebase.js";
export { replaceOccurrence } from "./composition/replace.js";
export { diffCompositionSchedules } from "./composition/diff.js";
export type { CompositionScheduleDiff, ScheduleRangeChange } from "./composition/diff.js";
export { planComposition, compositionSchedule } from "./composition/plan.js";
export type { CompositionPlan, CompositionProjectionOptions, PlannedLeaf } from "./composition/plan.js";
export { prepareComposition } from "./composition/prepare.js";
export type {
  CompositionAssetProvider,
  CompositionAssetRequest,
  PreparedCompositionAsset,
  PrepareCompositionOptions,
  PreparedComposition,
} from "./composition/prepare.js";
export { parseDuration } from "./shared/utils.js";
export { normalizeAudioInput, resolveAudioTimeline } from "./shared/audio-resolve.js";
export { buildCompositeHtml } from "./html/composite.js";
export { assetMetadataFromFrozen } from "./shared/asset-metadata.js";
export {
  fonts,
  resolveFontBuffers,
  resolveRuntimeFonts,
  googleFontSpecs,
  overlayFontFaces,
} from "./rendering/fonts.js";
export { fontFaceCss, fontBytesDataUrl } from "./rendering/font-css.js";
export { aliasSvgFont, prepareBrowserFontFace, UnsupportedSvgFontAliasError } from "./rendering/svg-font-alias.js";
export { countSvgTextElements } from "./rendering/svg-text-scan.js";
export { textMeasurerFromFaces } from "./rendering/text-measurer.js";
export { textMeasurerForDeclarations } from "./rendering/text-measurer-declarations.js";
export { cancellationError, isAbortError, raceSignal } from "./rendering/abort-signal.js";
export { selectRasterizer } from "./rendering/rasterizer-registry.js";
export {
  ensureInit,
  rasterize,
  rasterizeSvgSync,
  ResvgRasterizer,
  bindEnsureInit,
} from "./rendering/resvg-rasterizer.edge.js";

export type {
  AnyTemplateModule,
  Checkpoint,
  CheckpointSource,
  ImageRenderContext,
  Medium,
  PlaybackMode,
  RenderContext,
  RenderOptions,
  SvgRenderContext,
} from "@superimg/types";
export type { NativeRenderOptions } from "./edge.js";
export type {
  RenderTemplateFrameOptions,
  RenderTemplateFrameResult,
} from "./rendering/render-frame.js";
export type {
  RasterizeSvgOptions,
  WasmSource,
} from "./rendering/resvg-rasterizer.js";
export type {
  FontRegistry,
  ResolvedFont,
  RuntimeFontResolution,
} from "./rendering/fonts.js";
export type { RasterizerRegistryOptions } from "./rendering/rasterizer-registry.js";

import { installStillLaneKit } from "./rendering/still-lane-kit.js";
import { defaultStillLaneKit } from "./rendering/still-lane-install.js";

installStillLaneKit(defaultStillLaneKit);

export { bytesDataUrl } from "./shared/base64.js";
