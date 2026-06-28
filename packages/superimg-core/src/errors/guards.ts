//! Structural type guards for error enrichment heuristics.

interface RollupLocation {
  file?: string;
  line?: number;
  column?: number;
}

export interface RollupError extends Error {
  loc?: RollupLocation;
  frame?: string;
  id?: string;
}

export function hasRollupMetadata(err: Error): err is RollupError {
  const candidate = err as RollupError;
  return candidate.loc !== undefined || candidate.frame !== undefined || candidate.id !== undefined;
}

export function isNodeSystemError(err: Error): err is NodeJS.ErrnoException {
  return typeof (err as NodeJS.ErrnoException).code === "string";
}

export function isModuleNotFoundError(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error &&
    isNodeSystemError(err) &&
    err.code === "ERR_MODULE_NOT_FOUND"
  );
}