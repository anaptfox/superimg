//! Orchestration hook for editor-grade player layouts (single-template)

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type {
  EncodingOptions,
  FormatOption,
  RuntimeStore,
  TemplateModule,
  ComposedTemplate,
} from "../../index.browser.js";
import type { PlayerRef } from "../components/Player.js";
import type { ExportOptions } from "../components/ExportDialog.js";
import { usePlaygroundExport } from "./usePlaygroundExport.js";
import {
  getPlayerRefStateSnapshot,
  subscribeToPlayerRefStore,
} from "../utils/subscribeToPlayerRef.js";

export interface UsePlayerSessionOptions {
  template: TemplateModule | ComposedTemplate | null;
  data?: Record<string, unknown>;
  format?: FormatOption;
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
  format: FormatOption;
  setFormat: (format: FormatOption) => void;
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
  template,
  data = {},
  format: initialFormat = "horizontal",
  fps,
  encoding,
}: UsePlayerSessionOptions): UsePlayerSessionReturn {
  const playerRef = useRef<PlayerRef>(null);
  const [store, setStore] = useState<RuntimeStore | null>(null);
  const [format, setFormat] = useState<FormatOption>(initialFormat);

  const onStore = useCallback((next: RuntimeStore | null) => {
    setStore(next);
  }, []);

  useEffect(() => {
    setFormat(initialFormat);
  }, [initialFormat]);

  const state = useSyncExternalStore(
    (onChange) => subscribeToPlayerRefStore(playerRef, onChange),
    () => getPlayerRefStateSnapshot(playerRef),
    () => getPlayerRefStateSnapshot(playerRef),
  );

  const { exporting, exportProgress, exportMp4, download } = usePlaygroundExport({
    template,
    data,
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
    playerRef.current?.seekFrame(frame);
  }, []);

  const progress =
    state.totalFrames > 1
      ? state.currentFrame / (state.totalFrames - 1)
      : 0;

  return {
    playerRef,
    store,
    onStore,
    format,
    setFormat,
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