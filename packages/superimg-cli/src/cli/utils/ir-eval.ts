import { dirname } from "node:path";
import { loadNodeMediaValue } from "@foxworth/superimg-node/source";
import { evaluatePreparedSourceIR, type EvaluateTemplateIROptions } from "@foxworth/superimg-node/source/advanced";
import { loadCliMediaValue, type LoadedCliMediaValue } from "./runtime-source.js";
import type { CollectionCommandSnapshot } from "./collection-selection.js";
export type { IrEvalConfig, IrEvalResult } from "@foxworth/superimg-node/source/advanced";
export type CliEvaluateTemplateIROptions = Omit<EvaluateTemplateIROptions, "loaded"> & { loaded?: LoadedCliMediaValue; collectionSnapshot?: CollectionCommandSnapshot };
export async function evaluateTemplateIR(path: string, options: CliEvaluateTemplateIROptions = {}) {
  if (options.collectionSnapshot && !options.loaded) throw new Error("IR evaluation requires an explicitly loaded frozen collection snapshot");
  let loaded = options.loaded;
  if (!loaded) {
    try { loaded = await loadCliMediaValue(path, { ...(options.signal ? { signal: options.signal } : {}) }); }
    catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("No package.json found.")) throw error;
      loaded = await loadNodeMediaValue(dirname(path), path, { ...(options.signal ? { signal: options.signal } : {}) });
    }
  }
  return evaluatePreparedSourceIR({ ...options, loaded });
}
