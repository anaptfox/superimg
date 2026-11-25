//! Dev UI audio preview sync with player store + volume controls.

import type { RuntimeStore } from "@superimg/player";
import type { AudioValue } from "@superimg/types";
import { normalizeAudioInput } from "@superimg/core";
import { volumeBtn, volumeControl, volumeSlider } from "./dom";

export interface AudioPreviewController {
  readonly element: HTMLAudioElement | null;
  bindStore(store: RuntimeStore): void;
  dispose(): void;
}

/** Wire optional template audio preview to the currently accepted player store. */
export function setupAudioPreview(
  initialStore: RuntimeStore,
  audio: AudioValue | undefined,
): AudioPreviewController {
  const previewClip = audio ? normalizeAudioInput(audio).clips[0] : undefined;
  if (!previewClip) return { element: null, bindStore() {}, dispose() {} };

  const audioElement = new Audio();
  audioElement.src = previewClip.src;
  audioElement.volume = previewClip.volume ?? 1;
  audioElement.loop = previewClip.loop ?? false;
  audioElement.preload = "auto";

  let wasPlaying = false;
  let lastSeekFrame = -1;
  let prevFrame = 0;

  let unsubscribe: (() => void) | null = null;
  const bindStore = (store: RuntimeStore) => {
    unsubscribe?.();
    unsubscribe = store.subscribe(() => {
      const state = store.getState();
      const videoTime = state.currentFrame / state.fps;
      const looped = state.isPlaying && prevFrame > state.currentFrame + 5;

      if (state.isPlaying) {
        if (!wasPlaying || looped) {
          audioElement.currentTime = videoTime;
          audioElement.play().catch(() => {});
        }
      } else {
        if (!audioElement.paused) {
          audioElement.pause();
        }
        if (state.currentFrame !== lastSeekFrame) {
          audioElement.currentTime = videoTime;
          lastSeekFrame = state.currentFrame;
        }
      }
      wasPlaying = state.isPlaying;
      prevFrame = state.currentFrame;
    });
  };
  bindStore(initialStore);

  volumeControl.classList.remove("hidden");
  const initialVolume = 0.25;
  audioElement.volume = initialVolume;
  volumeSlider.value = "25";
  let lastVolume = initialVolume;

  const updateVolumeIcon = () => {
    if (audioElement.muted || audioElement.volume === 0) {
      volumeBtn.textContent = "🔇";
    } else if (audioElement.volume < 0.5) {
      volumeBtn.textContent = "🔉";
    } else {
      volumeBtn.textContent = "🔊";
    }
  };

  const onVolumeInput = () => {
    const vol = parseInt(volumeSlider.value, 10) / 100;
    audioElement.volume = vol;
    audioElement.muted = false;
    lastVolume = vol > 0 ? vol : lastVolume;
    updateVolumeIcon();
  };

  const onVolumeClick = () => {
    if (audioElement.muted || audioElement.volume === 0) {
      audioElement.muted = false;
      audioElement.volume = lastVolume > 0 ? lastVolume : 0.5;
      volumeSlider.value = String(Math.round(audioElement.volume * 100));
    } else {
      lastVolume = audioElement.volume;
      audioElement.muted = true;
    }
    updateVolumeIcon();
  };
  volumeSlider.addEventListener("input", onVolumeInput);
  volumeBtn.addEventListener("click", onVolumeClick);

  updateVolumeIcon();
  return {
    element: audioElement,
    bindStore,
    dispose() {
      unsubscribe?.();
      unsubscribe = null;
      audioElement.pause();
      volumeSlider.removeEventListener("input", onVolumeInput);
      volumeBtn.removeEventListener("click", onVolumeClick);
      volumeControl.classList.add("hidden");
    },
  };
}
