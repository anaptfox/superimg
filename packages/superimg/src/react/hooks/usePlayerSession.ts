//! Orchestration hook for editor-grade player layouts (single-template)

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { RuntimeStore } from "@superimg/media";
import type { CanvasSize, EncodingOptions, MediaDefinition } from "@superimg/types";
import type { PlayerRef } from "../components/Player.js";
import type { ExportOptions } from "../components/ExportDialog.js";
import { usePlaygroundExport } from "./usePlaygroundExport.js";
import {
  getPlayerRefStateSnapshot,
  subscribeToPlayerRefStore,
} from "../utils/subscribeToPlayerRef.js";

export interface UsePlayerSessionOptions {
  /** `unknown` breaks assignability of a template's own `render(ctx: RenderContext<TData>)`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  media: MediaDefinition<any> | null;
  data?: Record<string, unknown>;
  size?: CanvasSize;
  duration?: number;
  fps?: number;
  encoding?: EncodingOptions;
}

export interface UsePlayerSessionReturn {
  playerRef: RefObject<PlayerRef | null>;
  /** Runtime store (null until player loads) */
  store: RuntimeStore | null;
  /** Pass to Player `onStore` */
  onStore: (store: RuntimeStore | null) => void;
  size: CanvasSize | undefined;
  setSize: (size: CanvasSize | undefined) => void;
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  progress: number;
  ready: boolean;
  play: () => void;
  pause: () => void;
  seekFrame: (frame: number) => void;
  exportMp4: (options?: ExportOptions) => Promise<Blob | null>;
  download: (blob: Blob, filename: string) => void;
  exporting: boolean;
  exportProgress: number;
}

export function usePlayerSession({
  media,
  data = {},
  size: initialSize,
  duration,
  fps,
  encoding,
}: UsePlayerSessionOptions): UsePlayerSessionReturn {
  const playerRef = useRef<PlayerRef>(null);
  const [store, setStore] = useState<RuntimeStore | null>(null);
  const [size, setSize] = useState<CanvasSize | undefined>(initialSize);

  const onStore = useCallback((next: RuntimeStore | null) => {
    setStore(next);
  }, []);

  useEffect(() => {
    setSize(initialSize);
  }, [initialSize]);

  const state = useSyncExternalStore(
    (onChange) => subscribeToPlayerRefStore(playerRef, onChange),
    () => getPlayerRefStateSnapshot(playerRef),
    () => getPlayerRefStateSnapshot(playerRef),
  );

  const { exporting, exportProgress, exportMp4, download } = usePlaygroundExport({
    media,
    data,
    ...(size !== undefined ? { size } : {}),
    ...(duration !== undefined ? { duration } : {}),
    ...(fps !== undefined ? { fps } : {}),
    ...(encoding !== undefined ? { encoding } : {}),
  });

  const play = useCallback(() => {
    playerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const seekFrame = useCallback((frame: number) => {
    void playerRef.current?.seek({ frame });
  }, []);

  const progress =
    state.totalFrames > 1
      ? state.currentFrame / (state.totalFrames - 1)
      : 0;

  return {
    playerRef,
    store,
    onStore,
    size,
    setSize,
    isPlaying: state.isPlaying,
    currentFrame: state.currentFrame,
    totalFrames: state.totalFrames,
    progress,
    ready: state.isReady,
    play,
    pause,
    seekFrame,
    exportMp4,
    download,
    exporting,
    exportProgress,
  };
}
