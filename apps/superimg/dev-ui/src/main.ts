//! SuperImg Dev Server - Main entry point (uses Player)

import "./index.css";

import {
  Player,
  createTimelineController,
  exportToVideo,
  downloadBlob,
  CanvasRenderer,
  createRenderContext,
  buildCompositeHtml,
  type BackgroundValue,
} from "superimg";

interface DevConfig {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  outputs?: Record<string, { width?: number; height?: number; fps?: number }>;
}

interface VideoItem {
  name: string;
  relativePath: string;
  hasLocalConfig: boolean;
}

type ToastType = "success" | "error" | "info";

const homeView = document.getElementById("home-view") as HTMLDivElement;
const playerView = document.getElementById("player-view") as HTMLDivElement;
const videoGrid = document.getElementById("video-grid") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const playPauseBtn = document.getElementById("play-pause") as HTMLButtonElement;
const exportBtn = document.getElementById("export") as HTMLButtonElement;
const reloadBtn = document.getElementById("reload") as HTMLButtonElement;
const outputSelect = document.getElementById("output-select") as HTMLSelectElement;
const timelineContainer = document.getElementById("timeline-container") as HTMLDivElement;
const timelineProgress = document.getElementById("timeline-progress") as HTMLDivElement;
const timelinePlayhead = document.getElementById("timeline-playhead") as HTMLDivElement;
const currentTimeEl = document.getElementById("current-time") as HTMLSpanElement;
const totalTimeEl = document.getElementById("total-time") as HTMLSpanElement;
const templateNameEl = document.getElementById("template-name") as HTMLSpanElement;
const loopBtn = document.getElementById("loop-btn") as HTMLButtonElement;
const errorPanel = document.getElementById("error-panel") as HTMLDivElement;
const errorPanelMessage = errorPanel?.querySelector(".error-panel-message") as HTMLDivElement;
const errorPanelDismiss = errorPanel?.querySelector(".error-panel-dismiss") as HTMLButtonElement;
const toastContainer = document.getElementById("toast-container") as HTMLDivElement;
const btnFirst = document.getElementById("btn-first") as HTMLButtonElement;
const btnPrev = document.getElementById("btn-prev") as HTMLButtonElement;
const btnNext = document.getElementById("btn-next") as HTMLButtonElement;
const btnLast = document.getElementById("btn-last") as HTMLButtonElement;
const previewContainer = document.getElementById("preview-container") as HTMLDivElement;
const settingsBtn = document.getElementById("settings-btn") as HTMLButtonElement;
const settingsPanel = document.getElementById("settings-panel") as HTMLDivElement;
const bgTypeSelect = document.getElementById("bg-type") as HTMLSelectElement;
const bgColorRow = document.getElementById("bg-color-row") as HTMLDivElement;
const helpBtn = document.getElementById("help-btn") as HTMLButtonElement;
const helpPanel = document.getElementById("help-panel") as HTMLDivElement;
const pausedOverlay = previewContainer?.querySelector(".paused-overlay") as HTMLDivElement;
const exportPanel = document.getElementById("export-panel") as HTMLDivElement;
const exportPanelClose = document.getElementById("export-panel-close") as HTMLButtonElement;
const exportStart = document.getElementById("export-start") as HTMLButtonElement;
const exportCancel = document.getElementById("export-cancel") as HTMLButtonElement;
const exportCloseBtn = document.getElementById("export-close") as HTMLButtonElement;
const exportDownload = document.getElementById("export-download") as HTMLButtonElement;
const exportBar = document.getElementById("export-bar") as HTMLDivElement;
const exportPercent = document.getElementById("export-percent") as HTMLSpanElement;
const exportSize = document.getElementById("export-size") as HTMLSpanElement;

const PREVIEW_BG_KEY = "superimg-dev-preview-bg";

type BgType = "checkerboard" | "solid";

interface PreviewBgSettings {
  type: BgType;
  color: string;
}

const DEFAULT_BG: PreviewBgSettings = { type: "checkerboard", color: "#2a2a2a" };

function loadPreviewBgSettings(): PreviewBgSettings {
  try {
    const s = localStorage.getItem(PREVIEW_BG_KEY);
    if (s) {
      const parsed = JSON.parse(s) as Partial<PreviewBgSettings>;
      return { type: parsed.type ?? DEFAULT_BG.type, color: parsed.color ?? DEFAULT_BG.color };
    }
  } catch {}
  return { ...DEFAULT_BG };
}

function savePreviewBgSettings(settings: PreviewBgSettings) {
  try {
    localStorage.setItem(PREVIEW_BG_KEY, JSON.stringify(settings));
  } catch {}
}

function applyPreviewBackground(settings: PreviewBgSettings) {
  if (!previewContainer) return;
  previewContainer.classList.remove("preview-bg-checkerboard");
  previewContainer.style.backgroundImage = "";
  previewContainer.style.backgroundColor = "";

  if (settings.type === "checkerboard") {
    previewContainer.classList.add("preview-bg-checkerboard");
  } else {
    previewContainer.style.backgroundColor = settings.color;
  }
}

function setupPreviewBackgroundSettings() {
  const settings = loadPreviewBgSettings();
  applyPreviewBackground(settings);

  bgTypeSelect.value = settings.type;
  bgColorRow.classList.toggle("hidden", settings.type !== "solid");

  settingsBtn.addEventListener("click", () => {
    const open = settingsPanel.classList.toggle("hidden");
    settingsBtn.setAttribute("aria-expanded", String(!open));
  });

  bgTypeSelect.addEventListener("change", () => {
    const type = bgTypeSelect.value as BgType;
    bgColorRow.classList.toggle("hidden", type !== "solid");
    const newSettings: PreviewBgSettings = { ...loadPreviewBgSettings(), type };
    if (type === "solid") newSettings.color = loadPreviewBgSettings().color;
    savePreviewBgSettings(newSettings);
    applyPreviewBackground(newSettings);
  });

  bgColorRow.querySelectorAll(".bg-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const color = (btn as HTMLButtonElement).dataset.color ?? DEFAULT_BG.color;
      const newSettings: PreviewBgSettings = { type: "solid", color };
      savePreviewBgSettings(newSettings);
      applyPreviewBackground(newSettings);
      bgTypeSelect.value = "solid";
      bgColorRow.classList.remove("hidden");
    });
  });
}

let player: Player | null = null;
let loadedTemplate: { render: (ctx: unknown) => string; defaults?: Record<string, unknown>; config?: { fonts?: string[]; inlineCss?: string[]; stylesheets?: string[]; background?: BackgroundValue } } | null = null;
let devConfig: DevConfig;
let templatePath = "/api/template";
let configPath = "/api/config";
let exporting = false;

function setStatus(message: string) {
  statusEl.textContent = message;
}

function showToast(message: string, type: ToastType = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);

  const dismiss = () => {
    el.remove();
  };

  if (type === "error") {
    el.addEventListener("click", dismiss);
  } else if (type === "success" || type === "info") {
    setTimeout(dismiss, 3000);
  }
}

function showError(message: string) {
  errorPanel.classList.remove("hidden");
  errorPanelMessage.textContent = message;
}

function hideError() {
  errorPanel.classList.add("hidden");
}

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

async function loadTemplate(path: string) {
  const url = `${path}?t=${Date.now()}`;
  const mod = await import(/* @vite-ignore */ url);
  return mod.default ?? mod;
}

function reloadTemplate() {
  if (!player) return;
  hideError();
  showLoading();
  const wasPlaying = player.isPlaying;
  if (wasPlaying) player.pause();

  loadTemplate(templatePath)
    .then((t) => {
      loadedTemplate = t;
      player!.load(t).then(() => {
        hideLoading();
        showToast("Template reloaded", "success");
        setStatus("Template reloaded");
        if (wasPlaying) player!.play();
      });
    })
    .catch((e) => {
      hideLoading();
      const msg = `Template Error: ${e.message}`;
      showError(msg);
      showToast(msg, "error");
      setStatus(`Error: ${e.message}`);
      if (wasPlaying) player!.play();
    });
}

function connectWebSocket() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onopen = () => {
    showToast("Connected for auto-reloading", "info");
    setStatus("Connected for auto-reloading");
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "reload") reloadTemplate();
    } catch {}
  };
  ws.onclose = () => {
    setStatus("Disconnected. Retrying...");
    setTimeout(connectWebSocket, 2000);
  };
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Escape: back to home when in player view
    if (e.key === "Escape") {
      if (playerView.classList.contains("visible")) {
        location.href = "/";
      }
      return;
    }

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
        toggleLoop();
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

function toggleLoop() {
  if (!player) return;
  const next = player.playbackMode === "loop" ? "once" : "loop";
  player.playbackMode = next;
  loopBtn.setAttribute("aria-pressed", String(next === "loop"));
}

function showLoading() {
  previewContainer.classList.add("loading");
}

function hideLoading() {
  previewContainer.classList.remove("loading");
}

// Export panel state
let exportFormat: "mp4" | "webm" = "mp4";
let exportAbortController: AbortController | null = null;
let exportedBlob: Blob | null = null;

function setExportState(state: "config" | "exporting" | "done") {
  exportPanel.dataset.state = state;
}

function openExportPanel() {
  setExportState("config");
  exportPanel.classList.remove("hidden");
  // Close other panels
  settingsPanel.classList.add("hidden");
  settingsBtn.setAttribute("aria-expanded", "false");
  helpPanel.classList.add("hidden");
  helpBtn.setAttribute("aria-expanded", "false");
}

function closeExportPanel() {
  exportPanel.classList.add("hidden");
  exportAbortController?.abort();
  exportAbortController = null;
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
        <div class="aspect-video bg-[#0a0a0a] flex items-center justify-center">
          <span class="text-[#999] text-sm">Hover to preview</span>
        </div>
        <div class="p-4">
          <div class="font-semibold text-base">${escapeHtml(video.name)}</div>
          <div class="text-xs text-[#999] mt-1">${escapeHtml(video.relativePath)}</div>
        </div>
      `;
      const previewEl = card.querySelector(".aspect-video") as HTMLDivElement;
      let hoverPlayer: Player | null = null;
      let hoverTimeout: ReturnType<typeof setTimeout>;

      card.addEventListener("mouseenter", () => {
        hoverTimeout = setTimeout(async () => {
          try {
            previewEl.innerHTML = "";
            const configRes = await fetch(`/api/videos/${encodeURIComponent(video.name)}/config`);
            const config = await configRes.json();
            const w = Math.min(config.width ?? 1920, 400);
            const h = Math.round(w * ((config.height ?? 1080) / (config.width ?? 1920)));
            hoverPlayer = new Player({
              container: previewEl,
              format: { width: w, height: h },
              playbackMode: "loop",
            });
            const mod = await loadTemplate(`/api/videos/${encodeURIComponent(video.name)}/template`);
            await hoverPlayer.load(mod.default ?? mod);
            hoverPlayer.play();
          } catch {
            previewEl.innerHTML = `<span class="text-[#999] text-sm">Error loading</span>`;
          }
        }, 300);
      });

      card.addEventListener("mouseleave", () => {
        clearTimeout(hoverTimeout);
        if (hoverPlayer) {
          hoverPlayer.destroy();
          hoverPlayer = null;
        }
        previewEl.innerHTML = `<span class="text-[#999] text-sm">Hover to preview</span>`;
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

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

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

    setStatus("Loading template...");
    const template = await loadTemplate(templatePath);
    loadedTemplate = template;
    const result = await player.load(template);

    if (result.status === "error") throw new Error(result.message);
    hideLoading();

    const store = player.store!;
    store.subscribe(updateUI);

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

    // Loop toggle
    loopBtn.addEventListener("click", toggleLoop);

    playPauseBtn.addEventListener("click", () => store.getState().togglePlayPause());
    reloadBtn.addEventListener("click", reloadTemplate);

    errorPanelDismiss?.addEventListener("click", hideError);

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

    // Export button opens panel
    exportBtn.addEventListener("click", openExportPanel);

    // Export panel close buttons
    exportPanelClose.addEventListener("click", closeExportPanel);
    exportCloseBtn.addEventListener("click", closeExportPanel);

    // Format pills
    document.querySelectorAll(".export-fmt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".export-fmt-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        exportFormat = (btn as HTMLButtonElement).dataset.format as "mp4" | "webm";
      });
    });

    // Start export
    exportStart.addEventListener("click", async () => {
      if (!player || exporting || !loadedTemplate) return;
      exporting = true;
      exportAbortController = new AbortController();
      setExportState("exporting");
      exportBar.style.width = "0%";
      exportPercent.textContent = "0%";
      updateUI();

      try {
        const w = player.renderWidth;
        const h = player.renderHeight;
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = w;
        exportCanvas.height = h;

        const exportRenderer = new CanvasRenderer(exportCanvas);
        exportRenderer.setOptions({
          fonts: loadedTemplate?.config?.fonts,
          inlineCss: loadedTemplate?.config?.inlineCss,
          stylesheets: loadedTemplate?.config?.stylesheets,
        });
        await exportRenderer.warmup();

        const template = loadedTemplate;
        const fps = player.fps;
        const totalFrames = player.totalFrames;

        const renderAtExportSize = async (frame: number) => {
          if (exportAbortController?.signal.aborted) throw new DOMException("Aborted", "AbortError");
          const mergedData = template.defaults ?? {};
          const ctx = createRenderContext(frame, fps, totalFrames, w, h, mergedData);
          const html = template.render(ctx);
          const compositeHtml = buildCompositeHtml(html, template.config?.background, w, h);
          await exportRenderer.renderFrame(() => compositeHtml, ctx);
        };

        const blob = await exportToVideo(
          exportCanvas,
          { fps: devConfig.fps, width: w, height: h, durationSeconds: devConfig.durationSeconds, format: exportFormat },
          renderAtExportSize,
          {
            onProgress: (f, t) => {
              if (exportAbortController?.signal.aborted) return;
              const pct = Math.round((f / t) * 100);
              exportBar.style.width = `${pct}%`;
              exportPercent.textContent = `${pct}%`;
              setStatus(`Exporting frame ${f}/${t}`);
            },
            onStatusChange: setStatus,
            signal: exportAbortController.signal,
          }
        );
        await exportRenderer.dispose();
        exportedBlob = blob;
        exportSize.textContent = `— ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
        setExportState("done");
        showToast("Export complete!", "success");
        setStatus("Export complete!");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setStatus("Export cancelled");
        } else {
          const msg = e instanceof Error ? e.message : "Unknown";
          showToast(`Export failed: ${msg}`, "error");
          setStatus(`Export failed: ${msg}`);
        }
        setExportState("config");
      } finally {
        exporting = false;
        exportAbortController = null;
        updateUI();
      }
    });

    // Cancel export
    exportCancel.addEventListener("click", () => {
      exportAbortController?.abort();
      setExportState("config");
    });

    // Download exported video
    exportDownload.addEventListener("click", () => {
      if (exportedBlob) {
        downloadBlob(exportedBlob, `export.${exportFormat}`);
      }
    });

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
    setupKeyboardShortcuts();
    connectWebSocket();
    updateUI();
    playerView.classList.add("visible");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    showError(msg);
    showToast(`Error: ${msg}`, "error");
    setStatus(`Error: ${msg}`);
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
