//! Compiler type definitions

import type { MediaDefinition } from "./define.js";
import type { SuperImgError } from "./results.js";
import type { JsonObject } from "./json.js";

/**
 * Structural runtime view used only to classify the interactive package's
 * browser bundle. The interactive package owns the guide, scene, and render
 * context contracts; neutral compiler types intentionally do not interpret
 * them.
 */
interface OpaqueInteractiveDeclaration {
  readonly kind: "interactive";
  readonly guide: unknown;
  /** Authored canvas when the template set `size` on defineInteractive. */
  readonly size?: { readonly width: number; readonly height: number };
  readonly sample?: unknown;
  readonly render: (...args: never[]) => unknown;
}

/** Minimal validation error returned by validateTemplate(). */
export interface CompileError {
  message: string;
  code?: string;
  details?: JsonObject;
  line?: number;
  column?: number;
}

export interface CompileResult {
  media?: MediaDefinition;
  interactive?: OpaqueInteractiveDeclaration;
  /** Typed error from the compiler. SuperImgError instances carry recovery
   *  suggestions, source locations, and code frames. */
  error?: SuperImgError;
}
