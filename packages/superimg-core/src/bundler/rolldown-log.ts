//! Shared Rolldown log filtering for server and browser bundlers.

type LogLevel = "info" | "warn" | "debug";
type LogLevelOption = LogLevel | "silent";
type RolldownLog = { code?: string; message: string; exporter?: string; id?: string; loc?: { file?: string; line: number; column: number } };

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
 * `tsconfig: false` is required: Rolldown 1.1.x reads host-project tsconfig
 * aliases by default. Media programs are bundled against SuperImg's canonical
 * public modules, independent of an embedding application's path mappings.
 */
export function templateBundlerInputOptions(resolve: {
  alias: Record<string, string>;
}): {
  tsconfig: false;
  resolve: { alias: Record<string, string> };
  logLevel: LogLevelOption;
  onLog: typeof bundlerOnLog;
  /** Missing named imports fail the build. Rolldown 1.2 defaults this to false. */
  shimMissingExports: false;
} {
  return {
    tsconfig: false,
    resolve,
    shimMissingExports: false,
    ...bundlerInputLogOptions(),
  };
}

/** Compiler behavior is part of identities consumed by downstream caches. */
export const TEMPLATE_COMPILER_BEHAVIOR = 3;

/** Track only unresolved imports that survive tree shaking into an output. */
export function unresolvedImports(inScope: (file: string) => boolean, options: { relativeFile?: (file: string) => string; onSkipped?: (specifier: string, file: string) => void } = {}) {
  const warnings = new Map<string, RolldownLog>();
  return {
    observe(log: RolldownLog) {
      const file = log.loc?.file ?? log.id;
      if (log.code !== "UNRESOLVED_IMPORT" || !log.exporter || !file) return;
      if (log.exporter.startsWith("node:") || !inScope(file)) {
        options.onSkipped?.(log.exporter, file);
        if (VERBOSE) console.debug("[superimg-bundler] unresolved import skipped", { specifier: log.exporter, file });
        return;
      }
      warnings.set(log.exporter, log);
    },
    isGuessedGlobal(log: RolldownLog) {
      return log.code === "MISSING_GLOBAL_NAME" && !!log.id && warnings.has(log.id);
    },
    assertResolved(output: readonly { type: string; imports?: readonly string[]; dynamicImports?: readonly string[] }[]) {
      const imports = new Set(output.flatMap(chunk => [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]));
      for (const [specifier, log] of warnings) {
        if (!imports.has(specifier)) continue;
        const file = log.loc?.file ?? log.id ?? "<unknown>";
        const error = new Error(`Unresolved import ${JSON.stringify(specifier)} in ${file}`);
        const relativeFile = options.relativeFile?.(file) ?? file;
        const help = `${JSON.stringify(specifier)} could not be resolved from ${relativeFile}. Install it in this project (for example, pnpm add ${specifier}), fix the import path, or use "import type" if you only need types. Superimg no longer treats unresolved imports as runtime globals.`;
        Object.assign(error, { code: "UNRESOLVED_IMPORT", loc: log.loc ?? { file }, help });
        throw error;
      }
    },
  };
}
