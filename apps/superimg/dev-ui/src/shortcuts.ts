import { Player } from "superimg";
import { playerView, helpBtn } from "./dom";

let playerInstance: Player | null = null;

export function initShortcuts(
  playerInfo: () => Player | null, 
  reloadTemplate: () => void, 
  openExportPanel: () => void
) {
  document.addEventListener("keydown", (e) => {
    // Escape: back to home when in player view
    if (e.key === "Escape") {
      if (playerView.classList.contains("visible")) {
        location.href = "/";
      }
      return;
    }

    const player = playerInfo();
    if (!player?.store) return;

    const store = player.store.getState();
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
        if (store.isPlaying) return;
        store.setFrame(Math.max(0, store.currentFrame - (e.shiftKey ? 10 : 1)));
        break;
      case "ArrowRight":
        e.preventDefault();
        if (store.isPlaying) return;
        store.setFrame(Math.min(store.totalFrames - 1, store.currentFrame + (e.shiftKey ? 10 : 1)));
        break;
      case "Home":
        e.preventDefault();
        store.setFrame(0);
        break;
      case "End":
        e.preventDefault();
        store.setFrame(store.totalFrames - 1);
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
