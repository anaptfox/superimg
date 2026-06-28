//! React hook for template compilation (browser - uses @rolldown/browser)

import { useState, useCallback, useEffect } from "react";
import {
  compileTemplate,
  validateTemplate,
  TemplateCompilationError,
  type TemplateModule,
  type CompileError,
  type CompileResult,
  type RenderContext,
  type SuperImgError,
} from "../../index.browser.js";
import { loadBundler } from "./bundler-loader.js";

export interface UseCompilerReturn {
  /** Whether the bundler is ready (@rolldown/browser initialized) */
  ready: boolean;
  /** The compiled template (null if not compiled or has errors) */
  template: TemplateModule | null;
  /** Compilation error (null if successful) */
  error: SuperImgError | null;
  /** Compile code into a template (async - bundles with @rolldown/browser first) */
  compile: (code: string) => Promise<CompileResult>;
  /** Validate a template with a test context */
  validate: (template: TemplateModule, testContext: RenderContext) => CompileError | null;
  /** Clear the current template and error */
  clear: () => void;
}

/**
 * Hook for compiling user code into template modules.
 * Uses @rolldown/browser for bundling in the browser.
 *
 * @example
 * ```tsx
 * const { template, error, compile, ready } = useCompiler();
 *
 * const handleCodeChange = async (code: string) => {
 *   const result = await compile(code);
 *   if (result.template) {
 *     // Use the template for rendering
 *   }
 * };
 * ```
 */
export function useCompiler(): UseCompilerReturn {
  const [ready, setReady] = useState(false);
  const [template, setTemplate] = useState<TemplateModule | null>(null);
  const [error, setError] = useState<SuperImgError | null>(null);

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
    try {
      const { initBundler, bundleTemplateBrowser } = await loadBundler();
      await initBundler();
      setReady(true);

      const bundled = await bundleTemplateBrowser(code);
      const result = compileTemplate(bundled.code);

      if (result.error) {
        setError(result.error);
        setTemplate(null);
      } else if (result.template) {
        setError(null);
        setTemplate(result.template);
      }

      return result;
    } catch (e: unknown) {
      const err = new TemplateCompilationError({
        syntaxError: e instanceof Error ? e.message : String(e),
      });
      setError(err);
      setTemplate(null);
      return { error: err };
    }
  }, []);

  const validate = useCallback(
    (tmpl: TemplateModule, testContext: RenderContext): CompileError | null => {
      const validationError = validateTemplate(tmpl, testContext);
      if (validationError) {
        setError(new TemplateCompilationError({ syntaxError: validationError.message }));
      }
      return validationError;
    },
    []
  );

  const clear = useCallback(() => {
    setTemplate(null);
    setError(null);
  }, []);

  return {
    ready,
    template,
    error,
    compile,
    validate,
    clear,
  };
}
