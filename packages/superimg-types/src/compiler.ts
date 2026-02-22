//! Compiler type definitions

import type { TemplateModule } from "./types.js";

export interface CompileError {
  message: string;
  line?: number;
  column?: number;
}

export interface CompileResult {
  template?: TemplateModule;
  error?: CompileError;
}
