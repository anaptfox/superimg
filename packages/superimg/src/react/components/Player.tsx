//! Player - React component for SuperImg
//! Renders templates with playback controls, hover behavior, and ref-based imperative API
"use client";

import {
  useRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  type Ref,
  type CSSProperties,
} from "react";
import {
  Player as CorePlayer,
  type PlayerInput,
  type LoadResult,
  type PlaybackMode,
  type LoadMode,
  type HoverBehavior,
  type FormatOption,
} from "../../index.player.js";
import {
  isComposedTemplate,
  type AssetMeta,
  type RuntimeStore,
  type CompileError,
  type EncodingOptions,
  type TemplateModule,
} from "../../index.browser.js";
import { VideoControls } from "./VideoControls.js";
import { useCompiledTemplate } from "../hooks/useCompiledTemplate.js";
import { usePlaygroundExport } from "../hooks/usePlaygroundExport.js";
import type { ExportOptions } from "./ExportDialog.js";

let shimmerInjected = false;
function ensureShimmerStyle() {
  if (shimmerInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = `@keyframes superimg-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`;
  document.head.appendChild(style);
  shimmerInjected = true;
}

export type PlayerControlsMode = boolean | "minimal" | "full";

export interface PlayerProps {
  ref?: Ref<PlayerRef>;
  template?: PlayerInput;
  code?: string;
  bundled?: string;
  wasmCompile?: boolean;
  data?: Record<string, unknown>;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  compileDebounceMs?: number;
  onCompiling?: (compiling: boolean) => void;
  onCompileError?: (error: CompileError) => void;
  format?: FormatOption;
  /** Override scene duration in seconds */
  duration?: number;
  /** Override frames per second */
  fps?: number;
  playbackMode?: PlaybackMode;
  loadMode?: LoadMode;
  hoverBehavior?: HoverBehavior;
  hoverDelayMs?: number;
  hoverResetBehavior?: "reset" | "pause";
  className?: string;
  style?: CSSProperties;
  /**
   * Built-in controls:
   * - false: canvas only
   * - "minimal": play/pause
   * - true: play + timeline + time
   * - "full": play + timeline + time + format + export
   */
  controls?: PlayerControlsMode;
  showTime?: boolean;
  showFormat?: boolean;
  showExport?: boolean;
  encoding?: EncodingOptions;
  onExport?: (options: ExportOptions) => Promise<Blob | null>;
  onDownload?: (blob: Blob, filename: string) => void;
  exporting?: boolean;
  exportProgress?: number;
  exportDialogOpen?: boolean;
  onExportDialogOpenChange?: (open: boolean) => void;
  onStore?: (store: RuntimeStore | null) => void;
  onLoad?: (result: LoadResult) => void;
  onFrame?: (frame: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  autoPlay?: boolean;
}

export interface PlayerRef {
  player: CorePlayer | null;
  store: RuntimeStore | null;
  play: () => void;
  pause: () => void;
  seekFrame: (frame: number) => void;
  seekProgress: (progress: number) => void;
  seekTimeSeconds: (seconds: number) => void;
  update: (update: {
    data?: Record<string, unknown>;
    format?: FormatOption;
    duration?: number;
    fps?: number;
    assets?: Record<string, AssetMeta>;
    assetResolver?: (filename: string) => string;
  }) => void;
  isReady: boolean;
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
}

export function Player({
  ref,
  template: templateProp,
  code,
  bundled,
  wasmCompile = true,
  data,
  assets,
  assetResolver,
  compileDebounceMs = 300,
  onCompiling,
  onCompileError,
  format: formatProp,
  duration,
  fps,
  playbackMode = "loop",
  loadMode = "eager",
  hoverBehavior = "none",
  hoverDelayMs = 200,
  hoverResetBehavior = "reset",
  className,
  style,
  controls,
  showTime,
  showFormat,
  showExport,
  encoding,
  onExport: onExportProp,
  onDownload: onDownloadProp,
  exporting: exportingProp,
  exportProgress: exportProgressProp,
  exportDialogOpen,
  onExportDialogOpenChange,
  onStore,
  onLoad,
  onFrame,
  onPlay,
  onPause,
  onEnded,
  autoPlay,
}: PlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<CorePlayer | null>(null);
  const hoverTimeoutRef = useRef<number | undefined>(undefined);
  const loadSnapshotRef = useRef({
    data,
    assets,
    assetResolver,
  });
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [store, setStore] = useState<RuntimeStore | null>(null);
  const [internalFormat, setInternalFormat] = useState<FormatOption>(
    formatProp ?? "horizontal",
  );

  const onLoadRef = useRef(onLoad);
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onEndedRef = useRef(onEnded);
  const onFrameRef = useRef(onFrame);
  const onStoreRef = useRef(onStore);

  onLoadRef.current = onLoad;
  onPlayRef.current = onPlay;
  onPauseRef.current = onPause;
  onEndedRef.current = onEnded;
  onFrameRef.current = onFrame;
  onStoreRef.current = onStore;

  const ownsFormatState = controls === "full";
  const effectiveFormat = ownsFormatState ? internalFormat : formatProp;

  useEffect(() => {
    if (formatProp !== undefined) {
      setInternalFormat(formatProp);
    }
  }, [formatProp]);

  useEffect(() => {
    ensureShimmerStyle();
  }, []);

  const {
    template: compiledTemplate,
    compiling,
    error: compileError,
  } = useCompiledTemplate({
    code: code ?? "",
    ...(bundled !== undefined ? { bundled } : {}),
    wasmCompile,
    debounceMs: compileDebounceMs,
    enabled: !!code || (!!bundled && !wasmCompile),
  });

  useEffect(() => {
    onCompiling?.(compiling);
  }, [compiling, onCompiling]);

  useEffect(() => {
    if (compileError) {
      onCompileError?.(compileError);
    }
  }, [compileError, onCompileError]);

  const template = templateProp ?? compiledTemplate;
  const exportTemplate =
    template && !isComposedTemplate(template)
      ? (template as TemplateModule)
      : null;

  const builtInExport = usePlaygroundExport({
    template: controls === "full" && !onExportProp ? exportTemplate : null,
    data: data ?? {},
    ...(fps !== undefined ? { fps } : {}),
    ...(encoding !== undefined ? { encoding } : {}),
  });

  const isLoading = compiling || (!!template && !isReady);

  const notifyStore = useCallback((next: RuntimeStore | null) => {
    setStore(next);
    onStoreRef.current?.(next);
  }, []);

  // Mount / reload only when template or structural options change
  useEffect(() => {
    if (!containerRef.current || !template) return;

    loadSnapshotRef.current = { data, assets, assetResolver };

    const player = new CorePlayer({
      container: containerRef.current,
      ...(effectiveFormat !== undefined ? { format: effectiveFormat } : {}),
      playbackMode: hoverBehavior !== "none" ? "loop" : playbackMode,
      loadMode,
      hoverBehavior: "none",
      hoverDelayMs,
    });

    playerRef.current = player;

    player.on("play", () => {
      setIsPlaying(true);
      onPlayRef.current?.();
    });

    player.on("pause", () => {
      setIsPlaying(false);
      onPauseRef.current?.();
    });

    player.on("ended", () => {
      onEndedRef.current?.();
    });

    player.on("frame", (frame) => {
      onFrameRef.current?.(frame);
    });

    const loadPlayer = async () => {
      const snap = loadSnapshotRef.current;
      const loadOpts = {
        ...(snap.data !== undefined ? { data: snap.data } : {}),
        ...(snap.assets !== undefined ? { assets: snap.assets } : {}),
        ...(snap.assetResolver !== undefined ? { assetResolver: snap.assetResolver } : {}),
      };
      const result = await player.load(template, loadOpts);
      const loaded = result.status === "success";
      setIsReady(loaded);
      if (loaded) {
        const runtimeStore = player.getRuntimeStore();
        notifyStore(runtimeStore);
        if (duration !== undefined || fps !== undefined) {
          player.update({
            ...(duration !== undefined ? { duration } : {}),
            ...(fps !== undefined ? { fps } : {}),
          });
        }
        if (autoPlay) {
          player.play();
        }
      } else {
        notifyStore(null);
      }
      onLoadRef.current?.(result);
    };

    if (loadMode === "lazy") {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            loadPlayer();
            observer.disconnect();
          }
        },
        { rootMargin: "100px" },
      );
      observer.observe(containerRef.current);
      return () => {
        observer.disconnect();
        player.dispose();
        playerRef.current = null;
        notifyStore(null);
        setIsReady(false);
        setIsPlaying(false);
      };
    }

    loadPlayer();

    return () => {
      player.dispose();
      playerRef.current = null;
      notifyStore(null);
      setIsReady(false);
      setIsPlaying(false);
    };
  }, [
    template,
    effectiveFormat,
    playbackMode,
    loadMode,
    hoverBehavior,
    hoverDelayMs,
    autoPlay,
    notifyStore,
  ]);

  // Hot-update runtime without remounting
  useEffect(() => {
    if (!playerRef.current?.isReady) return;
    playerRef.current.update({
      ...(data !== undefined ? { data } : {}),
      ...(assets !== undefined ? { assets } : {}),
      ...(assetResolver !== undefined ? { assetResolver } : {}),
      ...(effectiveFormat !== undefined ? { format: effectiveFormat } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(fps !== undefined ? { fps } : {}),
    });
  }, [data, assets, assetResolver, effectiveFormat, duration, fps]);

  const handleMouseEnter = useCallback(() => {
    if (hoverBehavior === "none" || !playerRef.current?.isReady) return;
    hoverTimeoutRef.current = window.setTimeout(() => {
      playerRef.current?.play();
    }, hoverDelayMs);
  }, [hoverBehavior, hoverDelayMs]);

  const handleMouseLeave = useCallback(() => {
    if (hoverBehavior === "none") return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (playerRef.current?.isReady) {
      playerRef.current.pause();
      if (hoverResetBehavior === "reset") {
        playerRef.current.seekFrame(0);
      }
    }
  }, [hoverBehavior, hoverResetBehavior]);

  const handleClick = useCallback(() => {
    if (hoverBehavior !== "none" || !isReady || !store) return;
    store.togglePlayPause();
  }, [hoverBehavior, isReady, store]);

  const handleFormatChange = useCallback(
    (next: FormatOption) => {
      if (ownsFormatState) {
        setInternalFormat(next);
      }
      playerRef.current?.update({ format: next });
    },
    [ownsFormatState],
  );

  useImperativeHandle(
    ref,
    () => ({
      player: playerRef.current,
      store,
      isReady,
      isPlaying,
      get currentFrame() {
        return playerRef.current?.currentFrame ?? 0;
      },
      get totalFrames() {
        return playerRef.current?.totalFrames ?? 0;
      },
      play: () => playerRef.current?.play(),
      pause: () => playerRef.current?.pause(),
      seekFrame: (frame: number) => playerRef.current?.seekFrame(frame),
      seekProgress: (progress: number) =>
        playerRef.current?.seekProgress(progress),
      seekTimeSeconds: (seconds: number) =>
        playerRef.current?.seekTimeSeconds(seconds),
      update: (update) => playerRef.current?.update(update),
    }),
    [isReady, isPlaying, store],
  );

  const hasControls = !!controls && !!store;
  const isMinimal = controls === "minimal";
  const isFull = controls === "full";
  const showTimeline = controls === true || isFull;
  const resolvedShowTime = showTime ?? (controls === true || isFull);
  const resolvedShowFormat = showFormat ?? isFull;
  const resolvedShowExport = showExport ?? isFull;

  const handleExport =
    onExportProp ?? (isFull ? builtInExport.exportMp4 : undefined);
  const handleDownload =
    onDownloadProp ?? (isFull ? builtInExport.download : undefined);
  const resolvedExporting = exportingProp ?? (isFull ? builtInExport.exporting : false);
  const resolvedExportProgress =
    exportProgressProp ?? (isFull ? builtInExport.exportProgress : 0);

  const showHoverPlayOverlay = hoverBehavior === "play" && isReady && !isPlaying;
  const clickable = hoverBehavior === "none" && isReady;

  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          flex: 1,
          cursor: clickable ? "pointer" : "default",
        }}
        onClick={clickable ? handleClick : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {isLoading && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)",
              backgroundSize: "200% 100%",
              animation: "superimg-shimmer 1.5s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        )}

        {showHoverPlayOverlay && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="white"
                style={{ marginLeft: 2 }}
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {hasControls && (
        <VideoControls
          store={store}
          showTimeline={!isMinimal && showTimeline}
          showTime={resolvedShowTime}
          showFormat={resolvedShowFormat}
          showExport={resolvedShowExport}
          onExport={handleExport}
          onDownload={handleDownload}
          exporting={resolvedExporting}
          exportProgress={resolvedExportProgress}
          currentFormat={effectiveFormat ?? "horizontal"}
          onFormatChange={handleFormatChange}
          exportDialogOpen={exportDialogOpen}
          onExportDialogOpenChange={onExportDialogOpenChange}
        />
      )}
    </div>
  );
}