//! React hook for compiled deterministic media with caching and debouncing

import { useState, useEffect, useRef, useCallback } from "react";
import { compileTemplate } from "@superimg/core";
import { compilerDiagnostics, normalizeCompilerError } from "@superimg/core/errors";
import type { CompileError, MediaDefinition, CompilerDiagnostic } from "@superimg/types";


// =============================================================================
// GLOBAL LRU CACHE
// =============================================================================

const MAX_CACHE_SIZE = 50;
const mediaCache = new Map<string, MediaDefinition>();
const compilerMessages = new WeakMap<MediaDefinition, readonly CompilerDiagnostic[]>();

function getCached(key: string): MediaDefinition | undefined {
  const template = mediaCache.get(key);
  if (template) {
    // Move to end (most recently used)
    mediaCache.delete(key);
    mediaCache.set(key, template);
  }
  return template;
}

function setCache(key: string, template: MediaDefinition): void {
  // Evict oldest if at capacity
  if (mediaCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = mediaCache.keys().next().value;
    if (oldestKey) mediaCache.delete(oldestKey);
  }
  mediaCache.set(key, template);
}

/** Clear the global template cache */
export function clearMediaCache(): void {
  mediaCache.clear();
}

/** Get the current cache size */
export function getMediaCacheSize(): number {
  return mediaCache.size;
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

export interface UseCompiledMediaOptions {
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

export interface UseCompiledMediaReturn {
  /** The compiled deterministic media (null if not compiled or has errors) */
  media: MediaDefinition | null;
  /** Whether compilation is in progress */
  compiling: boolean;
  /** Compilation error (null if successful) */
  error: CompileError | null;
  diagnostics: readonly CompilerDiagnostic[];
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
 * const { media, compiling, error } = useCompiledMedia({ code });
 *
 * // With custom options
 * const { media, compiling, error } = useCompiledMedia({
 *   code,
 *   debounceMs: 150,
 *   cache: true,
 * });
 * ```
 */
export function useCompiledMedia(
  options: UseCompiledMediaOptions
): UseCompiledMediaReturn {
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

  const [media, setMedia] = useState<MediaDefinition | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<CompileError | null>(null);
  const [diagnostics, setDiagnostics] = useState<readonly CompilerDiagnostic[]>([]);
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
          setMedia(cached);
          setDiagnostics(compilerMessages.get(cached) ?? []);
          setError(null);
          setCompiling(false);
          return;
        }
      }

      setCompiling(true);
      setError(null);
      setDiagnostics([]);

      try {
        const result = compileTemplate(iife);
        setDiagnostics(result.error ? compilerDiagnostics(result.error, "evaluate") : []);
        if (compilationId !== compilationIdRef.current) return;

        if (result.error) {
          setError(result.error);
          setMedia(null);
        } else if (result.media) {
          if (cache) setCache(key, result.media);
          setMedia(result.media);
          setError(null);
        } else if (result.interactive) {
          setError({
            message:
              "Interactive media requires @superimg/interactive and cannot load in the passive Player",
          });
          setMedia(null);
        }
      } catch (e) {
        if (compilationId !== compilationIdRef.current) return;
        const error = normalizeCompilerError(e, "evaluate");
        setError(error);
        setDiagnostics(compilerDiagnostics(error, "evaluate"));
        setMedia(null);
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
        setMedia(cached);
        setDiagnostics(compilerMessages.get(cached) ?? []);
        setError(null);
        setCompiling(false);
        return;
      }
    }

    setCompiling(true);
    setError(null);
    setDiagnostics([]);

    try {
      // Check if this compilation was superseded
      if (compilationId !== compilationIdRef.current) return;

      const { bundleTemplateQueued } = await import("./bundler-worker-client.js");
      const bundled = await bundleTemplateQueued(compileCode, queueKeyRef.current);

      // Check if this compilation was superseded
      if (compilationId !== compilationIdRef.current) return;

      // Compile to template
      const result = compileTemplate(bundled.code);
      setDiagnostics(result.error ? compilerDiagnostics(result.error, "evaluate") : bundled.diagnostics ?? []);
      if (result.media) compilerMessages.set(result.media, bundled.diagnostics ?? []);

      // Check if this compilation was superseded
      if (compilationId !== compilationIdRef.current) return;

      if (result.error) {
        setError(result.error);
        setMedia(null);
      } else if (result.media) {
        if (cache) {
          setCache(key, result.media);
        }
        setMedia(result.media);
        setError(null);
      } else if (result.interactive) {
        setError({
          message:
            "Interactive media requires @superimg/interactive and cannot load in the passive Player",
        });
        setMedia(null);
      }
    } catch (e) {
      // Check if this compilation was superseded
      if (compilationId !== compilationIdRef.current) return;

      const err = normalizeCompilerError(e, "generate", "<browser>");
      setDiagnostics(compilerDiagnostics(err, "generate"));
      setError(err);
      setMedia(null);
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
        setMedia(null);
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
      setMedia(null);
      setError(null);
      setDiagnostics([]);
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
        setMedia(null);
        setError(null);
        setCompiling(false);
      }
      return;
    }

    if (!code.trim()) {
      setMedia(null);
      setError(null);
      setDiagnostics([]);
      setCompiling(false);
      return;
    }

    // Check cache immediately (no debounce for cache hits)
    if (cache) {
      const cached = getCached(effectiveCacheKey);
      if (cached) {
        setMedia(cached);
        setDiagnostics(compilerMessages.get(cached) ?? []);
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
      mediaCache.delete(effectiveCacheKey);
    }

    if (!wasmCompile) {
      if (bundled) doCompileBundled(bundled, effectiveCacheKey);
      return;
    }

    if (!code.trim()) return;

    await doCompile(code, effectiveCacheKey);
  }, [bundled, cache, code, doCompile, doCompileBundled, effectiveCacheKey, wasmCompile]);

  return {
    media,
    compiling,
    error,
    diagnostics,
    recompile,
  };
}
