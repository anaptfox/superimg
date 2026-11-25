//! Value-first browser export for authored media used by the playground/player.

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CanvasSize,
  EncodingOptions,
  ExportArtifact,
  ExportBundle,
  ExportableMedia,
  JsonObject,
  MediaDefinition,
  OutputFormat,
  Runtime,
} from "@superimg/types";
import type { ExportOptions } from "../components/ExportDialog.js";

export interface UsePlaygroundExportOptions {
  /** `unknown` breaks assignability of a template's own `render(ctx: RenderContext<TData>)`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  media: MediaDefinition<any> | null;
  data?: Record<string, unknown>;
  /** Custom export canvas; authored size is used when omitted. */
  size?: CanvasSize;
  fps?: number;
  /** Override template config duration (e.g. data-derived runtime). */
  duration?: number;
  encoding?: EncodingOptions;
}

/**
 * Export authored media through the value-first browser runtime.
 *
 * `useExport()` remains the low-level canvas/render-callback compatibility
 * hook. Playground and Player exports have a media value, so they use the
 * portable runtime bundle contract instead.
 */
export function usePlaygroundExport({
  media,
  data = {},
  size,
  fps = 30,
  duration,
  encoding,
}: UsePlaygroundExportOptions) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const exportMp4 = useCallback(
    async (options?: ExportOptions): Promise<Blob | null> => {
      if (media === null || controllerRef.current !== null) return null;

      const controller = new AbortController();
      controllerRef.current = controller;
      updateIfMounted(mountedRef, () => {
        setExporting(true);
        setProgress(0);
        setStatus("Starting export...");
      });

      let runtime: Runtime | null = null;
      let bundle: ExportBundle | null = null;
      try {
        const runtimeModule = await import("../../runtime.browser.js");
        runtime = await runtimeModule.init({ signal: controller.signal });
        updateIfMounted(mountedRef, () => {
          setProgress(0.05);
          setStatus("Preparing media...");
        });

        const exportWidth = options?.size?.width ?? size?.width ?? media.config?.width ?? 1920;
        const exportHeight = options?.size?.height ?? size?.height ?? media.config?.height ?? 1080;
        const mergedEncoding = mergeEncoding(encoding, options?.encoding);
        const format = animatedFormat(mergedEncoding.format);
        const runtimeEncoding = withoutFormat(mergedEncoding);
        const exportable = mediaWithRuntimeOverrides(media, fps, duration);

        updateIfMounted(mountedRef, () => {
          setProgress(0.1);
          setStatus("Rendering media...");
        });
        bundle = await runtimeModule.exportMedia(exportable, {
          runtime,
          for: [{
            id: "playground",
            format,
            width: exportWidth,
            height: exportHeight,
          }],
          data: data as JsonObject,
          ...(Object.keys(runtimeEncoding).length > 0 ? { encoding: runtimeEncoding } : {}),
          signal: controller.signal,
        });

        // Portable bundles intentionally outlive their runtime. Release heavy
        // renderer/encoder state before adapting the artifact to a browser Blob.
        await runtime.dispose();
        runtime = null;

        if (bundle.artifacts.length !== 1) {
          throw new Error(`Playground export expected one artifact, received ${bundle.artifacts.length}`);
        }
        updateIfMounted(mountedRef, () => {
          setProgress(0.9);
          setStatus("Finalizing video...");
        });
        const blob = await artifactToBlob(
          bundle.artifacts[0]!,
          controller.signal,
          (fraction) => updateIfMounted(mountedRef, () => setProgress(0.9 + fraction * 0.1)),
        );
        updateIfMounted(mountedRef, () => {
          setProgress(1);
          setStatus("Export complete!");
        });
        return blob;
      } catch (error) {
        if (isCancellation(error, controller.signal)) {
          updateIfMounted(mountedRef, () => setStatus("Export cancelled"));
          return null;
        }
        const message = exportErrorMessage(error);
        updateIfMounted(mountedRef, () => setStatus(`Export failed: ${message}`));
        return null;
      } finally {
        await disposeQuietly(bundle);
        await disposeQuietly(runtime);
        if (controllerRef.current === controller) controllerRef.current = null;
        updateIfMounted(mountedRef, () => setExporting(false));
      }
    },
    [media, data, size, fps, duration, encoding],
  );

  const download = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return {
    exporting,
    exportProgress: progress,
    status,
    exportMp4,
    download,
    cancel,
  };
}

function mediaWithRuntimeOverrides(
  template: MediaDefinition,
  fallbackFps: number,
  duration: number | undefined,
): ExportableMedia {
  if (!template.animated) return template as ExportableMedia;
  const config = template.config ?? {};
  return Object.freeze({
    ...template,
    config: Object.freeze({
      ...config,
      ...(config.fps === undefined ? { fps: fallbackFps } : {}),
      ...(duration !== undefined
        ? { duration }
        : config.duration === undefined
          ? { duration: 5 }
          : {}),
    }),
  }) as ExportableMedia;
}

function mergeEncoding(
  base: EncodingOptions | undefined,
  override: EncodingOptions | undefined,
): EncodingOptions {
  return {
    ...base,
    ...override,
    ...(base?.video !== undefined || override?.video !== undefined
      ? { video: { ...base?.video, ...override?.video } }
      : {}),
    ...(base?.audio !== undefined || override?.audio !== undefined
      ? { audio: { ...base?.audio, ...override?.audio } }
      : {}),
    ...(base?.mp4 !== undefined || override?.mp4 !== undefined
      ? { mp4: { ...base?.mp4, ...override?.mp4 } }
      : {}),
    ...(base?.webm !== undefined || override?.webm !== undefined
      ? { webm: { ...base?.webm, ...override?.webm } }
      : {}),
    ...(base?.gif !== undefined || override?.gif !== undefined
      ? { gif: { ...base?.gif, ...override?.gif } }
      : {}),
    ...(base?.capture !== undefined || override?.capture !== undefined
      ? { capture: { ...base?.capture, ...override?.capture } }
      : {}),
    ...(base?.still !== undefined || override?.still !== undefined
      ? { still: { ...base?.still, ...override?.still } }
      : {}),
  };
}

function animatedFormat(format: OutputFormat | undefined): "mp4" | "webm" {
  if (format === undefined || format === "mp4") return "mp4";
  if (format === "webm") return "webm";
  throw new TypeError(`Playground video export does not support ${format}`);
}

function withoutFormat(encoding: EncodingOptions): Omit<EncodingOptions, "format"> {
  const { format: _format, ...options } = encoding;
  return options;
}

async function artifactToBlob(
  artifact: ExportArtifact,
  signal: AbortSignal,
  onProgress: (fraction: number) => void,
): Promise<Blob> {
  const reader = artifact.stream().getReader();
  const parts: ArrayBuffer[] = [];
  let byteLength = 0;
  try {
    while (true) {
      if (signal.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      const copy = new Uint8Array(value.byteLength);
      copy.set(value);
      parts.push(copy.buffer);
      byteLength += value.byteLength;
      onProgress(artifact.byteLength === 0 ? 1 : Math.min(1, byteLength / artifact.byteLength));
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  return new Blob(parts, { type: artifact.mimeType });
}

function isCancellation(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "RUNTIME_CANCELLED" || code === "aborted";
}

function exportErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "findings" in error) {
    const findings = (error as { findings?: unknown }).findings;
    if (Array.isArray(findings)) {
      const first = findings.find(
        (finding): finding is { message: string } =>
          typeof finding === "object" &&
          finding !== null &&
          "message" in finding &&
          typeof (finding as { message?: unknown }).message === "string",
      );
      if (first !== undefined) return first.message;
    }
  }
  return error instanceof Error ? error.message : "Unknown error";
}

async function disposeQuietly(value: { dispose(): Promise<void> } | null): Promise<void> {
  if (value === null) return;
  try {
    await value.dispose();
  } catch {
    // Preserve the primary export result/error. Runtime diagnostics own disposal failures.
  }
}

function updateIfMounted(
  mounted: { readonly current: boolean },
  update: () => void,
): void {
  if (mounted.current) update();
}
