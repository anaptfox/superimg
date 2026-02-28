//! Player - React component for SuperImg
//! Renders templates with playback controls, hover behavior, and ref-based imperative API

import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
import {
  Player as CorePlayer,
  type PlayerInput,
  type LoadResult,
  type PlaybackMode,
  type LoadMode,
  type HoverBehavior,
  type FormatOption,
} from "superimg/player";
import type { PlayerStore, CompileError } from "superimg/browser";
import { VideoControls } from "./VideoControls.js";
import { useCompiledTemplate } from "../hooks/useCompiledTemplate.js";

export interface PlayerProps {
  /** Template module to render (use this OR code, not both) */
  template?: PlayerInput;
  /** Raw code string to compile (use this OR template, not both) */
  code?: string;
  /** Debounce delay for code compilation in ms (default: 300) */
  compileDebounceMs?: number;
  /** Called when compilation starts/ends */
  onCompiling?: (compiling: boolean) => void;
  /** Called when compilation fails */
  onCompileError?: (error: CompileError) => void;
  /**
   * Format for rendering - simple alias, stdlib preset path, or custom dimensions.
   * If not provided, uses template config or defaults to 1920x1080.
   * Examples: "vertical", "horizontal", "square", "youtube.video.short", { width: 800, height: 600 }
   */
  format?: FormatOption;
  /** Playback mode (default: 'loop') */
  playbackMode?: PlaybackMode;
  /** Load mode (default: 'eager') */
  loadMode?: LoadMode;
  /** Behavior on hover (default: 'none') */
  hoverBehavior?: HoverBehavior;
  /** Delay before hover behavior triggers, in ms (default: 200) */
  hoverDelayMs?: number;
  /** Maximum frames to cache (default: 30) */
  maxCacheFrames?: number;
  /** Optional CSS class */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Show built-in controls: true = PlayButton + Timeline, "minimal" = PlayButton only */
  controls?: boolean | "minimal";
  /** Called when player is loaded */
  onLoad?: (result: LoadResult) => void;
  /** Called on each frame */
  onFrame?: (frame: number) => void;
  /** Called when playback starts */
  onPlay?: () => void;
  /** Called when playback pauses */
  onPause?: () => void;
  /** Called when playback ends */
  onEnded?: () => void;
  /** Auto-play when template loads successfully (default: false) */
  autoPlay?: boolean;
}

export interface PlayerRef {
  /** The underlying Player instance */
  player: CorePlayer | null;
  /** Play */
  play: () => void;
  /** Pause */
  pause: () => void;
  /** Stop and reset to frame 0 */
  stop: () => void;
  /** Seek to specific frame */
  seekToFrame: (frame: number) => void;
  /** Seek to progress (0-1) */
  seekToProgress: (progress: number) => void;
  /** Seek to time in seconds */
  seekToTimeSeconds: (seconds: number) => void;
  /** Change the format */
  setFormat: (format: FormatOption) => void;
  /** Whether player is ready */
  isReady: boolean;
  /** Whether currently playing */
  isPlaying: boolean;
  /** Current frame */
  currentFrame: number;
  /** Total frames */
  totalFrames: number;
}

/**
 * React component wrapper for SuperImg Player.
 *
 * Templates render at logical dimensions (e.g., 1920x1080) and scale
 * via CSS transform to fit the container while maintaining aspect ratio.
 *
 * @example
 * ```tsx
 * import { Player } from 'superimg-react';
 * import myTemplate from './templates/my-template';
 *
 * function App() {
 *   return (
 *     <Player
 *       template={myTemplate}
 *       format="horizontal"
 *       playbackMode="loop"
 *       loadMode="eager"
 *       style={{ width: "100%", aspectRatio: "16/9" }}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With ref for imperative control
 * const playerRef = useRef<PlayerRef>(null);
 *
 * <Player
 *   ref={playerRef}
 *   template={myTemplate}
 *   format="vertical"
 *   onLoad={(result) => {
 *     if (result.status === 'success') {
 *       console.log(`Loaded ${result.totalFrames} frames`);
 *     }
 *   }}
 * />
 *
 * <button onClick={() => playerRef.current?.play()}>Play</button>
 * <button onClick={() => playerRef.current?.seekToFrame(0)}>Reset</button>
 * ```
 */
export const Player = forwardRef<PlayerRef, PlayerProps>(function Player(
  {
    template: templateProp,
    code,
    compileDebounceMs = 300,
    onCompiling,
    onCompileError,
    format,
    playbackMode = "loop",
    loadMode = "eager",
    hoverBehavior = "none",
    hoverDelayMs = 200,
    maxCacheFrames = 30,
    className,
    style,
    controls,
    onLoad,
    onFrame,
    onPlay,
    onPause,
    onEnded,
    autoPlay,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<CorePlayer | null>(null);
  const hoverTimeoutRef = useRef<number | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [store, setStore] = useState<PlayerStore | null>(null);

  // Compile code if provided (instead of template)
  const {
    template: compiledTemplate,
    compiling,
    error: compileError,
  } = useCompiledTemplate({
    code: code ?? "",
    debounceMs: compileDebounceMs,
    enabled: !!code,
  });

  // Report compilation state changes
  useEffect(() => {
    onCompiling?.(compiling);
  }, [compiling, onCompiling]);

  useEffect(() => {
    if (compileError) {
      onCompileError?.(compileError);
    }
  }, [compileError, onCompileError]);

  // Determine the effective template (prop takes precedence over compiled)
  const template = templateProp ?? compiledTemplate;

  // Initialize player
  useEffect(() => {
    if (!containerRef.current || !template) return;

    const player = new CorePlayer({
      container: containerRef.current,
      format,
      playbackMode: hoverBehavior !== "none" ? "loop" : playbackMode,
      loadMode,
      hoverBehavior: "none", // We handle hover manually for React
      hoverDelayMs,
      maxCacheFrames,
    });

    playerRef.current = player;

    // Set up event listeners
    player.on("play", () => {
      setIsPlaying(true);
      onPlay?.();
    });

    player.on("pause", () => {
      setIsPlaying(false);
      onPause?.();
    });

    player.on("ended", () => {
      onEnded?.();
    });

    player.on("frame", (frame) => {
      onFrame?.(frame);
    });

    // Load template
    const loadPlayer = async () => {
      const result = await player.load(template);
      setIsReady(result.status === "success");
      if (result.status === "success" && player.store) {
        setStore(player.store);
        if (autoPlay) {
          player.play();
        }
      }
      onLoad?.(result);
    };

    if (loadMode === "lazy") {
      // Intersection observer for lazy loading
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadPlayer();
            observer.disconnect();
          }
        },
        { rootMargin: "100px" }
      );
      observer.observe(containerRef.current);
      return () => {
        observer.disconnect();
        player.destroy();
        playerRef.current = null;
        setStore(null);
        setIsReady(false);
        setIsPlaying(false);
      };
    } else {
      loadPlayer();
    }

    return () => {
      player.destroy();
      playerRef.current = null;
      setStore(null);
      setIsReady(false);
      setIsPlaying(false);
    };
  }, [
    template,
    format,
    playbackMode,
    loadMode,
    hoverBehavior,
    hoverDelayMs,
    maxCacheFrames,
    autoPlay,
    onLoad,
    onPlay,
    onPause,
    onEnded,
    onFrame,
  ]);

  // Hover handlers
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
      playerRef.current.seekToFrame(0);
    }
  }, [hoverBehavior]);

  // Expose ref API
  useImperativeHandle(
    ref,
    () => ({
      player: playerRef.current,
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
      stop: () => playerRef.current?.stop(),
      seekToFrame: (frame: number) => playerRef.current?.seekToFrame(frame),
      seekToProgress: (progress: number) =>
        playerRef.current?.seekToProgress(progress),
      seekToTimeSeconds: (seconds: number) =>
        playerRef.current?.seekToTimeSeconds(seconds),
      setFormat: (newFormat: FormatOption) =>
        playerRef.current?.setFormat(newFormat),
    }),
    [isReady, isPlaying]
  );

  // Render controls based on the controls prop
  const showControls = controls && store;
  const showTimeline = controls === true;

  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", flex: 1 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      {showControls && (
        <VideoControls store={store} showTimeline={showTimeline} showTime />
      )}
    </div>
  );
});
