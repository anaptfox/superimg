//! Combined hook for video session management
//! Reduces boilerplate by orchestrating player, compiler, preview, and export

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from "react";
import {
  createRenderContext,
  resolveFormat,
  type PlayerStore,
  type TemplateModule,
  type EncodingOptions,
  type FormatOption,
} from "superimg/browser";
import { usePlayer } from "./usePlayer.js";
import { useCompiler } from "./useCompiler.js";
import { usePreview, type RenderFn } from "./usePreview.js";
import { useExport } from "./useExport.js";


/** Export output configuration */
export interface ExportOutput {
  format: FormatOption;
  filename: string;
}

export interface VideoSessionConfig {
  /** Container ref for preview rendering */
  containerRef?: RefObject<HTMLDivElement | null>;
  /** Duration in seconds - reactive, can change after mount */
  duration: number;
  /** Frames per second (default: 30) */
  fps?: number;
  /** Initial format (default: "vertical") */
  initialFormat?: FormatOption;
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
  /** Set template data (merged with template.defaults, overrides on conflict) */
  setData: (data: Record<string, unknown>) => void;
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
  /** Export video to blob at specified format and encoding (defaults to current format) */
  exportMp4: (options?: { format?: FormatOption; encoding?: EncodingOptions }) => Promise<Blob | null>;
  /** Export to multiple formats sequentially */
  exportMultiple: (outputs: ExportOutput[]) => Promise<Map<string, Blob>>;
  /** Download a blob with the given filename */
  download: (blob: Blob, filename: string) => void;

  // For Timeline component
  /** Underlying player store for Timeline component */
  store: PlayerStore;

  // Container management (for VideoCanvas component)
  /** Set the container element (used by VideoCanvas component) */
  setContainer: (el: HTMLElement | null) => void;

  // Format (mutable)
  /** Current format */
  format: FormatOption;
  /** Change the format (re-renders at new dimensions) */
  setFormat: (format: FormatOption) => void;
  /** Current width in pixels (derived from format) */
  width: number;
  /** Current height in pixels (derived from format) */
  height: number;
  /** Frames per second */
  fps: number;
}

/**
 * Hook for managing a complete video session.
 *
 * Templates render at logical dimensions (e.g., 1920x1080) and scale
 * via CSS transform to fit the container while maintaining aspect ratio.
 *
 * @example
 * ```tsx
 * function MyVideoEditor() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const session = useVideoSession({
 *     containerRef,
 *     duration: 5,
 *     initialFormat: "vertical",
 *   });
 *
 *   // Change format
 *   session.setFormat("horizontal");
 *
 *   // Export at different format than preview
 *   const handleExport = async () => {
 *     const blob = await session.exportMp4({ format: "youtube.video.short" });
 *     if (blob) session.download(blob, "export.mp4");
 *   };
 *
 *   return (
 *     <div>
 *       <div ref={containerRef} style={{ width: 400, height: 300 }} />
 *       <Timeline store={session.store} showTime />
 *     </div>
 *   );
 * }
 * ```
 */
export function useVideoSession(config: VideoSessionConfig): VideoSessionReturn {
  const fps = config.fps ?? 30;

  // Format state (mutable)
  const [format, setFormatState] = useState<FormatOption>(
    config.initialFormat ?? "vertical"
  );

  // Derive dimensions from format
  const { width, height } = resolveFormat(format);

  // Internal container ref management (for VideoCanvas component)
  const internalContainerRef = useRef<HTMLElement | null>(null);
  const effectiveContainerRef = config.containerRef ?? internalContainerRef;

  // Status and error state
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState<Error | null>(null);

  // Template state (for setTemplate)
  const [directTemplate, setDirectTemplate] = useState<TemplateModule | null>(null);

  // External data (ref to avoid stale closures in frame callback)
  const dataRef = useRef<Record<string, unknown>>({});

  // Internal hooks
  const player = usePlayer({
    fps,
    durationSeconds: config.duration,
    onFrameChange: (frame) => {
      renderFrameInternal(frame);
    },
  });

  const compiler = useCompiler();
  const preview = usePreview(effectiveContainerRef);
  const exportHook = useExport();

  // Effective template (from compiler or direct)
  const template = directTemplate ?? compiler.template;

  // Render a frame to the preview at current format dimensions
  const renderFrameInternal = useCallback(
    async (frame: number) => {
      if (!template || !preview.ready) return;

      try {
        const mergedData = {
          ...(template.defaults ?? {}),
          ...dataRef.current,
        };
        const ctx = createRenderContext(
          frame,
          fps,
          player.state.totalFrames,
          width,
          height,
          mergedData
        );

        await preview.renderFrame(template.render as RenderFn, ctx);
      } catch (err) {
        const newError = err instanceof Error ? err : new Error(String(err));
        setError(newError);
        setStatus("Render error");
      }
    },
    [template, preview.ready, fps, width, height, player.state.totalFrames, preview]
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
  const setTemplate = useCallback(
    (tmpl: TemplateModule) => {
      setError(null);
      compiler.clear();
      setDirectTemplate(tmpl);
      setStatus("Ready");
      player.clearCache();
    },
    [compiler, player]
  );

  // Set template data (merged with template.defaults)
  const setData = useCallback(
    (data: Record<string, unknown>) => {
      dataRef.current = { ...dataRef.current, ...data };
      player.clearCache();
      renderFrameInternal(player.state.currentFrame);
    },
    [player, renderFrameInternal]
  );

  // Set format (clears cache, updates logical size)
  const setFormat = useCallback(
    (newFormat: FormatOption) => {
      setFormatState(newFormat);
      const { width: newWidth, height: newHeight } = resolveFormat(newFormat);
      preview.setLogicalSize(newWidth, newHeight);
      player.clearCache();
    },
    [player, preview]
  );

  // Export helper - can export at any format and encoding
  const exportMp4 = useCallback(
    async (options?: { format?: FormatOption; encoding?: EncodingOptions }) => {
      if (!template) return null;

      const exportFormat = options?.format ?? format;
      const { width: exportWidth, height: exportHeight } =
        resolveFormat(exportFormat);

      // Merge encoding: dialog options override session config
      const encoding: EncodingOptions = {
        ...config.encoding,
        ...options?.encoding,
        video: { ...config.encoding?.video, ...options?.encoding?.video },
        audio: { ...config.encoding?.audio, ...options?.encoding?.audio },
      };

      // Create a temporary canvas for export
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = exportWidth;
      exportCanvas.height = exportHeight;

      // Use CanvasRenderer for export
      const { CanvasRenderer } = await import("superimg/browser");
      const exportRenderer = new CanvasRenderer(exportCanvas);
      await exportRenderer.warmup();

      // Create a render function that renders at export resolution
      const renderAtExportSize = async (frame: number) => {
        if (!template) return;

        const mergedData = {
          ...(template.defaults ?? {}),
          ...dataRef.current,
        };
        const ctx = createRenderContext(
          frame,
          fps,
          player.state.totalFrames,
          exportWidth,
          exportHeight,
          mergedData
        );

        const html = (template.render as RenderFn)(ctx);
        await exportRenderer.renderFrame(() => html, ctx);
      };

      try {
        return await exportHook.exportMp4(
          exportCanvas,
          {
            fps,
            durationSeconds: config.duration,
            width: exportWidth,
            height: exportHeight,
            encoding,
          },
          renderAtExportSize
        );
      } finally {
        await exportRenderer.dispose();
      }
    },
    [template, exportHook, fps, format, config.duration, player.state.totalFrames, config.encoding]
  );

  // Export multiple formats sequentially
  const exportMultiple = useCallback(
    async (outputs: ExportOutput[]) => {
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
    },
    [exportMp4, exportHook]
  );

  // Set container (for VideoCanvas component)
  const setContainer = useCallback((el: HTMLElement | null) => {
    internalContainerRef.current = el;
  }, []);

  // Re-render when preview becomes ready, template changes, or format (width/height) changes
  useEffect(() => {
    if (preview.ready && template) {
      preview.setLogicalSize(width, height);
      renderFrameInternal(player.state.currentFrame);
    }
  }, [preview.ready, template, width, height, renderFrameInternal]);

  // Update player config when duration changes
  useEffect(() => {
    player.updateConfig({ durationSeconds: config.duration });
  }, [config.duration, player.updateConfig]);

  // Compute derived state
  const ready = preview.ready && template !== null;
  const currentStatus = exportHook.exporting
    ? exportHook.status ?? status
    : status;

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
      player.state.currentFrame / Math.max(1, player.state.totalFrames - 1),
    play: player.play,
    pause: player.pause,
    togglePlayPause: player.togglePlayPause,
    seek: player.seek,

    // Template
    compile,
    setTemplate,
    setData,
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

    // Container management
    setContainer,

    // Format
    format,
    setFormat,
    width,
    height,
    fps,
  };
}
