//! Player - React component for SuperImg
//! Renders templates with playback controls, hover behavior, and ref-based imperative API

import { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from "react";
import { 
  Player as CorePlayer, 
  type PlayerInput, 
  type LoadResult,
  type PlaybackMode,
  type LoadMode,
  type HoverBehavior,
} from "superimg/player";

export interface PlayerProps {
  /** Template module to render */
  template: PlayerInput;
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
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
 * @example
 * ```tsx
 * import { Player } from 'superimg-react';
 * import myTemplate from './templates/my-template';
 * 
 * function App() {
 *   return (
 *     <Player
 *       template={myTemplate}
 *       width={1280}
 *       height={720}
 *       playbackMode="loop"
 *       loadMode="eager"
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
 *   width={640}
 *   height={360}
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
    template,
    width,
    height,
    playbackMode = "loop",
    loadMode = "eager",
    hoverBehavior = "none",
    hoverDelayMs = 200,
    maxCacheFrames = 30,
    className,
    style,
    onLoad,
    onFrame,
    onPlay,
    onPause,
    onEnded,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<CorePlayer | null>(null);
  const hoverTimeoutRef = useRef<number | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize player
  useEffect(() => {
    if (!containerRef.current) return;

    const player = new CorePlayer({
      container: containerRef.current,
      width,
      height,
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
      onLoad?.(result);
      
      // Auto-play if not using hover behavior and playback mode isn't 'once' starting paused
      if (result.status === "success" && hoverBehavior === "none" && playbackMode !== "once") {
        // Don't auto-play, let user control
      }
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
        setIsReady(false);
        setIsPlaying(false);
      };
    } else {
      loadPlayer();
    }

    return () => {
      player.destroy();
      playerRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
    };
  }, [template, width, height, playbackMode, loadMode, hoverBehavior, hoverDelayMs, maxCacheFrames, onLoad, onPlay, onPause, onEnded, onFrame]);

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
  useImperativeHandle(ref, () => ({
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
    seekToProgress: (progress: number) => playerRef.current?.seekToProgress(progress),
    seekToTimeSeconds: (seconds: number) => playerRef.current?.seekToTimeSeconds(seconds),
  }), [isReady, isPlaying]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width, height, ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  );
});
