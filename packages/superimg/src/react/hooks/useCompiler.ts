//! React hook for template compilation (browser - uses @rolldown/browser)

import { useState, useCallback, useEffect, useRef } from "react";
import { compileTemplate, validateTemplate } from "@superimg/core";
import { compilerDiagnostics, normalizeCompilerError } from "@superimg/core/errors";
import {
  TemplateCompilationError,
  type MediaDefinition,
  type CompilerDiagnostic,
  type CompileError,
  type CompileResult,
  type RenderContext,
  type SuperImgError,
} from "@superimg/types";
import { loadBundler } from "./bundler-loader.js";

export interface UseCompilerReturn {
  /** Whether the bundler is ready (@rolldown/browser initialized) */
  ready: boolean;
  /** The compiled media (null if not compiled or has errors) */
  media: MediaDefinition | null;
  /** Compilation error (null if successful) */
  error: SuperImgError | null;
  diagnostics: readonly CompilerDiagnostic[];
  /** Compile code into a template (async - bundles with @rolldown/browser first) */
  compile: (code: string) => Promise<CompileResult>;
  /** Validate media with a test context */
  validate: (media: MediaDefinition, testContext: RenderContext) => CompileError | null;
  /** Clear the current template and error */
  clear: () => void;
}

/**
 * Hook for compiling user code into template modules.
 * Uses @rolldown/browser for bundling in the browser.
 *
 * @example
 * ```tsx
 * const { media, error, compile, ready } = useCompiler();
 *
 * const handleCodeChange = async (code: string) => {
 *   const result = await compile(code);
 *   if (result.media) {
 *     // Use the deterministic media for rendering
 *   }
 * };
 * ```
 */
export function useCompiler(): UseCompilerReturn {
  const [ready, setReady] = useState(false);
  const [template, setTemplate] = useState<MediaDefinition | null>(null);
  const [error, setError] = useState<SuperImgError | null>(null);
  const [diagnostics, setDiagnostics] = useState<readonly CompilerDiagnostic[]>([]);
  const compilation = useRef(0);

  useEffect(() => {
    loadBundler()
      .then(({ initBundler }) => initBundler())
      .then(() => setReady(true))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "BrowserNotSupportedError") {
          setError(new TemplateCompilationError({ syntaxError: e.message }));
        }
      });
  }, []);

  const compile = useCallback(async (code: string): Promise<CompileResult> => {
    const generation = ++compilation.current;
    setDiagnostics([]);
    try {
      const { initBundler, bundleTemplateBrowser } = await loadBundler();
      await initBundler();
      setReady(true);

      const bundled = await bundleTemplateBrowser(code);
      const result = compileTemplate(bundled.code);
      if (generation !== compilation.current) return result;
      setDiagnostics(result.error ? compilerDiagnostics(result.error, "evaluate") : bundled.diagnostics ?? []);

      if (result.error) {
        setError(result.error);
        setTemplate(null);
      } else if (result.media) {
        setError(null);
        setTemplate(result.media);
      } else if (result.interactive) {
        const err = new TemplateCompilationError({
          syntaxError:
            "Interactive media requires @superimg/interactive and cannot load in the passive Player",
        });
        setError(err);
        setTemplate(null);
      }

      return result;
    } catch (e: unknown) {
      const err = normalizeCompilerError(e, "generate", "<browser>");
      if (generation !== compilation.current) return { error: err };
      setError(err);
      setDiagnostics(compilerDiagnostics(err, "generate"));
      setTemplate(null);
      return { error: err };
    }
  }, []);

  const validate = useCallback(
    (media: MediaDefinition, testContext: RenderContext): CompileError | null => {
      const validationError = validateTemplate(media, testContext);
      if (validationError) {
        setError(new TemplateCompilationError({ syntaxError: validationError.message }));
      }
      return validationError;
    },
    []
  );

  const clear = useCallback(() => {
    compilation.current++;
    setTemplate(null);
    setError(null);
    setDiagnostics([]);
  }, []);

  return {
    ready,
    media: template,
    error,
    diagnostics,
    compile,
    validate,
    clear,
  };
}
