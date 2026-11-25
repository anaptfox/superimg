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
  type NormalizedCue,
  type PlayerInput,
  type LoadResult,
  type PlaybackMode,
  type HoverBehavior,
  type DriveSource,
} from "@superimg/player";
import {
  type AssetMeta,
  type CanvasSize,
  type EncodingOptions,
  type LoadMode,
  type ResolveBreakdown,
  type ResolveCueFinding,
} from "@superimg/types";
import type { RuntimeStore } from "@superimg/media";
import { VideoControls } from "./VideoControls.js";
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

export interface PassivePlayerProps {
  ref?: Ref<PlayerRef>;
  media?: PlayerInput;
  data?: Record<string, unknown>;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  /** Internal authoring-shell signal; the passive entry never compiles source. */
  compilePending?: boolean;
  size?: CanvasSize;
  /** Override media duration in seconds */
  duration?: number;
  /** Override frames per second */
  fps?: number;
  playbackMode?: PlaybackMode;
  loadMode?: LoadMode;
  hoverBehavior?: HoverBehavior;
  /** Scroll or pointer seeks the timeline. Springs are fixed. */
  drive?: DriveSource;
  hoverDelayMs?: number;
  /**
   * On hover leave (default: `"pause"` — keep the painted frame).
   * `"reset"` seeks to frame 0 (often a blank intro). Prefer pause.
   */
  hoverResetBehavior?: "reset" | "pause";
  /**
   * Docs/gallery embeds: autoplay **once**, rest on the **first** frame, then
   * hover to loop. Leave pauses on the first frame (or current if `hoverResetBehavior` is pause mid-loop).
   *
   * Implies hover-to-play after the first complete play. Use with `autoPlay`.
   */
  onceThenHover?: boolean;
  className?: string;
  style?: CSSProperties;
  /**
   * Built-in controls:
   * - false: canvas only
   * - "minimal": play/pause
   * - true: play + timeline + time
   * - "full": play + timeline + time + export
   */
  controls?: PlayerControlsMode;
  showTime?: boolean;
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
  /** Runtime render/load failures (e.g. throw inside template `render()`). */
  onError?: (error: Error) => void;
  onFrame?: (frame: number) => void;
  /** Emitted on load and every rendered frame with `(currentSeconds, totalDurationSeconds)`. */
  onTimeChange?: (seconds: number, duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  /** Seek to this timestamp (in seconds) immediately after initial load. */
  initialSeconds?: number;
  /** Enable WebAudio preview playback when the loaded media declares `audio` (default `true`). */
  audio?: boolean;
  /** Mute or unmute WebAudio preview playback (default `false`). */
  muted?: boolean;
  /** WebAudio master volume 0..1 (default `1`). */
  volume?: number;
  /**
   * Media composite policy: `"render-only"` (prod default) | `"dev"` (playground / islands).
   */
  playerMode?: "render-only" | "dev";
}

export interface PlayerRef {
  player: CorePlayer | null;
  store: RuntimeStore | null;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (to: { frame: number } | { progress: number } | { seconds: number }) => Promise<void>;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  readonly isMuted: boolean;
  readonly volume: number;
  getCues: () => readonly NormalizedCue[];
  getCueFindings: () => readonly ResolveCueFinding[];
  getBreakdown: () => ResolveBreakdown | null;
  /** Return the currently accepted composite HTML snapshot (or null before first paint). */
  captureStillHtml: () => string | null;
  update: (update: {
    data?: Record<string, unknown>;
    size?: CanvasSize;
    duration?: number;
    fps?: number;
    assets?: Record<string, AssetMeta>;
    assetResolver?: (filename: string) => string;
  }) => Promise<void>;
  isReady: boolean;
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
}

export function PassivePlayer({
  ref,
  media: mediaProp,
  data,
  assets,
  assetResolver,
  compilePending = false,
  size,
  duration,
  fps,
  playbackMode = "loop",
  loadMode = "eager",
  hoverBehavior = "none",
  drive,
  hoverDelayMs = 200,
  hoverResetBehavior = "pause",
  onceThenHover = false,
  className,
  style,
  controls,
  showTime,
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
  onError,
  onFrame,
  onTimeChange,
  onPlay,
  onPause,
  onEnded,
  autoPlay,
  initialSeconds,
  audio,
  muted,
  volume,
  playerMode = "render-only",
}: PassivePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<CorePlayer | null>(null);
  const hoverTimeoutRef = useRef<number | undefined>(undefined);
  /** onceThenHover: first full play finished; hover may loop after this. */
  const firstPlayDoneRef = useRef(false);
  const hoveringRef = useRef(false);
  const [firstPlayDone, setFirstPlayDone] = useState(false);

  const effectiveHover =
    drive || (hoverBehavior === "none" && !onceThenHover)
      ? ("none" as const)
      : ("play" as const);
  // First pass is always "once" so we land on the last frame as rest poster.
  const mountPlaybackMode = onceThenHover
    ? "once"
    : effectiveHover !== "none"
      ? "loop"
      : playbackMode;
  const [isReady, setIsReady] = useState(false);
  /** True while player.load() is in flight — drives shimmer independently of isReady. */
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [store, setStore] = useState<RuntimeStore | null>(null);

  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onEndedRef = useRef(onEnded);
  const onFrameRef = useRef(onFrame);
  const onTimeChangeRef = useRef(onTimeChange);
  const onStoreRef = useRef(onStore);
  const initialSecondsRef = useRef(initialSeconds);

  onLoadRef.current = onLoad;
  onErrorRef.current = onError;
  onPlayRef.current = onPlay;
  onPauseRef.current = onPause;
  onEndedRef.current = onEnded;
  onFrameRef.current = onFrame;
  onTimeChangeRef.current = onTimeChange;
  onStoreRef.current = onStore;
  initialSecondsRef.current = initialSeconds;

  useEffect(() => {
    ensureShimmerStyle();
  }, []);

  const media = mediaProp;
  // Presence selects authored sizing versus an explicit override. Dimensions
  // within an override are transactional updates, not a new player lifetime.
  const hasExplicitSize = size !== undefined;
  const sizeWidth = size?.width;
  const sizeHeight = size?.height;
  const latestPropsRef = useRef({ data, assets, assetResolver, size, duration, fps });
  const reconcilePropsRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    latestPropsRef.current = {
      data, assets, assetResolver, duration, fps,
      size: sizeWidth !== undefined && sizeHeight !== undefined
        ? { width: sizeWidth, height: sizeHeight }
        : undefined,
    };
  }, [data, assets, assetResolver, sizeWidth, sizeHeight, duration, fps]);

  /** Shimmer until compile finishes and the first frame has actually been presented. */
  const showShimmer = compilePending || isLoading;

  const notifyStore = useCallback((next: RuntimeStore | null) => {
    setStore(next);
    onStoreRef.current?.(next);
  }, []);

  // Mount / reload only when template or structural options change
  useEffect(() => {
    if (!containerRef.current || !media) {
      setIsReady(false);
      setIsLoading(false);
      return;
    }

    firstPlayDoneRef.current = false;
    setFirstPlayDone(false);
    hoveringRef.current = false;

    const player = new CorePlayer({
      container: containerRef.current,
      ...(size !== undefined ? { size } : {}),
      playbackMode: drive ? "once" : mountPlaybackMode,
      // React owns hover; core HoverController stays off unless drive is set.
      hoverBehavior: "none",
      hoverDelayMs,
      hoverLeaveBehavior: hoverResetBehavior,
      playerMode,
      ...(audio !== undefined ? { audio } : {}),
      ...(muted !== undefined ? { muted } : {}),
      ...(volume !== undefined ? { volume } : {}),
      ...(drive !== undefined ? { drive } : {}),
    });

    playerRef.current = player;
    setIsLoading(true);
    setIsReady(false);

    player.on("play", () => {
      setIsPlaying(true);
      onPlayRef.current?.();
    });

    player.on("pause", () => {
      setIsPlaying(false);
      onPauseRef.current?.();
    });

    player.on("ended", () => {
      // onceThenHover: first completion → rest on first frame.
      // Clear hovering so we never auto-restart without a new pointer enter.
      if (onceThenHover && !firstPlayDoneRef.current) {
        firstPlayDoneRef.current = true;
        setFirstPlayDone(true);
        hoveringRef.current = false;
        player.pause();
        void player.seek({ frame: 0 });
        onEndedRef.current?.();
        return;
      }
      // onceThenHover + actively hovering → continue looping
      if (onceThenHover && hoveringRef.current) {
        void player.seek({ frame: 0 });
        player.play();
        return;
      }
      onEndedRef.current?.();
    });

    player.on("frame", (frame) => {
      onFrameRef.current?.(frame);
      onTimeChangeRef.current?.(player.currentTimeSeconds, player.totalDurationSeconds);
    });

    let updateErrors: Set<unknown> | undefined;
    player.on("error", (error) => {
      updateErrors?.add(error);
      onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)));
    });

    let cancelled = false;

    const isCurrentPlayer = () => !cancelled && playerRef.current === player;
    const mountedSize = size !== undefined ? { width: size.width, height: size.height } : undefined;
    let requestedProps = latestPropsRef.current;
    let propsUpdate: Promise<void> | undefined;
    const reconcileProps = (): Promise<void> => {
      if (propsUpdate) return propsUpdate;
      propsUpdate = (async () => {
        while (isCurrentPlayer() && player.isReady) {
          const next = latestPropsRef.current;
          // Match React's dependency equality, including a rejected NaN input:
          // the same invalid numeric snapshot must not retry indefinitely.
          if (Object.is(next.size?.width, requestedProps.size?.width) &&
              Object.is(next.size?.height, requestedProps.size?.height) &&
              next.data === requestedProps.data && next.assets === requestedProps.assets &&
              next.assetResolver === requestedProps.assetResolver &&
              Object.is(next.duration, requestedProps.duration) && Object.is(next.fps, requestedProps.fps)) return;
          // Remember the attempt before awaiting it. A failed update leaves the
          // accepted frame intact and is reported once, rather than retrying on
          // every render. A newer prop snapshot can still be applied afterward.
          requestedProps = next;
          updateErrors = new Set();
          try {
            await player.update({
              ...(next.data !== undefined ? { data: next.data } : {}),
              ...(next.assets !== undefined ? { assets: next.assets } : {}),
              ...(next.assetResolver !== undefined ? { assetResolver: next.assetResolver } : {}),
              ...(next.size !== undefined ? { size: next.size } : {}),
              ...(next.duration !== undefined ? { duration: next.duration } : {}),
              ...(next.fps !== undefined ? { fps: next.fps } : {}),
            });
          } catch (error) {
            // Core forwards presentation errors as events as well as rejecting
            // update(). Only report promise-only failures here.
            if (isCurrentPlayer() && !updateErrors.has(error)) {
              onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)));
            }
          } finally {
            updateErrors = undefined;
          }
        }
      })().finally(() => { propsUpdate = undefined; });
      return propsUpdate;
    };
    reconcilePropsRef.current = reconcileProps;

    const loadPlayer = async () => {
      if (!isCurrentPlayer()) return;

      const snap = latestPropsRef.current;
      // load() receives current data, but constructor dimensions and authored
      // timing. Reconcile anything that changed before first acceptance.
      requestedProps = { ...snap, size: mountedSize, duration: undefined, fps: undefined };
      const loadOpts = {
        ...(snap.data !== undefined ? { data: snap.data } : {}),
        ...(snap.assets !== undefined ? { assets: snap.assets } : {}),
        ...(snap.assetResolver !== undefined ? { assetResolver: snap.assetResolver } : {}),
        playerMode,
      };
      try {
        // load() awaits session.mount → first present() (iframe paint) → ready
        const result = await player.load(media, loadOpts);
        if (!isCurrentPlayer()) {
          // CorePlayer.load() can assign and mount its session after the effect's
          // cleanup disposed the still-loading player. Dispose again so that
          // late session cannot leave an iframe in the current container.
          player.dispose();
          return;
        }

        const loaded = result.status === "success";
        if (loaded) {
          await reconcileProps();
          if (!isCurrentPlayer()) {
            player.dispose();
            return;
          }
        }
        setIsReady(loaded);
        if (loaded) {
          // Pin once mode after load so the session clock cannot stay on loop.
          if (onceThenHover) {
            player.playbackMode = "once";
          }
          const runtimeStore = player.store;
          notifyStore(runtimeStore);
          const startAt = initialSecondsRef.current;
          if (startAt !== undefined && Number.isFinite(startAt) && startAt > 0 && !drive) {
            await player.seek({ seconds: startAt });
            if (!isCurrentPlayer()) {
              player.dispose();
              return;
            }
          }
          onTimeChangeRef.current?.(player.currentTimeSeconds, player.totalDurationSeconds);
          if (autoPlay && !drive) {
            // Ensure we start from frame 0 for a clean once-through
            if (onceThenHover) {
              void player.seek({ frame: 0 });
            }
            player.play();
          }
        } else {
          notifyStore(null);
        }
        onLoadRef.current?.(result);
      } catch (err) {
        if (!isCurrentPlayer()) {
          player.dispose();
          return;
        }
        setIsReady(false);
        notifyStore(null);
        onLoadRef.current?.({
          status: "error",
          errorType: "validation",
          message: err instanceof Error ? err.message : String(err),
          suggestion: "Fix the media definition and try loading it again.",
        });
      } finally {
        // Always drop shimmer when the load attempt finishes (success or error).
        if (isCurrentPlayer()) {
          setIsLoading(false);
        }
      }
    };

    const disposePlayer = () => {
      cancelled = true;
      player.dispose();
      if (playerRef.current === player) {
        playerRef.current = null;
      }
      if (reconcilePropsRef.current === reconcileProps) {
        reconcilePropsRef.current = null;
      }
      notifyStore(null);
      setIsReady(false);
      setIsLoading(false);
      setIsPlaying(false);
    };

    if (loadMode === "lazy") {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            void loadPlayer();
            observer.disconnect();
          }
        },
        { rootMargin: "100px" },
      );
      observer.observe(containerRef.current);
      return () => {
        observer.disconnect();
        disposePlayer();
      };
    }

    // React StrictMode immediately cleans up and re-runs effects once in
    // development. Deferring eager startup lets that probe cancel before
    // CorePlayer.load() begins creating a media session.
    queueMicrotask(() => {
      void loadPlayer();
    });

    return () => {
      disposePlayer();
    };
  }, [
    media,
    hasExplicitSize,
    mountPlaybackMode,
    loadMode,
    effectiveHover,
    hoverDelayMs,
    hoverResetBehavior,
    onceThenHover,
    autoPlay,
    drive,
    audio,
    playerMode,
    notifyStore,
  ]);

  useEffect(() => {
    if (muted !== undefined) playerRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    if (volume !== undefined) playerRef.current?.setVolume(volume);
  }, [volume]);

  // One serialized hot-update path keeps simultaneous data/size changes atomic
  // and drains the latest props if they change during a pending presentation.
  useEffect(() => {
    void reconcilePropsRef.current?.();
  }, [
    data,
    assets,
    assetResolver,
    sizeWidth,
    sizeHeight,
    duration,
    fps,
  ]);

  const handleMouseEnter = useCallback(() => {
    if (effectiveHover === "none" || !isReady || !playerRef.current) return;
    // onceThenHover: do not arm hover until the intro once-play has finished
    if (onceThenHover && !firstPlayDoneRef.current) return;
    hoveringRef.current = true;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      if (!hoveringRef.current || !playerRef.current) return;
      // From last frame, play() restarts at 0 (runtime contract)
      playerRef.current.play();
    }, hoverDelayMs);
  }, [effectiveHover, hoverDelayMs, isReady, onceThenHover]);

  const handleMouseLeave = useCallback(() => {
    if (effectiveHover === "none") return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = undefined;
    }
    hoveringRef.current = false;
    // onceThenHover intro: never interrupt the first full autoplay
    if (onceThenHover && !firstPlayDoneRef.current) return;
    if (isReady && playerRef.current) {
      playerRef.current.pause();
      // onceThenHover always returns to first frame when leaving a hover loop
      if (onceThenHover || hoverResetBehavior === "reset") {
        void playerRef.current.seek({ frame: 0 });
      }
    }
  }, [effectiveHover, hoverResetBehavior, isReady, onceThenHover]);

  const handleClick = useCallback(() => {
    if (effectiveHover !== "none" || !isReady || !store) return;
    store.togglePlayPause();
  }, [effectiveHover, isReady, store]);

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
      togglePlayPause: () => {
        const p = playerRef.current;
        if (!p) return;
        if (p.isPlaying) p.pause();
        else p.play();
      },
      seek: (to) => playerRef.current?.seek(to) ?? Promise.resolve(),
      setMuted: (nextMuted) => playerRef.current?.setMuted(nextMuted),
      setVolume: (nextVolume) => playerRef.current?.setVolume(nextVolume),
      get isMuted() {
        return playerRef.current?.isMuted ?? (muted ?? false);
      },
      get volume() {
        return playerRef.current?.volume ?? (volume ?? 1);
      },
      getCues: () => playerRef.current?.getCues() ?? [],
      getCueFindings: () => playerRef.current?.getCueFindings() ?? [],
      getBreakdown: () => playerRef.current?.getBreakdown() ?? null,
      captureStillHtml: () => playerRef.current?.getPresentation().accepted?.compositeHtml ?? null,
      update: (update) => playerRef.current?.update(update) ?? Promise.resolve(),
    }),
    [isReady, isPlaying, store, muted, volume],
  );

  const hasControls = !!controls && !!store;
  const isMinimal = controls === "minimal";
  const isFull = controls === "full";
  const showTimeline = controls === true || isFull;
  const resolvedShowTime = showTime ?? (controls === true || isFull);
  const resolvedShowExport = showExport ?? (isFull && !!onExportProp && !!onDownloadProp);

  const resolvedExporting = exportingProp ?? false;
  const resolvedExportProgress = exportProgressProp ?? 0;

  const hoverArmed =
    effectiveHover === "play" &&
    isReady &&
    (!onceThenHover || firstPlayDone);
  const showHoverPlayOverlay = hoverArmed && !isPlaying;
  const clickable = effectiveHover === "none" && isReady;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        ...style,
        // Hover must sit on the outer box — iframe is pointer-events:none but
        // nested absolute layers still steal hit-testing if handlers are deeper.
        cursor: clickable || hoverArmed ? "pointer" : (style?.cursor ?? "default"),
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={clickable ? handleClick : undefined}
    >
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          flex: 1,
          minHeight: 0,
          // Stage chrome: match film underfill, never UA white letterbox bars.
          background: "#07070c",
          overflow: "hidden",
        }}
      >
        {showShimmer && (
          <div
            aria-hidden="true"
            data-superimg-shimmer=""
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
          showExport={resolvedShowExport}
          {...(onExportProp !== undefined ? { onExport: onExportProp } : {})}
          {...(onDownloadProp !== undefined ? { onDownload: onDownloadProp } : {})}
          exporting={resolvedExporting}
          exportProgress={resolvedExportProgress}
          {...(size !== undefined ? { currentSize: size } : {})}
          {...(exportDialogOpen !== undefined ? { exportDialogOpen } : {})}
          {...(onExportDialogOpenChange !== undefined
            ? { onExportDialogOpenChange }
            : {})}
        />
      )}
    </div>
  );
}
