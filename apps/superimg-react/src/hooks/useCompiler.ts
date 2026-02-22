//! React hook for template compilation (browser - uses esbuild-wasm)

import { useState, useCallback, useEffect } from "react";
import {
  initBundler,
  bundleTemplateBrowser,
  compileTemplate,
  validateTemplate,
  type TemplateModule,
  type CompileError,
  type CompileResult,
  type RenderContext,
} from "superimg";

export interface UseCompilerReturn {
  /** Whether the bundler is ready (esbuild-wasm initialized) */
  ready: boolean;
  /** The compiled template (null if not compiled or has errors) */
  template: TemplateModule | null;
  /** Compilation error (null if successful) */
  error: CompileError | null;
  /** Compile code into a template (async - bundles with esbuild-wasm first) */
  compile: (code: string) => Promise<CompileResult>;
  /** Validate a template with a test context */
  validate: (template: TemplateModule, testContext: RenderContext) => CompileError | null;
  /** Clear the current template and error */
  clear: () => void;
}

/**
 * Hook for compiling user code into template modules.
 * Uses esbuild-wasm for bundling in the browser.
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
export function useCompiler(wasmURL?: string): UseCompilerReturn {
  const [ready, setReady] = useState(false);
  const [template, setTemplate] = useState<TemplateModule | null>(null);
  const [error, setError] = useState<CompileError | null>(null);

  useEffect(() => {
    initBundler(wasmURL).then(() => setReady(true));
  }, [wasmURL]);

  const compile = useCallback(async (code: string): Promise<CompileResult> => {
    try {
      await initBundler(wasmURL);
      if (!ready) setReady(true);

      const bundled = await bundleTemplateBrowser(code);
      const result = compileTemplate(bundled);

      if (result.error) {
        setError(result.error);
        setTemplate(null);
      } else if (result.template) {
        setError(null);
        setTemplate(result.template);
      }

      return result;
    } catch (e) {
      const err: CompileError = {
        message: e instanceof Error ? e.message : String(e),
      };
      setError(err);
      setTemplate(null);
      return { error: err };
    }
  }, [wasmURL]);

  const validate = useCallback(
    (tmpl: TemplateModule, testContext: RenderContext): CompileError | null => {
      const validationError = validateTemplate(tmpl, testContext);
      if (validationError) {
        setError(validationError);
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
