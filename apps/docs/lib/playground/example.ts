import { useMemo } from "react";
import type { MediaDefinition } from "@foxworth/superimg/react";
import { useCompiledMedia } from "@foxworth/superimg/react/compile";
import type { EditorExample } from "@/lib/video/examples";
import {
  hasConfigAssets,
  hasRelativeImports,
  playgroundAssetResolver,
  resolvePlaygroundAssets,
} from "./host";

export function hasPrebuiltBundle(example: EditorExample | undefined): boolean {
  return !!example?.bundledUrl;
}

/** Editor: WASM when live-editing demos or no prebuilt bundle. */
export function shouldUseBundled(
  example: EditorExample | undefined,
  codeEdited = false,
): boolean {
  if (codeEdited || !hasPrebuiltBundle(example)) return false;
  return example!.playground?.liveEdit === false;
}

/**
 * Grid / modal preview: always prefer prebuilt IIFE when available.
 * `liveEdit` only affects the editor — not thumbnail playback.
 */
export function shouldUseBundledForPreview(
  example: EditorExample | undefined,
): boolean {
  return hasPrebuiltBundle(example);
}

export function exampleNeedsPreBundle(code: string): boolean {
  return hasRelativeImports(code) || hasConfigAssets(code);
}

export function templateDuration(
  template: MediaDefinition | null,
  fallback = 5,
): number {
  if (!template) return fallback;
  const declared = template.config?.duration;
  return typeof declared === "number" ? declared : fallback;
}

export function usePlaygroundExample(
  example: EditorExample | null | undefined,
  options?: {
    code?: string;
    edited?: boolean;
    enabled?: boolean;
    /** Grid/modal: never WASM when a prebuilt bundle exists */
    preview?: boolean;
  },
) {
  const preview = options?.preview ?? false;
  const useBundledPath = preview
    ? shouldUseBundledForPreview(example ?? undefined)
    : shouldUseBundled(example ?? undefined, options?.edited);

  const wasmCompile = options?.edited ?? !useBundledPath;
  const code = options?.code ?? example?.code ?? "";
  const codeUrl = !code && example?.codeUrl ? example.codeUrl : undefined;
  const usePrebuilt = useBundledPath;
  const enabled =
    options?.enabled ??
    (!!example &&
      (!!code ||
        !!codeUrl ||
        (hasPrebuiltBundle(example) && !wasmCompile)));

  const { media, compiling, error } = useCompiledMedia({
    code,
    codeUrl,
    bundledUrl: example?.bundledUrl,
    wasmCompile,
    enabled,
  });

  const assets = useMemo(
    () => resolvePlaygroundAssets(media?.config?.assets),
    [media?.config?.assets],
  );

  const duration = templateDuration(media, example?.playground?.duration ?? 5);

  const missingBundle =
    !!example &&
    preview &&
    !hasPrebuiltBundle(example);

  return {
    media,
    compiling,
    error,
    assets,
    wasmCompile,
    usePrebuilt,
    missingBundle,
    duration,
    assetResolver: playgroundAssetResolver,
  };
}
