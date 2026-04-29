//! Browser-safe error infrastructure.
//!
//! Public surface for enriching, formatting, and suggesting fixes for errors.
//! All exports here are safe to import from a browser bundle (no node:* deps).
//! For Node-only helpers (filesystem source reads), use `@superimg/core/errors-node`.

export { formatError, type FormattedError } from "./format.js";
export { enrichError, type EnrichContext } from "./enrich.js";
export {
  parseStackTrace,
  mapFrame,
  findUserFrame,
  type StackFrame,
  type MappedFrame,
  type FrameKind,
  type RawSourceMap,
} from "./source-map.js";
export { getCodeFrame, type CodeFrameOptions } from "./code-frame.js";
export { didYouMean, levenshtein } from "./suggest.js";
