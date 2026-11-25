//! Curated frame-evaluation support for the private browser Player packages.
//! No compiler, bundler, export, operation, or host authority code belongs here.

export {
  renderTemplateFrame,
  type RenderTemplateFrameOptions,
  type RenderTemplateFrameResult,
} from "./rendering/render-frame.js";
export {
  resolveRuntimeTemplateInfo,
  type RuntimeTemplate,
  type RuntimeTemplateInfo,
} from "./rendering/runtime-info.js";
export {
  createPreparedStdlibForTemplate,
  type PreparedStdlib,
} from "./shared/stdlib-capabilities.js";
export {
  applyTemplateResolve,
  sessionOptionsFromResolve,
} from "./rendering/resolve-template.js";
export { CheckpointResolver } from "./rendering/checkpoint-resolver.js";
export { normalizeAudioInput, resolveAudioTimeline } from "./shared/audio-resolve.js";
export { normalizeCues, type NormalizedCue } from "./rendering/normalize-cues.js";
