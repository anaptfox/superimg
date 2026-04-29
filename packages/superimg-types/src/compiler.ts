//! Compiler type definitions

import type { TemplateModule } from "./types.js";
import type { SuperImgError } from "./results.js";

/**
 * Legacy plain-object error shape. Retained as a structural alias so callers
 * that read `.message` from a CompileResult.error continue to work — but new
 * code should treat the field as `SuperImgError`.
 */
export interface CompileError {
  message: string;
  line?: number;
  column?: number;
}

export interface CompileResult {
  template?: TemplateModule;
  /** Typed error from the compiler. SuperImgError instances carry recovery
   *  suggestions, source locations, and code frames. */
  error?: SuperImgError;
}
