//! Shared Rolldown log filtering for server and browser bundlers.

type LogLevel = "info" | "warn" | "debug" | "error";
type LogLevelOption = LogLevel | "silent";
type RolldownLog = { code?: string; message?: string };

const VERBOSE =
  typeof process !== "undefined" &&
  process.env?.SUPERIMG_BUNDLER_VERBOSE === "1";

/** Warnings that are expected for virtual stdlib / template entry plugins. */
const SILENCED_WARNING_CODES = new Set([
  "CIRCULAR_DEPENDENCY",
  "EMPTY_BUNDLE",
  "FILE_NAME_CONFLICT",
  "INPUT_SOURCEMAP_IGNORED",
  "PLUGIN_WARNING",
  "UNRESOLVED_IMPORT",
  "UNUSED_EXTERNAL_IMPORT",
]);

export function bundlerLogLevel(): LogLevelOption {
  return VERBOSE ? "info" : "warn";
}

export function bundlerOnLog(
  level: LogLevel,
  log: RolldownLog,
  defaultHandler: (level: LogLevel, log: RolldownLog) => void,
): void {
  if (!VERBOSE && level === "warn" && log.code && SILENCED_WARNING_CODES.has(log.code)) {
    return;
  }
  defaultHandler(level, log);
}

export function bundlerInputLogOptions(): {
  logLevel: LogLevelOption;
  onLog: typeof bundlerOnLog;
} {
  return {
    logLevel: bundlerLogLevel(),
    onLog: bundlerOnLog,
  };
}

/**
 * Shared rolldown input options for scene-template IIFE bundles.
 *
 * `tsconfig: false` is required: Rolldown 1.1.x reads tsconfig `paths` by default,
 * and Gumbo apps map bare `gumbo/media` → `.gumbo/generated/gumbo_media.tsx` (React registry
 * with dynamic `import()` loaders). Scene templates must import `gumbo/media/define` instead.
 * Subprocess aliases only `gumbo/media/define` → `superimg/define` (with `tsconfig: false`).
 */
export function templateBundlerInputOptions(resolve: {
  alias: Record<string, string>;
}): {
  tsconfig: false;
  resolve: { alias: Record<string, string> };
  logLevel: LogLevelOption;
  onLog: typeof bundlerOnLog;
} {
  return {
    tsconfig: false,
    resolve,
    ...bundlerInputLogOptions(),
  };
}