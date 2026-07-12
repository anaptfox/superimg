//! Canvas-based export for playground editor (preview uses WebRuntime)

import { useCallback } from "react";
import {
  createRenderContext,
  resolveFormat,
  isComposedTemplate,
  type EncodingOptions,
  type FormatOption,
  type TemplateModule,
  type ComposedTemplate,
} from "../../index.browser.js";
import { useExport } from "./useExport.js";
import type { ExportOptions } from "../components/ExportDialog.js";

export interface UsePlaygroundExportOptions {
  /** `unknown` breaks assignability of a template's own `render(ctx: RenderContext<TData>)`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  template: TemplateModule<any> | ComposedTemplate | null;
  data?: Record<string, unknown>;
  fps?: number;
  /** Override template config duration (e.g. data-derived runtime) */
  duration?: number;
  encoding?: EncodingOptions;
}

export function usePlaygroundExport({
  template,
  data = {},
  fps = 30,
  duration,
  encoding,
}: UsePlaygroundExportOptions) {
  const exportHook = useExport();

  const exportMp4 = useCallback(
    async (options?: ExportOptions) => {
      if (!template) return null;

      const exportFormat = options?.format ?? "horizontal";
      const { width: exportWidth, height: exportHeight } = resolveFormat(exportFormat);

      const mergedEncoding: EncodingOptions = {
        ...encoding,
        ...options?.encoding,
        video: { ...encoding?.video, ...options?.encoding?.video },
        audio: { ...encoding?.audio, ...options?.encoding?.audio },
      };

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = exportWidth;
      exportCanvas.height = exportHeight;

      const { CanvasRenderer } = await import("@superimg/browser-export");
      const exportRenderer = new CanvasRenderer(exportCanvas);
      await exportRenderer.warmup();

      const exportDuration =
        duration ??
        (typeof template.config?.duration === "number" ? template.config.duration : 5);
      const totalFrames = isComposedTemplate(template)
        ? template.totalFrames
        : Math.ceil(exportDuration * (template.config?.fps ?? fps));
      const ctxFps = isComposedTemplate(template) ? template.fps : (template.config?.fps ?? fps);

      const renderAtExportSize = async (frame: number) => {
        const templateData = "sample" in template ? template.sample : undefined;
        const mergedData = { ...(templateData ?? {}), ...data };
        const designW = template.config?.width;
        const ctx = createRenderContext(
          frame,
          ctxFps,
          totalFrames,
          exportWidth,
          exportHeight,
          mergedData,
          "default",
          {},
          undefined,
          designW,
        );
        const html = template.render(ctx);
        await exportRenderer.renderFrame(() => html, ctx);
      };

      try {
        return await exportHook.exportMp4(
          exportCanvas,
          {
            fps: ctxFps,
            duration: totalFrames / ctxFps,
            width: exportWidth,
            height: exportHeight,
            encoding: mergedEncoding,
          },
          renderAtExportSize,
        );
      } finally {
        await exportRenderer.dispose();
      }
    },
    [template, data, fps, duration, encoding, exportHook],
  );

  return {
    exporting: exportHook.exporting,
    exportProgress: exportHook.progress,
    exportMp4,
    download: exportHook.download,
  };
}
