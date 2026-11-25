//! Pre-render IR hash check for cache skip decisions.

import { basename } from "node:path";
import { normalizeSourceId } from "@superimg/core";
import { evaluateTemplateIR } from "./ir-eval.js";
import {
  RenderIRCache,
  cacheEntryKey,
  computeRenderKey,
} from "./render-cache.js";

export interface IrPrecheckHit {
  skip: true;
  reason: "ir-cache-hit";
  key: string;
  hashes: { intentHash: string; markupHash: string; programHash: string };
  outputPaths: string[];
}

export interface IrPrecheckMiss {
  skip: false;
  reason?: string;
  key: string;
  hashes?: { intentHash: string; markupHash: string; programHash: string };
  renderKey: string;
  /** Call after successful render to record. */
  record?: (outputPaths: string[]) => void;
}

export type IrPrecheckResult = IrPrecheckHit | IrPrecheckMiss;

export async function precheckRenderCache(options: {
  templatePath: string;
  outDir: string;
  cliVersion: string;
  format?: string;
  encoding?: Record<string, unknown>;
  data?: Record<string, unknown>;
  force?: boolean;
  noCache?: boolean;
  cacheVerify?: boolean;
}): Promise<IrPrecheckResult> {
  const sourceId = normalizeSourceId(basename(options.templatePath));
  const key = cacheEntryKey(sourceId);
  const renderKey = computeRenderKey({
    ...(options.format !== undefined ? { format: options.format } : {}),
    ...(options.encoding !== undefined ? { encoding: options.encoding } : {}),
  });

  if (options.noCache || options.force) {
    // Still evaluate for record-after-render unless noCache
    if (options.noCache) {
      return { skip: false, reason: "no-cache", key, renderKey };
    }
  }

  let evalResult;
  try {
    evalResult = await evaluateTemplateIR(options.templatePath, {
      ...(options.data !== undefined ? { data: options.data } : {}),
      verify: options.cacheVerify === true,
      sourceId: sourceId,
    });
  } catch (err) {
    return {
      skip: false,
      reason: err instanceof Error ? err.message : "ir-eval-failed",
      key,
      renderKey,
    };
  }

  if (evalResult.mode !== "ir" || !evalResult.ir) {
    return {
      skip: false,
      reason: evalResult.fallbackReason ?? "runtime-fallback",
      key,
      renderKey,
    };
  }

  const hashes = {
    intentHash: evalResult.ir.hashes.intentHash,
    markupHash: evalResult.ir.hashes.markupHash,
    programHash: evalResult.ir.hashes.programHash,
  };

  const cache = new RenderIRCache(options.outDir, options.cliVersion);

  if (!options.force && !options.noCache && cache.isFresh(key, hashes, renderKey)) {
    const entry = cache.lookup(key)!;
    return {
      skip: true,
      reason: "ir-cache-hit",
      key,
      hashes,
      outputPaths: entry.outputPaths,
    };
  }

  const record = options.noCache
    ? undefined
    : (outputPaths: string[]) => {
        cache.record(key, hashes, renderKey, outputPaths);
        cache.save();
      };
  return {
    skip: false,
    key,
    hashes,
    renderKey,
    ...(record !== undefined ? { record } : {}),
  };
}
