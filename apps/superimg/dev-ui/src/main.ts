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
let templatePath = "/template.js";
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

async function init() {
  try {
    setStatus("Loading config...");
    const params = new URLSearchParams(location.search);
    templatePath = params.get("template") || "/api/template";

    const configRes = await fetch("/api/config");
    if (!configRes.ok) throw new Error(`Failed to load config: ${configRes.statusText}`);
    devConfig = await configRes.json();

    if (devConfig.outputs) {
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
  } catch (error) {
    setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
  }
}

init();
