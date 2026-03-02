//! SuperImg Dev Server - Main entry point (uses Player)

import {
  Player,
  createTimelineController,
  exportToVideo,
  downloadBlob,
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

let player: Player | null = null;
let devConfig: DevConfig;
let templatePath = "/api/template";
let configPath = "/api/config";
let exporting = false;

function setStatus(message: string) {
  statusEl.textContent = message;
}

function updateUI() {
  if (!player) return;
  playPauseBtn.textContent = player.isPlaying ? "Pause" : "Play";
  playPauseBtn.disabled = exporting;
  exportBtn.disabled = exporting;
}

async function loadTemplate(path: string) {
  const url = `${path}?t=${Date.now()}`;
  const mod = await import(/* @vite-ignore */ url);
  return mod.default ?? mod;
}

function reloadTemplate() {
  if (!player) return;
  const wasPlaying = player.isPlaying;
  if (wasPlaying) player.pause();

  loadTemplate(templatePath)
    .then((t) => {
      player!.load(t).then(() => {
        setStatus("Template reloaded");
        if (wasPlaying) player!.play();
      });
    })
    .catch((e) => {
      setStatus(`Error reloading template: ${e.message}`);
      if (wasPlaying) player!.play();
    });
}

function connectWebSocket() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onopen = () => setStatus("Connected for auto-reloading");
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

async function initHome() {
  try {
    const res = await fetch("/api/videos");
    if (!res.ok) {
      homeView.innerHTML = `<div style="padding: 2rem; text-align: center; color: #888;">No videos API. Run with a template: superimg dev intro</div>`;
      homeView.classList.add("visible");
      return;
    }
    const videos: VideoItem[] = await res.json();
    if (videos.length === 0) {
      homeView.innerHTML = `<div style="padding: 2rem; text-align: center; color: #888;">No videos found. Create a *.video.ts file or run superimg init.</div>`;
      homeView.classList.add("visible");
      return;
    }

    videoGrid.innerHTML = "";
    for (const video of videos) {
      const card = document.createElement("div");
      card.className = "video-card";
      card.innerHTML = `
        <div class="video-card-preview"><span class="loading">Hover to preview</span></div>
        <div class="video-card-info">
          <div class="name">${escapeHtml(video.name)}</div>
          <div class="path">${escapeHtml(video.relativePath)}</div>
        </div>
      `;
      const previewEl = card.querySelector(".video-card-preview") as HTMLDivElement;
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
              width: w,
              height: h,
              playbackMode: "loop",
            });
            const mod = await loadTemplate(`/api/videos/${encodeURIComponent(video.name)}/template`);
            await hoverPlayer.load(mod.default ?? mod);
            hoverPlayer.play();
          } catch (e) {
            previewEl.innerHTML = `<span class="loading">Error loading</span>`;
          }
        }, 300);
      });

      card.addEventListener("mouseleave", () => {
        clearTimeout(hoverTimeout);
        if (hoverPlayer) {
          hoverPlayer.pause();
          hoverPlayer = null;
        }
        previewEl.innerHTML = `<span class="loading">Hover to preview</span>`;
      });

      card.addEventListener("click", () => {
        const url = new URL(location.href);
        url.searchParams.set("template", `/api/videos/${encodeURIComponent(video.name)}/template`);
        location.href = url.toString();
      });

      videoGrid.appendChild(card);
    }
    homeView.classList.add("visible");
  } catch (e) {
    homeView.innerHTML = `<div style="padding: 2rem; text-align: center; color: #e55;">Error: ${escapeHtml(String(e))}</div>`;
    homeView.classList.add("visible");
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

async function initPlayer() {
  try {
    setStatus("Loading config...");
    const params = new URLSearchParams(location.search);
    templatePath = params.get("template") || "/api/template";

    if (templatePath.startsWith("/api/videos/") && templatePath.endsWith("/template")) {
      configPath = templatePath.replace("/template", "/config");
    } else {
      configPath = "/api/config";
    }

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

    setStatus("Initializing preview...");
    player = new Player({
      container: "#preview-container",
      width: devConfig.width,
      height: devConfig.height,
      playbackMode: "loop",
    });

    player.on("play", updateUI);
    player.on("pause", updateUI);
    player.on("frame", (f) => setStatus(`Playing frame ${f}/${player!.totalFrames}`));

    setStatus("Loading template...");
    const template = await loadTemplate(templatePath);
    const result = await player.load(template);

    if (result.status === "error") throw new Error(result.message);

    const store = player.store!;
    store.subscribe(updateUI);

    const timelineController = createTimelineController(
      { progress: timelineProgress, playhead: timelinePlayhead, currentTime: currentTimeEl, totalTime: totalTimeEl },
      store
    );
    timelineController.attach(timelineContainer);

    playPauseBtn.addEventListener("click", () => store.getState().togglePlayPause());
    reloadBtn.addEventListener("click", reloadTemplate);

    exportBtn.addEventListener("click", async () => {
      if (!player || exporting) return;
      exporting = true;
      updateUI();
      try {
        const blob = await exportToVideo(
          player.canvasElement,
          { fps: devConfig.fps, width: player.canvasElement.width, height: player.canvasElement.height, durationSeconds: devConfig.durationSeconds },
          (frame) => player!.renderFrame(frame),
          { onProgress: (f, t) => setStatus(`Exporting frame ${f}/${t}`), onStatusChange: setStatus }
        );
        downloadBlob(blob, "export.mp4");
        setStatus("Export complete!");
      } catch (e) {
        setStatus(`Export failed: ${e instanceof Error ? e.message : "Unknown"}`);
      } finally {
        exporting = false;
        updateUI();
      }
    });

    outputSelect.addEventListener("change", async (e) => {
      if (!devConfig) return;
      const sel = (e.target as HTMLSelectElement).value;
      let w = devConfig.width;
      let h = devConfig.height;
      if (sel && devConfig.outputs?.[sel]) {
        w = devConfig.outputs[sel].width ?? w;
        h = devConfig.outputs[sel].height ?? h;
      }
      await player!.resize(w, h);
      setStatus(`Output: ${sel || "Default"} (${w}x${h})`);
    });

    setStatus("Ready - Click Play to start preview");
    connectWebSocket();
    updateUI();
    playerView.classList.add("visible");
  } catch (error) {
    setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
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
