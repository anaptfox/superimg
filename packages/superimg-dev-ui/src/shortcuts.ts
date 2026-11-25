import { Player } from "@superimg/player";
import { playerView, helpBtn, exportPanel } from "./dom";
import { closeExportPanel } from "./export";

let playerInstance: Player | null = null;

export function initShortcuts(
  playerInfo: () => Player | null, 
  reloadTemplate: () => void, 
  openExportPanel: () => void
) {
  document.addEventListener("keydown", (e) => {
    // Escape: close export first, then back to all media
    if (e.key === "Escape") {
      if (exportPanel && !exportPanel.classList.contains("hidden")) {
        closeExportPanel();
        return;
      }
      if (playerView.classList.contains("visible")) {
        location.href = "/";
      }
      return;
    }

    const player = playerInfo();
    if (!player?.store) return;

    const store = player.store;
    const state = store.getState();
    const target = e.target as HTMLElement;
    if (target.closest("input") || target.closest("textarea") || target.closest("select")) return;

    switch (e.key) {
      case " ":
        e.preventDefault();
        store.togglePlayPause();
        break;
      case "r":
      case "R":
        e.preventDefault();
        reloadTemplate();
        break;
      case "l":
      case "L":
        e.preventDefault();
        toggleLoop(player);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (state.isPlaying) return;
        void store.seekFrame(Math.max(0, state.currentFrame - (e.shiftKey ? 10 : 1)));
        break;
      case "ArrowRight":
        e.preventDefault();
        if (state.isPlaying) return;
        void store.seekFrame(Math.min(state.totalFrames - 1, state.currentFrame + (e.shiftKey ? 10 : 1)));
        break;
      case "Home":
        e.preventDefault();
        void store.seekFrame(0);
        break;
      case "End":
        e.preventDefault();
        void store.seekFrame(state.totalFrames - 1);
        break;
      case "?":
        e.preventDefault();
        helpBtn?.click();
        break;
      case "e":
      case "E":
        e.preventDefault();
        openExportPanel();
        break;
    }
  });
}

function toggleLoop(player: Player) {
  const next = player.playbackMode === "loop" ? "once" : "loop";
  player.playbackMode = next;
  const loopBtn = document.getElementById("loop-btn");
  if (loopBtn) {
    loopBtn.setAttribute("aria-pressed", String(next === "loop"));
  }
}
