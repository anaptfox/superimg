//! SuperImg React authoring-shell compile hooks (playground / docs).
//! Not a host compiler API. Hosts compile `*.media.ts` with their own
//! Rolldown/OXC and pass values into player/runtime.
"use client";

export {
  Player as CompilingPlayer,
  type PlayerProps as CompilingPlayerProps,
  type PlayerRef as CompilingPlayerRef,
} from "./components/Player.js";
export { useCompiler, type UseCompilerReturn } from "./hooks/useCompiler.js";
export {
  useCompiledMedia,
  clearMediaCache,
  getMediaCacheSize,
  type UseCompiledMediaOptions,
  type UseCompiledMediaReturn,
} from "./hooks/useCompiledMedia.js";
export {
  checkBrowserCompileSupport,
  type BrowserCompileSupport,
} from "./hooks/checkBrowserCompileSupport.js";

export type {
  RenderContext,
  MediaDefinition,
  TemplateConfig,
  CompileError,
  CompileResult,
} from "@superimg/types";
