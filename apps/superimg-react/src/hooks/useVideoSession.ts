//! Combined hook for video session management
//! Reduces boilerplate by orchestrating player, compiler, preview, and export

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from "react";
import { createRenderContext, type PlayerStore, type TemplateModule, type EncodingOptions } from "superimg";
import { getPreset } from "superimg/stdlib";
import { usePlayer } from "./usePlayer.js";
import { useCompiler } from "./useCompiler.js";
import { usePreview, type RenderFn } from "./usePreview.js";
import { useExport } from "./useExport.js";

/** Simple format aliases that map to stdlib presets */
const SIMPLE_ALIASES: Record<string, string> = {
  vertical: "instagram.video.reel",     // 1080x1920
  horizontal: "youtube.video.long",     // 1920x1080
  square: "instagram.video.feed",       // 1080x1080
} as const;

/** Format option: simple alias, stdlib path, or custom dimensions */
export type FormatOption =
  | "vertical"
  | "horizontal"
  | "square"
  | string
  | { width: number; height: number };

/** Export output configuration */
export interface ExportOutput {
  format: FormatOption;
  filename: string;
}

export interface VideoSessionConfig {
  /** Duration in seconds - reactive, can change after mount */
  duration: number;
  /** Frames per second (default: 30) */
  fps?: number;
  /** Initial preview format (default: "vertical") */
  initialPreviewFormat?: FormatOption;
  /** Canvas ref (optional if using VideoCanvas component) */
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  /** Encoding options (codec, bitrate, keyframe interval) */
  encoding?: EncodingOptions;
}

export interface VideoSessionReturn {
  // State
  /** Whether the session is ready to render (preview initialized and template compiled) */
  ready: boolean;
  /** Current status message */
  status: string;
  /** Current error (null if none) */
  error: Error | null;

  // Player controls
  /** Whether video is currently playing */
  isPlaying: boolean;
  /** Current frame number */
  currentFrame: number;
  /** Total number of frames */
  totalFrames: number;
  /** Progress from 0-1 */
  progress: number;
  /** Start playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Toggle play/pause */
  togglePlayPause: () => void;
  /** Seek to a specific frame */
  seek: (frame: number) => void;

  // Template
  /** Compile code string into a template (async) */
  compile: (code: string) => Promise<void>;
  /** Set a pre-compiled template directly */
  setTemplate: (template: TemplateModule) => void;
  /** Current compiled template (null if not compiled) */
  template: TemplateModule | null;

  // Rendering
  /** Render a specific frame */
  renderFrame: (frame: number) => Promise<void>;

  // Export
  /** Whether export is in progress */
  exporting: boolean;
  /** Export progress from 0-1 */
  exportProgress: number;
  /** Export video to MP4 blob at specified format (defaults to preview format) */
  exportMp4: (options?: { format?: FormatOption }) => Promise<Blob | null>;
  /** Export to multiple formats sequentially */
  exportMultiple: (outputs: ExportOutput[]) => Promise<Map<string, Blob>>;
  /** Download a blob with the given filename */
  download: (blob: Blob, filename: string) => void;

  // For Timeline component
  /** Underlying player store for Timeline component */
  store: PlayerStore;

  // Canvas management (for VideoCanvas component)
  /** Set the canvas element (used by VideoCanvas component) */
  setCanvas: (canvas: HTMLCanvasElement | null) => void;

  // Preview format (mutable)
  /** Current preview format */
  previewFormat: FormatOption;
  /** Change the preview format (clears cache, re-renders) */
  setPreviewFormat: (format: FormatOption) => void;
  /** Preview width in pixels (derived from previewFormat) */
  previewWidth: number;
  /** Preview height in pixels (derived from previewFormat) */
  previewHeight: number;
  /** Frames per second */
  fps: number;
}

/**
 * Resolve format option to width/height dimensions.
 * Exported for testing and advanced use cases.
 */
export function resolveFormat(format: FormatOption): { width: number; height: number } {
  if (typeof format === "object") {
    return format;
  }

  const presetPath = SIMPLE_ALIASES[format] ?? format;
  const preset = getPreset(presetPath);

  if (!preset) {
    throw new Error(`Unknown format: ${format}`);
  }

  return { width: preset.width, height: preset.height };
}

/**
 * Hook for managing a complete video session.
 *
 * Combines player, compiler, preview, and export into a single orchestrated hook,
 * reducing boilerplate by 60-70%.
 *
 * @example
 * ```tsx
 * function MyVideoEditor() {
 *   const session = useVideoSession({
 *     duration: 5,
 *     initialPreviewFormat: "vertical",
 *   });
 *
 *   // Change preview format
 *   session.setPreviewFormat("horizontal");
 *
 *   // Export at different format than preview
 *   const handleExport = async () => {
 *     const blob = await session.exportMp4({ format: "youtube.video.short" });
 *     if (blob) session.download(blob, "export.mp4");
 *   };
 *
 *   // Or export multiple formats
 *   const handleMultiExport = async () => {
 *     await session.exportMultiple([
 *       { format: "instagram.video.reel", filename: "video-ig.mp4" },
 *       { format: "youtube.video.short", filename: "video-yt.mp4" },
 *     ]);
 *   };
 *
 *   return (
 *     <div>
 *       <VideoCanvas session={session} />
 *       <Timeline store={session.store} showTime />
 *     </div>
 *   );
 * }
 * ```
 */
export function useVideoSession(config: VideoSessionConfig): VideoSessionReturn {
  const fps = config.fps ?? 30;

  // Preview format state (mutable)
  const [previewFormat, setPreviewFormatState] = useState<FormatOption>(
    config.initialPreviewFormat ?? "vertical"
  );

  // Derive dimensions from preview format
  const { width: previewWidth, height: previewHeight } = resolveFormat(previewFormat);

  // Internal canvas ref management (for VideoCanvas component)
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const effectiveCanvasRef = config.canvasRef ?? internalCanvasRef;

  // Status and error state
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState<Error | null>(null);

  // Template state (for setTemplate)
  const [directTemplate, setDirectTemplate] = useState<TemplateModule | null>(null);

  // Internal hooks
  const player = usePlayer({
    fps,
    durationSeconds: config.duration,
    onFrameChange: (frame) => {
      renderFrameInternal(frame);
    },
  });

  const compiler = useCompiler();
  const preview = usePreview(effectiveCanvasRef, { width: previewWidth, height: previewHeight });
  const exportHook = useExport();

  // Effective template (from compiler or direct)
  const template = directTemplate ?? compiler.template;

  // Render a frame to the canvas at preview dimensions
  const renderFrameInternal = useCallback(
    async (frame: number) => {
      if (!template || !preview.ready) return;

      try {
        const ctx = createRenderContext(
          frame,
          fps,
          player.state.totalFrames,
          previewWidth,
          previewHeight,
          {}
        );

        await preview.renderFrame(template.render as RenderFn, ctx);
      } catch (err) {
        const newError = err instanceof Error ? err : new Error(String(err));
        setError(newError);
        setStatus("Render error");
      }
    },
    [template, preview.ready, fps, previewWidth, previewHeight, player.state.totalFrames, preview]
  );

  // Public render frame function
  const renderFrame = useCallback(
    async (frame: number) => {
      await renderFrameInternal(frame);
    },
    [renderFrameInternal]
  );

  // Compile helper
  const compile = useCallback(
    async (code: string) => {
      setError(null);
      setDirectTemplate(null);
      const result = await compiler.compile(code);
      if (result.error) {
        setError(new Error(result.error.message));
        setStatus("Compile error");
      } else {
        setStatus("Ready");
        player.clearCache();
      }
    },
    [compiler, player]
  );

  // Set template directly
  const setTemplate = useCallback((tmpl: TemplateModule) => {
    setError(null);
    compiler.clear();
    setDirectTemplate(tmpl);
    setStatus("Ready");
    player.clearCache();
  }, [compiler, player]);

  // Set preview format (clears cache)
  const setPreviewFormat = useCallback((format: FormatOption) => {
    setPreviewFormatState(format);
    player.clearCache();
  }, [player]);

  // Export helper - can export at any format
  const exportMp4 = useCallback(async (options?: { format?: FormatOption }) => {
    const canvas = effectiveCanvasRef.current;
    if (!canvas || !template) return null;

    const exportFormat = options?.format ?? previewFormat;
    const { width: exportWidth, height: exportHeight } = resolveFormat(exportFormat);

    // Create a temporary canvas for export if dimensions differ
    let exportCanvas = canvas;
    if (exportWidth !== canvas.width || exportHeight !== canvas.height) {
      exportCanvas = document.createElement("canvas");
      exportCanvas.width = exportWidth;
      exportCanvas.height = exportHeight;
    }

    // Create a render function that renders at export resolution
    const renderAtExportSize = async (frame: number) => {
      if (!template) return;

      const ctx = createRenderContext(
        frame,
        fps,
        player.state.totalFrames,
        exportWidth,
        exportHeight,
        {}
      );

      const html = (template.render as RenderFn)(ctx);

      // Use the preview sink's renderer but draw to export canvas
      if (preview.sink) {
        const imageData = await preview.sink.renderFrame(
          () => html,
          ctx
        );

        // If using temp canvas, copy the result
        if (exportCanvas !== canvas) {
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = imageData.width;
          tempCanvas.height = imageData.height;
          const tempCtx = tempCanvas.getContext("2d")!;
          tempCtx.putImageData(imageData, 0, 0);

          const exportCtx = exportCanvas.getContext("2d")!;
          exportCtx.drawImage(tempCanvas, 0, 0, exportWidth, exportHeight);
        }
      }
    };

    return exportHook.exportMp4(
      exportCanvas,
      {
        fps,
        durationSeconds: config.duration,
        width: exportWidth,
        height: exportHeight,
        encoding: config.encoding,
      },
      renderAtExportSize
    );
  }, [
    effectiveCanvasRef,
    template,
    exportHook,
    fps,
    previewFormat,
    config.duration,
    player.state.totalFrames,
    preview.sink,
  ]);

  // Export multiple formats sequentially
  const exportMultiple = useCallback(async (outputs: ExportOutput[]) => {
    const results = new Map<string, Blob>();

    for (const output of outputs) {
      setStatus(`Exporting ${output.filename}...`);
      const blob = await exportMp4({ format: output.format });
      if (blob) {
        results.set(output.filename, blob);
        exportHook.download(blob, output.filename);
      }
    }

    setStatus("Ready");
    return results;
  }, [exportMp4, exportHook]);

  // Set canvas (for VideoCanvas component)
  const setCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    internalCanvasRef.current = canvas;
  }, []);

  // Re-render when preview becomes ready or template changes
  useEffect(() => {
    if (preview.ready && template) {
      renderFrameInternal(player.state.currentFrame);
    }
  }, [preview.ready, template]);

  // Update player config when duration changes
  useEffect(() => {
    player.updateConfig({ durationSeconds: config.duration });
  }, [config.duration, player.updateConfig]);

  // Clear cache when preview format changes (handled by setPreviewFormat)

  // Compute derived state
  const ready = preview.ready && template !== null;
  const currentStatus = exportHook.exporting ? exportHook.status ?? status : status;

  return {
    // State
    ready,
    status: currentStatus,
    error: error ?? (compiler.error ? new Error(compiler.error.message) : null),

    // Player controls
    isPlaying: player.state.isPlaying,
    currentFrame: player.state.currentFrame,
    totalFrames: player.state.totalFrames,
    progress:
      player.state.currentFrame /
      Math.max(1, player.state.totalFrames - 1),
    play: player.play,
    pause: player.pause,
    togglePlayPause: player.togglePlayPause,
    seek: player.seek,

    // Template
    compile,
    setTemplate,
    template,

    // Rendering
    renderFrame,

    // Export
    exporting: exportHook.exporting,
    exportProgress: exportHook.progress,
    exportMp4,
    exportMultiple,
    download: exportHook.download,

    // For Timeline component
    store: player.store,

    // Canvas management
    setCanvas,

    // Preview format
    previewFormat,
    setPreviewFormat,
    previewWidth,
    previewHeight,
    fps,
  };
}
