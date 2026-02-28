//! React hook for compiled templates with caching and debouncing
//! Provides zero-config compilation from code strings to TemplateModule

import { useState, useEffect, useRef, useCallback } from "react";
import {
  compileTemplate,
  type TemplateModule,
  type CompileError,
} from "superimg/browser";
import { initBundler, bundleTemplateBrowser } from "superimg/bundler";

// =============================================================================
// GLOBAL LRU CACHE
// =============================================================================

const MAX_CACHE_SIZE = 50;
const templateCache = new Map<string, TemplateModule>();

function getCached(key: string): TemplateModule | undefined {
  const template = templateCache.get(key);
  if (template) {
    // Move to end (most recently used)
    templateCache.delete(key);
    templateCache.set(key, template);
  }
  return template;
}

function setCache(key: string, template: TemplateModule): void {
  // Evict oldest if at capacity
  if (templateCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = templateCache.keys().next().value;
    if (oldestKey) templateCache.delete(oldestKey);
  }
  templateCache.set(key, template);
}

/** Clear the global template cache */
export function clearTemplateCache(): void {
  templateCache.clear();
}

/** Get the current cache size */
export function getTemplateCacheSize(): number {
  return templateCache.size;
}

// =============================================================================
// HASH FUNCTION (simple djb2 for cache keys)
// =============================================================================

function hashCode(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// =============================================================================
// HOOK TYPES
// =============================================================================

export interface UseCompiledTemplateOptions {
  /** The code string to compile */
  code: string;
  /** Whether to use the global cache (default: true) */
  cache?: boolean;
  /** Custom cache key (default: hash of code) */
  cacheKey?: string;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Custom WASM URL for esbuild */
  wasmURL?: string;
  /** Whether compilation is enabled (default: true) */
  enabled?: boolean;
}

export interface UseCompiledTemplateReturn {
  /** The compiled template (null if not compiled or has errors) */
  template: TemplateModule | null;
  /** Whether compilation is in progress */
  compiling: boolean;
  /** Compilation error (null if successful) */
  error: CompileError | null;
  /** Manually trigger recompilation */
  recompile: () => Promise<void>;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook for compiling code strings into templates with caching and debouncing.
 *
 * Features:
 * - Global LRU cache (max 50 templates)
 * - Built-in debouncing (default 300ms)
 * - Automatic bundler WASM initialization
 * - Abort support for rapid code changes
 *
 * @example
 * ```tsx
 * // Simple usage
 * const { template, compiling, error } = useCompiledTemplate({ code });
 *
 * // With custom options
 * const { template, compiling, error } = useCompiledTemplate({
 *   code,
 *   debounceMs: 150,
 *   cache: true,
 * });
 * ```
 */
export function useCompiledTemplate(
  options: UseCompiledTemplateOptions
): UseCompiledTemplateReturn {
  const {
    code,
    cache = true,
    cacheKey,
    debounceMs = 300,
    wasmURL,
    enabled = true,
  } = options;

  const [template, setTemplate] = useState<TemplateModule | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<CompileError | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const compilationIdRef = useRef(0);

  // Compute cache key
  const effectiveCacheKey = cacheKey ?? hashCode(code);

  const doCompile = useCallback(async (compileCode: string, key: string) => {
    const compilationId = ++compilationIdRef.current;

    // Check cache first
    if (cache) {
      const cached = getCached(key);
      if (cached) {
        setTemplate(cached);
        setError(null);
        setCompiling(false);
        return;
      }
    }

    setCompiling(true);
    setError(null);

    try {
      // Initialize bundler
      await initBundler(wasmURL);

      // Check if this compilation was superseded
      if (compilationId !== compilationIdRef.current) return;

      // Bundle the code
      const bundled = await bundleTemplateBrowser(compileCode);

      // Check if this compilation was superseded
      if (compilationId !== compilationIdRef.current) return;

      // Compile to template
      const result = compileTemplate(bundled);

      // Check if this compilation was superseded
      if (compilationId !== compilationIdRef.current) return;

      if (result.error) {
        setError(result.error);
        setTemplate(null);
      } else if (result.template) {
        if (cache) {
          setCache(key, result.template);
        }
        setTemplate(result.template);
        setError(null);
      }
    } catch (e) {
      // Check if this compilation was superseded
      if (compilationId !== compilationIdRef.current) return;

      const err: CompileError = {
        message: e instanceof Error ? e.message : String(e),
      };
      setError(err);
      setTemplate(null);
    } finally {
      if (compilationId === compilationIdRef.current) {
        setCompiling(false);
      }
    }
  }, [cache, wasmURL]);

  // Effect to handle code changes with debouncing
  useEffect(() => {
    if (!enabled || !code.trim()) {
      setTemplate(null);
      setError(null);
      setCompiling(false);
      return;
    }

    // Check cache immediately (no debounce for cache hits)
    if (cache) {
      const cached = getCached(effectiveCacheKey);
      if (cached) {
        setTemplate(cached);
        setError(null);
        setCompiling(false);
        return;
      }
    }

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Abort previous compilation
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // Set compiling immediately to show loading state
    setCompiling(true);

    // Debounce the compilation
    debounceRef.current = setTimeout(() => {
      doCompile(code, effectiveCacheKey);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      abortRef.current?.abort();
    };
  }, [code, effectiveCacheKey, cache, debounceMs, enabled, doCompile]);

  // Manual recompile function
  const recompile = useCallback(async () => {
    if (!code.trim()) return;

    // Clear from cache to force recompile
    if (cache) {
      templateCache.delete(effectiveCacheKey);
    }

    await doCompile(code, effectiveCacheKey);
  }, [code, effectiveCacheKey, cache, doCompile]);

  return {
    template,
    compiling,
    error,
    recompile,
  };
}
