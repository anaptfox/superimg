//! SuperImg React compile hooks — browser template compilation only.
//! Import from "superimg/react/compile" when you need useCompiledTemplate / useCompiler
//! without pulling the full Player + mediabunny barrel from "superimg/react".
"use client";

export {
  useCompiler,
  useCompiledTemplate,
  clearTemplateCache,
  getTemplateCacheSize,
  checkBrowserCompileSupport,
  type UseCompilerReturn,
  type UseCompiledTemplateOptions,
  type UseCompiledTemplateReturn,
  type BrowserCompileSupport,
} from "./hooks/index.js";

export type {
  RenderContext,
  TemplateModule,
  TemplateConfig,
  CompileError,
  CompileResult,
  ComposedTemplate,
  ResolvedScene,
} from "../index.browser.js";

export { isComposedTemplate } from "../index.browser.js";