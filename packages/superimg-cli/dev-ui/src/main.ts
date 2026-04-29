//! SuperImg Dev Server - Main entry point (uses Player)

import "./index.css";

import {
  Player,
  createTimelineController,
} from "@superimg/player";
import type { BackgroundValue, AudioOptions } from "@superimg/types";
import { escapeHtml } from "@superimg/stdlib";

interface DevConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;
  outputs?: Record<string, { width?: number; height?: number; fps?: number }>;
  audio?: string | AudioOptions;
  templateDir?: string;
}

interface VideoItem {
  name: string;
  shortName: string;
  relativePath: string;
  hasLocalConfig: boolean;
}

type ToastType = "success" | "error" | "info";

import {
  homeView,
  playerView,
  videoGrid,
  playPauseBtn,
  exportBtn,
  reloadBtn,
  outputSelect,
  timelineContainer,
  timelineProgress,
  timelinePlayhead,
  currentTimeEl,
  totalTimeEl,
  templateNameEl,
  loopBtn,
  volumeControl,
  volumeBtn,
  volumeSlider,
  btnFirst,
  btnPrev,
  btnNext,
  btnLast,
  previewContainer,
  settingsBtn,
  settingsPanel,
  inspectorBtn,
  inspectorPanel,
  inspectorPanelClose,
  inspectorCode,
  helpBtn,
  helpPanel,
  pausedOverlay,
  errorPanelDismiss,
} from "./dom";

import { initShortcuts } from "./shortcuts";
import { connectWebSocket } from "./server-sync";
import { exporting, initExportHandlers, openExportPanel } from "./export";
import { setupPreviewBackgroundSettings } from "./settings";
import { showErrorOverlay, hideErrorOverlay } from "./error-overlay";
import { formatError } from "@superimg/core/errors";
import type { TemplateBundle, SuperImgError } from "@superimg/types";

let player: Player | null = null;
let loadedTemplate: { render: (ctx: unknown) => string; defaults?: Record<string, unknown>; config?: { fonts?: string[]; inlineCss?: string[]; stylesheets?: string[]; background?: BackgroundValue } } | null = null;
let devConfig: DevConfig;
let templatePath = "/api/template";
let configPath = "/api/config";
let audioElement: HTMLAudioElement | null = null;
/** Latest bundle metadata (code is loaded via Blob URL; we keep map+file for error enrichment). */
let currentBundle: TemplateBundle | null = null;
import {
  setStatus,
  showToast,
  showError,
  hideError,
  showLoading,
  hideLoading
} from "./ui-feedback";

function updateUI() {
  if (!player) return;
  const state = player.store?.getState();
  const isPlaying = state?.isPlaying ?? false;
  playPauseBtn.textContent = isPlaying ? "Pause" : "Play";
  playPauseBtn.disabled = exporting;
  exportBtn.disabled = exporting;

  // Sync loop button with player
  const loop = player.playbackMode === "loop";
  loopBtn.setAttribute("aria-pressed", String(loop));

  // Show/hide paused overlay
  if (pausedOverlay) {
    pausedOverlay.classList.toggle("hidden", isPlaying);
  }
}

/** Sentinel: distinguishes "structured error already shown" from "bundle endpoint unavailable". */
const STRUCTURED_BUNDLE_ERROR = Symbol("STRUCTURED_BUNDLE_ERROR");
class StructuredBundleError extends Error {
  readonly [STRUCTURED_BUNDLE_ERROR] = true;
  constructor(message: string) {
    super(message);
    this.name = "StructuredBundleError";
  }
}
function isStructuredBundleError(err: unknown): err is StructuredBundleError {
  return !!err && typeof err === "object" && (err as Record<symbol, unknown>)[STRUCTURED_BUNDLE_ERROR] === true;
}

/**
 * Translate a template URL to its sourcemap-aware bundle URL.
 *  - `/api/template`              → `/api/template-bundle`   (single-video mode)
 *  - `/api/videos/<name>/template`→ `/api/videos/<name>/template-bundle`
 *
 * Returns null when the URL doesn't match a known shape (callers will fall
 * back to a raw import without sourcemap support).
 */
function bundleUrlFor(path: string): string | null {
  if (/\/api\/template$/.test(path)) {
    return path.replace(/\/api\/template$/, "/api/template-bundle");
  }
  const m = path.match(/\/api\/videos\/([^/]+)\/template$/);
  if (m) return path.replace(/\/template$/, "/template-bundle");
  return null;
}

/**
 * Load the template bundle as an atomic snapshot — code + sourceMap + sourceFile —
 * via the appropriate `*-bundle` endpoint. Imports the code through a Blob URL
 * so the parsed sourcemap remains accessible for runtime error enrichment.
 *
 * Behavior:
 *  - 200: Blob-import the code, store the parsed sourceMap.
 *  - 500 with `{ error: SuperImgErrorJSON }`: render the overlay and abort.
 *    Does NOT fall back to the legacy `/api/template` path — that would
 *    re-trigger the same compilation failure with a less useful error shape.
 *  - 404 / network failure: fall back to the legacy raw-ESM import. The dev
 *    UI loses sourcemap context but the previous behavior still works.
 */
export async function loadTemplate(path: string) {
  const bundleUrl = bundleUrlFor(path);
  if (bundleUrl) {
    let res: Response | null = null;
    try {
      res = await fetch(`${bundleUrl}?t=${Date.now()}`);
    } catch {
      // Network unavailable; allow legacy fallback.
      res = null;
    }

    if (res) {
      if (res.ok) {
        const bundle = (await res.json()) as TemplateBundle;
        currentBundle = bundle;
        const blob = new Blob([bundle.code], { type: "application/javascript" });
        const blobUrl = URL.createObjectURL(blob);
        try {
          const mod = await import(/* @vite-ignore */ blobUrl);
          return mod.default ?? mod;
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      }
      if (res.status === 500) {
        // Server produced a structured error. Render it and stop —
        // do not fall back to the legacy endpoint, which would just
        // re-fail with a worse error shape.
        const body = await res.json().catch(() => null);
        if (body?.error) {
          showErrorOverlay(body.error);
          throw new StructuredBundleError(body.error.message ?? "Template load failed");
        }
      }
      // For 404 or other unexpected statuses, fall through to legacy.
    }
  }

  // Legacy fallback (no sourceMap context).
  currentBundle = null;
  const url = `${path}?t=${Date.now()}`;
  const mod = await import(/* @vite-ignore */ url);
  return mod.default ?? mod;
}

export function reloadTemplate() {
  if (!player) return;
  hideError();
  hideErrorOverlay();
  showLoading();
  const wasPlaying = player.isPlaying;
  if (wasPlaying) player.pause();

  loadTemplate(templatePath)
    .then((t) => {
      loadedTemplate = t;
      const loadOpts = currentBundle
        ? { sourceMap: currentBundle.sourceMap, sourceFile: currentBundle.sourceFile }
        : undefined;
      player!.load(t, loadOpts).then((result) => {
        hideLoading();
        if (result.status === "error") {
          // Rich overlay rendered from the structured error in the LoadResult.
          const json = (result.details ?? {}) as Parameters<typeof showErrorOverlay>[0];
          if (json.code) showErrorOverlay(json);
          else showError(result.message);
          showToast(`Template Error: ${result.message}`, "error");
          setStatus(`Error: ${result.message}`);
          return;
        }
        hideErrorOverlay();
        showToast("Template reloaded", "success");
        setStatus("Template reloaded");
        if (wasPlaying) player!.play();
      });
    })
    .catch((e) => {
      hideLoading();
      if (isStructuredBundleError(e)) {
        // Overlay already shown by loadTemplate(); just update status/toast.
        showToast(`Template Error: ${e.message}`, "error");
        setStatus(`Error: ${e.message}`);
        if (wasPlaying) player!.play();
        return;
      }
      // Network/import failed before we got a structured error.
      const formatted = formatError(e);
      showErrorOverlay(formatted.json);
      showToast(`Template Error: ${formatted.json.message}`, "error");
      setStatus(`Error: ${formatted.json.message}`);
      if (wasPlaying) player!.play();
    });
}





async function initHome() {
  try {
    const res = await fetch("/api/videos");
    if (!res.ok) {
      homeView.innerHTML = `<div class="p-8 text-center text-[#999]">No videos API. Run with a template: superimg dev intro</div>`;
      homeView.classList.add("visible");
      return;
    }
    const videos: VideoItem[] = await res.json();
    if (videos.length === 0) {
      homeView.innerHTML = `<div class="p-8 text-center text-[#999]">No videos found. Create a *.video.ts file or run superimg init.</div>`;
      homeView.classList.add("visible");
      return;
    }

    videoGrid.innerHTML = "";
    for (const video of videos) {
      const card = document.createElement("div");
      card.className =
        "bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg overflow-hidden cursor-pointer transition-colors hover:border-[#00aaff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00aaff] focus-visible:outline-offset-2";
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="preview-container aspect-video bg-[#0a0a0a] relative overflow-hidden">
          <div class="thumbnail-placeholder absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
            <div class="loading-spinner w-6 h-6 border-2 border-[#444] border-t-[#888] rounded-full"></div>
          </div>
          <img class="thumbnail-img absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-200" alt="" />
        </div>
        <div class="p-3">
          <div class="font-medium text-sm">${escapeHtml(formatDisplayName(video.shortName))}</div>
          <div class="text-xs text-[#888] mt-1 truncate">${escapeHtml(formatCategory(video.relativePath))}</div>
        </div>
      `;
      const previewContainer = card.querySelector(".preview-container") as HTMLDivElement;
      const thumbnailImg = card.querySelector(".thumbnail-img") as HTMLImageElement;
      const placeholder = card.querySelector(".thumbnail-placeholder") as HTMLDivElement;
      let hoverPlayer: Player | null = null;
      let hoverTimeout: ReturnType<typeof setTimeout>;
      let thumbnailGenerated = false;

      // IntersectionObserver for lazy thumbnail generation
      const observer = new IntersectionObserver(
        async (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && !thumbnailGenerated) {
              thumbnailGenerated = true;
              observer.disconnect();
              try {
                await generateThumbnail(video, thumbnailImg, placeholder);
              } catch {
                // Show play icon as fallback
                placeholder.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)"><path d="M8 5v14l11-7z"/></svg>`;
              }
            }
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(card);

      card.addEventListener("mouseenter", () => {
        hoverTimeout = setTimeout(async () => {
          try {
            // Hide thumbnail, show player
            thumbnailImg.style.opacity = "0";
            hoverPlayer = new Player({
              container: previewContainer,
              format: "horizontal",  // Force 1920×1080 like React version
              playbackMode: "loop",
            });
            const mod = await loadTemplate(`/api/videos/${encodeURIComponent(video.name)}/template`);
            await hoverPlayer.load(mod.default ?? mod);
            hoverPlayer.play();
          } catch {
            // Restore thumbnail on error
            thumbnailImg.style.opacity = "1";
          }
        }, 300);
      });

      card.addEventListener("mouseleave", () => {
        clearTimeout(hoverTimeout);
        if (hoverPlayer) {
          hoverPlayer.destroy();
          hoverPlayer = null;
        }
        // Restore thumbnail
        thumbnailImg.style.opacity = "1";
      });

      card.addEventListener("click", () => {
        const url = new URL(location.href);
        url.searchParams.set("template", `/api/videos/${encodeURIComponent(video.name)}/template`);
        location.href = url.toString();
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }
      });

      videoGrid.appendChild(card);
    }
    homeView.classList.add("visible");
  } catch (e) {
    homeView.innerHTML = `<div class="p-8 text-center text-red-400">Error: ${escapeHtml(String(e))}</div>`;
    homeView.classList.add("visible");
  }
}


function formatDisplayName(shortName: string): string {
  return shortName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCategory(relativePath: string): string {
  const parts = relativePath.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

import { generateThumbnail } from "./thumbnails";

function getTemplateDisplayName(path: string): string {
  if (path.startsWith("/api/videos/") && path.endsWith("/template")) {
    const name = path.replace("/api/videos/", "").replace("/template", "");
    return decodeURIComponent(name);
  }
  return "template";
}

async function initPlayer() {
  try {
    setupPreviewBackgroundSettings();
    errorPanelDismiss?.addEventListener("click", hideError);
    setStatus("Loading config...");
    const params = new URLSearchParams(location.search);
    templatePath = params.get("template") || "/api/template";

    if (templatePath.startsWith("/api/videos/") && templatePath.endsWith("/template")) {
      configPath = templatePath.replace("/template", "/config");
    } else {
      configPath = "/api/config";
    }

    templateNameEl.textContent = getTemplateDisplayName(templatePath);

    const configRes = await fetch(configPath);
    if (!configRes.ok) throw new Error(`Failed to load config: ${configRes.statusText}`);
    devConfig = await configRes.json();

    if (devConfig.outputs) {
      outputSelect.innerHTML = '<option value="">Default</option>';
      for (const [name, preset] of Object.entries(devConfig.outputs)) {
        const p = preset as { width?: number; height?: number };
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = `${name} (${p.width ?? devConfig.width}x${p.height ?? devConfig.height})`;
        outputSelect.appendChild(opt);
      }
    }

    showLoading();
    setStatus("Initializing preview...");
    player = new Player({
      container: "#preview-container",
      format: { width: devConfig.width, height: devConfig.height },
      playbackMode: "loop",
    });

    player.on("play", updateUI);
    player.on("pause", updateUI);
    player.on("frame", (f) => setStatus(`Playing frame ${f}/${player!.totalFrames}`));
    player.on("frameRendered", (f, html, compositeHtml) => {
      if (inspectorPanel.classList.contains("open")) {
        inspectorCode.textContent = compositeHtml;
      }
    });
    // Surface runtime render errors via the rich overlay. The player has
    // already enriched the error with sourcemap-mapped location + code frame
    // when sourceMap was passed to load() below.
    player.on("error", (err) => {
      const formatted = formatError(err as SuperImgError);
      showErrorOverlay(formatted.json);
    });

    setStatus("Loading template...");
    const template = await loadTemplate(templatePath);
    loadedTemplate = template;
    const loadOpts = currentBundle
      ? { sourceMap: currentBundle.sourceMap, sourceFile: currentBundle.sourceFile }
      : undefined;
    const result = await player.load(template, loadOpts);

    if (result.status === "error") {
      // result.details is the SuperImgErrorJSON shape via formatError.
      const json = (result.details ?? {}) as Parameters<typeof showErrorOverlay>[0];
      if (json.code) showErrorOverlay(json);
      throw new Error(result.message);
    }
    hideLoading();
    hideErrorOverlay();

    const store = player.store!;
    store.subscribe(updateUI);
    updateUI(); // Sync initial state so that the play overlay appears

    // Initialize audio playback if configured
    if (devConfig.audio) {
      const audioConfig = typeof devConfig.audio === "string"
        ? { src: devConfig.audio }
        : devConfig.audio;

      audioElement = new Audio();
      // Resolve audio path relative to template directory
      // Encode the path to preserve .. segments
      audioElement.src = `/api/assets?path=${encodeURIComponent(audioConfig.src)}`;
      audioElement.volume = audioConfig.volume ?? 1;
      audioElement.loop = audioConfig.loop ?? false;
      audioElement.preload = "auto";

      // Sync audio with player state
      let wasPlaying = false;
      let lastSeekFrame = -1;
      let prevFrame = 0;

      store.subscribe((state) => {
        if (!audioElement) return;
        const videoTime = state.currentFrame / state.fps;

        // Detect video loop (frame jumped backwards significantly)
        const looped = state.isPlaying && prevFrame > state.currentFrame + 5;

        if (state.isPlaying) {
          if (!wasPlaying || looped) {
            // Just started playing OR video looped - sync time and start audio
            audioElement.currentTime = videoTime;
            audioElement.play().catch(() => {});
          }
          // While playing, let audio run naturally (don't constantly reset)
        } else {
          // Paused or scrubbing
          if (!audioElement.paused) {
            audioElement.pause();
          }
          // Sync time when scrubbing (frame changed while paused)
          if (state.currentFrame !== lastSeekFrame) {
            audioElement.currentTime = videoTime;
            lastSeekFrame = state.currentFrame;
          }
        }
        wasPlaying = state.isPlaying;
        prevFrame = state.currentFrame;
      });

      console.log(`Audio loaded: ${audioConfig.src} (volume: ${audioConfig.volume ?? 1}, loop: ${audioConfig.loop ?? false})`);

      // Show volume control and wire it up
      volumeControl.classList.remove("hidden");
      const initialVolume = 0.25;
      audioElement.volume = initialVolume;
      volumeSlider.value = "25";
      let lastVolume = initialVolume;

      const updateVolumeIcon = () => {
        if (!audioElement) return;
        if (audioElement.muted || audioElement.volume === 0) {
          volumeBtn.textContent = "🔇";
        } else if (audioElement.volume < 0.5) {
          volumeBtn.textContent = "🔉";
        } else {
          volumeBtn.textContent = "🔊";
        }
      };

      volumeSlider.addEventListener("input", () => {
        if (!audioElement) return;
        const vol = parseInt(volumeSlider.value, 10) / 100;
        audioElement.volume = vol;
        audioElement.muted = false;
        lastVolume = vol > 0 ? vol : lastVolume;
        updateVolumeIcon();
      });

      volumeBtn.addEventListener("click", () => {
        if (!audioElement) return;
        if (audioElement.muted || audioElement.volume === 0) {
          audioElement.muted = false;
          audioElement.volume = lastVolume > 0 ? lastVolume : 0.5;
          volumeSlider.value = String(Math.round(audioElement.volume * 100));
        } else {
          lastVolume = audioElement.volume;
          audioElement.muted = true;
        }
        updateVolumeIcon();
      });

      updateVolumeIcon();
    }

    const timelineController = createTimelineController(
      { progress: timelineProgress, playhead: timelinePlayhead, currentTime: currentTimeEl, totalTime: totalTimeEl },
      store
    );
    timelineController.attach(timelineContainer);

    // Transport buttons
    btnFirst.addEventListener("click", () => store.getState().setFrame(0));
    btnPrev.addEventListener("click", () => {
      const s = store.getState();
      s.setFrame(Math.max(0, s.currentFrame - 1));
    });
    btnNext.addEventListener("click", () => {
      const s = store.getState();
      s.setFrame(Math.min(s.totalFrames - 1, s.currentFrame + 1));
    });
    btnLast.addEventListener("click", () => store.getState().setFrame(store.getState().totalFrames - 1));



    // Inspector panel toggle
    inspectorBtn?.addEventListener("click", () => {
      const expanded = inspectorBtn.getAttribute("aria-expanded") === "true";
      inspectorBtn.setAttribute("aria-expanded", String(!expanded));
      inspectorPanel?.classList.toggle("open");

      // Update code right away if opening
      if (!expanded && player && player.store) {
        player.renderFrame(player.currentFrame);
      }
    });
    inspectorPanelClose?.addEventListener("click", () => {
      inspectorBtn.setAttribute("aria-expanded", "false");
      inspectorPanel?.classList.remove("open");
    });

    // Help panel toggle
    helpBtn?.addEventListener("click", () => {
      const expanded = helpBtn.getAttribute("aria-expanded") === "true";
      helpBtn.setAttribute("aria-expanded", String(!expanded));
      helpPanel?.classList.toggle("hidden");
      // Close settings if opening help
      if (!expanded) {
        settingsBtn.setAttribute("aria-expanded", "false");
        settingsPanel.classList.add("hidden");
      }
    });

    // Click on preview to play/pause
    previewContainer.addEventListener("click", (e) => {
      // Ignore clicks on buttons/controls inside preview
      if ((e.target as HTMLElement).closest("button")) return;
      store.getState().togglePlayPause();
    });

    // Export handlers
    initExportHandlers(
      () => player,
      () => loadedTemplate,
      () => devConfig,
      updateUI
    );

    outputSelect.addEventListener("change", (e) => {
      if (!devConfig) return;
      const sel = (e.target as HTMLSelectElement).value;
      let w = devConfig.width;
      let h = devConfig.height;
      if (sel && devConfig.outputs?.[sel]) {
        w = devConfig.outputs[sel].width ?? w;
        h = devConfig.outputs[sel].height ?? h;
      }
      player!.setFormat({ width: w, height: h });
      setStatus(`Output: ${sel || "Default"} (${w}x${h})`);
    });

    setStatus("Ready - Click Play to start preview");
    initShortcuts(
      () => player,
      reloadTemplate,
      openExportPanel
    );
    connectWebSocket();
    updateUI();
    playerView.classList.add("visible");
  } catch (error) {
    if (isStructuredBundleError(error)) {
      // Overlay was already rendered by loadTemplate(); just sync status.
      showToast(`Error: ${error.message}`, "error");
      setStatus(`Error: ${error.message}`);
      return;
    }
    const formatted = formatError(error);
    showErrorOverlay(formatted.json);
    showToast(`Error: ${formatted.json.message}`, "error");
    setStatus(`Error: ${formatted.json.message}`);
    console.error(error);
  }
}

async function init() {
  const params = new URLSearchParams(location.search);
  const template = params.get("template");

  if (!template) {
    await initHome();
  } else {
    await initPlayer();
  }
}

init();
