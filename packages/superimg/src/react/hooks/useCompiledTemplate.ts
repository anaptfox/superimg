//! React hook for compiled templates with caching and debouncing
//! Provides zero-config compilation from code strings to TemplateModule

import { useState, useEffect, useRef, useCallback } from "react";
import {
  compileTemplate,
  type TemplateModule,
  type CompileError,
} from "../../index.browser.js";


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
  /** The code string to compile via WASM bundler */
  code?: string;
  /** URL to fetch source code (alternative to inline `code`) */
  codeUrl?: string;
  /** Pre-bundled IIFE from build-time rolldown (skips WASM when wasmCompile is false) */
  bundled?: string;
  /** URL to fetch pre-bundled IIFE (alternative to inline `bundled`) */
  bundledUrl?: string;
  /** When false, use `bundled` instead of WASM (default: true) */
  wasmCompile?: boolean;
  /** Whether to use the global cache (default: true) */
  cache?: boolean;
  /** Custom cache key (default: hash of code or bundled) */
  cacheKey?: string;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
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
    code: inlineCode = "",
    codeUrl,
    bundled: inlineBundled,
    bundledUrl,
    wasmCompile = true,
    cache = true,
    cacheKey,
    debounceMs = 300,
    enabled = true,
  } = options;

  const [template, setTemplate] = useState<TemplateModule | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<CompileError | null>(null);
  const [fetchedCode, setFetchedCode] = useState<string | null>(null);
  const [fetchedBundled, setFetchedBundled] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const compilationIdRef = useRef(0);
  const queueKeyRef = useRef<object>({});

  const code = inlineCode || fetchedCode || "";
  const bundled = inlineBundled ?? fetchedBundled ?? undefined;

  // Compute cache key
  const effectiveCacheKey =
    cacheKey ??
    hashCode(
      wasmCompile ? (codeUrl ?? code) : (bundledUrl ?? bundled ?? ""),
    );

  const doCompileBundled = useCallback(
    (iife: string, key: string) => {
      const compilationId = ++compilationIdRef.current;

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
        const result = compileTemplate(iife);
        if (compilationId !== compilationIdRef.current) return;

        if (result.error) {
          setError(result.error);
          setTemplate(null);
        } else if (result.template) {
          if (cache) setCache(key, result.template);
          setTemplate(result.template);
          setError(null);
        }
      } catch (e) {
        if (compilationId !== compilationIdRef.current) return;
        setError({ message: e instanceof Error ? e.message : String(e) });
        setTemplate(null);
      } finally {
        if (compilationId === compilationIdRef.current) {
          setCompiling(false);
        }
      }
    },
    [cache],
  );

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
      // Check if this compilation was superseded
      if (compilationId !== compilationIdRef.current) return;

      const { bundleTemplateQueued } = await import("./bundler-worker-client.js");
      const bundled = await bundleTemplateQueued(compileCode, queueKeyRef.current);

      // Check if this compilation was superseded
      if (compilationId !== compilationIdRef.current) return;

      // Compile to template
      const result = compileTemplate(bundled.code);

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
  }, [cache]);

  // Fetch remote code / bundled IIFE when URLs are provided
  useEffect(() => {
    if (!enabled) return;

    const needsCode = wasmCompile && !inlineCode && !!codeUrl;
    const needsBundled = !wasmCompile && !inlineBundled && !!bundledUrl;

    if (!needsCode && !needsBundled) return;

    if (needsCode) setFetchedCode(null);
    if (needsBundled) setFetchedBundled(null);

    setCompiling(true);
    setError(null);

    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      try {
        if (needsCode && codeUrl) {
          const res = await fetch(codeUrl, { signal });
          if (!res.ok) throw new Error(`Failed to fetch ${codeUrl}: ${res.status}`);
          const text = await res.text();
          setFetchedCode(text);
        }
        if (needsBundled && bundledUrl) {
          const res = await fetch(bundledUrl, { signal });
          if (!res.ok) throw new Error(`Failed to fetch ${bundledUrl}: ${res.status}`);
          const text = await res.text();
          setFetchedBundled(text);
        }
      } catch (e) {
        if (signal.aborted) return;
        setError({
          message: e instanceof Error ? e.message : String(e),
        });
        setTemplate(null);
        setCompiling(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [enabled, inlineCode, codeUrl, inlineBundled, bundledUrl, wasmCompile]);

  // Effect to handle code changes with debouncing
  useEffect(() => {
    if (!enabled) {
      setTemplate(null);
      setError(null);
      setCompiling(false);
      return;
    }

    // Wait for URL fetches before compiling
    if (wasmCompile && !inlineCode && codeUrl && fetchedCode === null) return;
    if (!wasmCompile && !inlineBundled && bundledUrl && fetchedBundled === null) {
      return;
    }

    if (!wasmCompile) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (bundled) {
        doCompileBundled(bundled, effectiveCacheKey);
      } else {
        setTemplate(null);
        setError(null);
        setCompiling(false);
      }
      return;
    }

    if (!code.trim()) {
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
  }, [
    code,
    bundled,
    wasmCompile,
    effectiveCacheKey,
    cache,
    debounceMs,
    enabled,
    inlineCode,
    codeUrl,
    fetchedCode,
    inlineBundled,
    bundledUrl,
    fetchedBundled,
    doCompile,
    doCompileBundled,
  ]);

  // Manual recompile function
  const recompile = useCallback(async () => {
    // Clear from cache to force recompile
    if (cache) {
      templateCache.delete(effectiveCacheKey);
    }

    if (!wasmCompile) {
      if (bundled) doCompileBundled(bundled, effectiveCacheKey);
      return;
    }

    if (!code.trim()) return;

    await doCompile(code, effectiveCacheKey);
  }, [bundled, cache, code, doCompile, doCompileBundled, effectiveCacheKey, wasmCompile]);

  return {
    template,
    compiling,
    error,
    recompile,
  };
}
