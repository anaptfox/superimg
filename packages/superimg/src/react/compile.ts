//! SuperImg React compile hooks — browser template compilation only.
//! Import from "superimg/react/compile" when you need useCompiledTemplate / useCompiler
//! without pulling the full Player + mediabunny barrel from "superimg/react".
"use client";

export { useCompiler, type UseCompilerReturn } from "./hooks/useCompiler.js";
export {
  useCompiledTemplate,
  clearTemplateCache,
  getTemplateCacheSize,
  type UseCompiledTemplateOptions,
  type UseCompiledTemplateReturn,
} from "./hooks/useCompiledTemplate.js";
export {
  checkBrowserCompileSupport,
  type BrowserCompileSupport,
} from "./hooks/checkBrowserCompileSupport.js";

export type {
  RenderContext,
  TemplateModule,
  TemplateConfig,
  CompileError,
  CompileResult,
  ComposedTemplate,
  ResolvedScene,
} from "@superimg/types";

export { isComposedTemplate } from "@superimg/types";