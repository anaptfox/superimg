//! Shared esbuild plugin for superimg template bundling
//! Used by both server (esbuild) and browser (esbuild-wasm) bundlers

interface EsbuildPlugin {
  name: string;
  setup(build: { onResolve: Function; onLoad: Function }): void;
}

/**
 * Creates the esbuild plugin that shims `superimg` imports (defineTemplate)
 * and strips `@superimg/stdlib` imports (accessed via ctx.std at runtime).
 */
export function createSuperimgPlugin(namespace = "superimg-virtual"): EsbuildPlugin {
  return {
    name: "superimg-resolve",
    setup(build) {
      // Shim defineTemplate
      build.onResolve({ filter: /^superimg$/ }, () => ({
        path: "superimg",
        namespace,
      }));
      build.onLoad({ filter: /^superimg$/, namespace }, () => ({
        contents: 'export function defineTemplate(m) { return m; }',
        loader: "js",
      }));
      // Strip stdlib imports (accessed via ctx.std at runtime)
      build.onResolve({ filter: /^@superimg\/stdlib/ }, () => ({
        path: "stdlib-noop",
        namespace,
      }));
      build.onLoad({ filter: /^stdlib-noop$/, namespace }, () => ({
        contents: "export {}",
        loader: "js",
      }));
    },
  };
}
