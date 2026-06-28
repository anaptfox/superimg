import { useMemo } from "react";
import {
  useCompiledTemplate,
  isComposedTemplate,
  type TemplateModule,
  type ComposedTemplate,
} from "superimg/react";
import type { EditorExample } from "@/lib/video/examples";
import {
  hasConfigAssets,
  hasRelativeImports,
  playgroundAssetResolver,
  resolvePlaygroundAssets,
} from "./host";

export function shouldUseBundled(example: EditorExample | undefined, codeEdited = false): boolean {
  if (!example?.bundled || codeEdited) return false;
  return example.playground?.liveEdit === false;
}

export function exampleNeedsPreBundle(code: string): boolean {
  return hasRelativeImports(code) || hasConfigAssets(code);
}

export function templateDuration(
  template: TemplateModule | ComposedTemplate | null,
  fallback = 5,
): number {
  if (!template) return fallback;
  if (isComposedTemplate(template)) {
    return template.totalFrames / template.fps;
  }
  const declared = template.config?.duration;
  return typeof declared === "number" ? declared : fallback;
}

export function usePlaygroundExample(
  example: EditorExample | null | undefined,
  options?: { code?: string; edited?: boolean; enabled?: boolean },
) {
  const wasmCompile = options?.edited ?? !shouldUseBundled(example ?? undefined);
  const code = options?.code ?? example?.code ?? "";
  const enabled =
    options?.enabled ??
    (!!example && (!!code || !!(example.bundled && !wasmCompile)));

  const { template, compiling, error } = useCompiledTemplate({
    code,
    bundled: example?.bundled,
    wasmCompile,
    enabled,
  });

  const assets = useMemo(
    () => resolvePlaygroundAssets(template?.config?.assets),
    [template?.config?.assets],
  );

  const duration = templateDuration(template, example?.playground?.duration ?? 5);

  return {
    template,
    compiling,
    error,
    assets,
    wasmCompile,
    duration,
    assetResolver: playgroundAssetResolver,
  };
}