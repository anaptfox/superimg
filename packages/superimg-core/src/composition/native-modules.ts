//! Share one prepared closure across repeated composition occurrences.
import type { PreparedNativeModuleSet } from "@superimg/types";
import { hashTemplateOutputs } from "../ir/pure/serialize.js";

export function uniqueNativeModuleSets(sets: readonly PreparedNativeModuleSet[]): PreparedNativeModuleSet[] {
  const seen = new Set<string>();
  const checked = new WeakSet<PreparedNativeModuleSet>();
  const result: PreparedNativeModuleSet[] = [];
  for (const set of sets) {
    if (!checked.has(set)) {
      if (!/^[a-f0-9]{64}$/.test(set.identity) || hashTemplateOutputs(set.outputs) !== set.identity) {
        throw new TypeError("Native module identity does not match its files");
      }
      checked.add(set);
    }
    if (!seen.has(set.identity)) { seen.add(set.identity); result.push(set); }
  }
  return result;
}
