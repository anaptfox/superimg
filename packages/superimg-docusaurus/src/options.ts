//! Plugin options for @superimg/docusaurus.

export type SuperimgDocusaurusOptions = {
  /** Multi-instance plugin id (Docusaurus default: `"default"`). */
  id?: string;
  /**
   * Enable `experiments.asyncWebAssembly` on the client webpack/rspack build.
   * Required for SuperImg browser compile / WASM paths.
   * @default true
   */
  asyncWebAssembly?: boolean;
  /**
   * Also enable async WASM on the server (SSG) webpack build.
   * Prefer dynamic-importing Player so this stays false.
   * @default false
   */
  asyncWebAssemblyOnServer?: boolean;
  /** Fallback text while BrowserOnly / Player loads. @default "Loading preview…" */
  fallbackText?: string;
};

export type NormalizedSuperimgDocusaurusOptions = {
  id: string;
  asyncWebAssembly: boolean;
  asyncWebAssemblyOnServer: boolean;
  fallbackText: string;
};

export function normalizeOptions(
  options: SuperimgDocusaurusOptions | undefined,
): NormalizedSuperimgDocusaurusOptions {
  return {
    id: options?.id ?? "default",
    asyncWebAssembly: options?.asyncWebAssembly !== false,
    asyncWebAssemblyOnServer: options?.asyncWebAssemblyOnServer === true,
    fallbackText: options?.fallbackText ?? "Loading preview…",
  };
}
