//! SuperImg Dev Server - Main entry point
//! Uses shared player infrastructure from @superimg/core (formerly browser)

import {
  createRenderContext,
  createPlayerStore,
  CanvasRenderer,
  get2DContext,
  createPlaybackController,
  createTimelineController,
  exportToVideo,
  downloadBlob,
  formatTime,
} from "superimg";
import type {
  RenderContext,
  PlayerConfig,
  PlayerStore,
} from "superimg";

// --- Type Definitions ---
interface DevConfig {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  outputs?: Record<string, { width?: number; height?: number; fps?: number }>;
}

interface TemplateModule {
  render: (ctx: RenderContext) => string;
  defaults?: Record<string, unknown>;
}

// --- DOM Elements ---
const canvas = document.getElementById("preview-canvas") as HTMLCanvasElement;
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

// --- State ---
let config: PlayerConfig;
let devConfig: DevConfig;
let store: PlayerStore;
let playbackController: ReturnType<typeof createPlaybackController>;
let previewSink: CanvasRenderer;
let template: TemplateModule | null = null;
let templatePath = "/template.js";

let currentRenderFrame: number | null = null; // Frame currently being rendered
let targetFrame: number = 0; // Latest requested frame

// --- Export state ---
let exporting = false;

// --- UI Updates ---
function setStatus(message: string) {
  statusEl.textContent = message;
}

function updateUI() {
  const state = store.getState();
  playPauseBtn.textContent = state.isPlaying ? "Pause" : "Play";
  playPauseBtn.disabled = exporting;
  exportBtn.disabled = exporting;
}

// --- Template Loading ---
async function loadTemplate(path: string): Promise<TemplateModule> {
  const templateUrl = `${path}?t=${Date.now()}`;
  const mod = await import(/* @vite-ignore */ templateUrl);
  if (mod.render) return mod;
  if (mod.default?.render) return mod.default;
  return mod;
}

function reloadTemplate() {
  // Save current playback state
  const state = store.getState();
  const currentFrame = state.currentFrame;
  const wasPlaying = state.isPlaying;

  // Pause playback during reload to avoid race conditions
  if (wasPlaying) {
    state.pause();
  }

  state.clearCache();

  loadTemplate(templatePath)
    .then((t) => {
      template = t;
      // Re-render current frame with new template
      renderFrame(currentFrame);
      setStatus("Template reloaded");

      // Resume playback if it was playing before
      if (wasPlaying) {
        state.play();
      }
    })
    .catch((e) => {
      setStatus(`Error reloading template: ${e.message}`);
      console.error("Error reloading template:", e);
      // Resume playback even on error to maintain user expectation
      if (wasPlaying) {
        state.play();
      }
    });
}

// --- Rendering ---
function renderErrorOnCanvas(ctx: CanvasRenderingContext2D, message: string): void {
  ctx.fillStyle = "#8b0000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Error: ${message}`, canvas.width / 2, canvas.height / 2);
}

async function renderFrame(frame: number) {
  if (!template || !previewSink) return;

  const state = store.getState();

  // Track the latest requested frame
  targetFrame = frame;

  // Check cache first (fast path)
  if (state.frameCache.has(frame)) {
    const imageData = state.frameCache.get(frame)!;
    const ctx = get2DContext(canvas);
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  // Skip if another render is in progress - that render will
  // check targetFrame when done and render the latest if needed
  if (currentRenderFrame !== null) {
    return;
  }

  // Mark this frame as rendering
  currentRenderFrame = frame;

  try {
    const data = template.defaults ?? {};
    const renderCtx = await createRenderContext(
      frame,
      state.fps,
      state.totalFrames,
      canvas.width,
      canvas.height,
      data
    );

    if (typeof template.render === "function") {
      const imageData = await previewSink.renderFrame(template.render, renderCtx);
      state.frameCache.set(frame, imageData);

      // Only draw if this is still the target frame (not stale)
      if (frame === targetFrame) {
        const ctx = get2DContext(canvas);
        ctx.putImageData(imageData, 0, 0);
      }
    } else {
      const ctx = get2DContext(canvas);
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Template render function not found", canvas.width / 2, canvas.height / 2);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Render error:", error);
    setStatus(`Render error: ${message}`);
    const ctx = get2DContext(canvas);
    renderErrorOnCanvas(ctx, message);
  } finally {
    currentRenderFrame = null;

    // If user requested a different frame while we were rendering, render it now
    if (targetFrame !== frame && !state.frameCache.has(targetFrame)) {
      renderFrame(targetFrame);
    }
  }
}

// --- WebSocket for Hot Reload ---
function connectWebSocket() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${proto}//${location.host}/ws`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("WebSocket connected");
    setStatus("Connected for auto-reloading");
  };

  ws.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "reload") {
        console.log("Reloading via WebSocket...");
        reloadTemplate();
      }
    } catch (e) {
      console.error("Failed to parse WebSocket message", e);
    }
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected. Reconnecting in 2 seconds...");
    setStatus("Disconnected. Retrying...");
    setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
}

// --- Output Selection ---
async function setOutput(newWidth: number, newHeight: number) {
  store.getState().clearCache();
  canvas.width = newWidth;
  canvas.height = newHeight;
  previewSink = new CanvasRenderer(canvas);
  await previewSink.warmup();
  renderFrame(store.getState().currentFrame);
}

// --- Event Listeners ---
playPauseBtn.addEventListener("click", () => {
  store.getState().togglePlayPause();
});

exportBtn.addEventListener("click", async () => {
  const state = store.getState();
  if (!template || exporting) return;

  exporting = true;
  updateUI();

  try {
    const blob = await exportToVideo(canvas, {
      ...config,
      width: canvas.width,
      height: canvas.height,
    }, renderFrame, {
      onProgress: (frame, total) => {
        setStatus(`Exporting frame ${frame + 1}/${total}`);
      },
      onStatusChange: setStatus,
    });

    downloadBlob(blob, "export.mp4");
    setStatus("Export complete!");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    setStatus(`Export failed: ${message}`);
    console.error("Export error:", error);
  } finally {
    exporting = false;
    updateUI();
  }
});

reloadBtn.addEventListener("click", reloadTemplate);

outputSelect.addEventListener("change", async (e) => {
  if (!devConfig) return;
  const selected = (e.target as HTMLSelectElement).value;
  let newWidth = devConfig.width;
  let newHeight = devConfig.height;

  if (selected && devConfig.outputs && devConfig.outputs[selected]) {
    const preset = devConfig.outputs[selected];
    newWidth = preset.width ?? newWidth;
    newHeight = preset.height ?? newHeight;
  }

  await setOutput(newWidth, newHeight);
  setStatus(`Output: ${selected || "Default"} (${newWidth}x${newHeight})`);
});

// --- Initialize ---
async function init() {
  try {
    setStatus("Loading config...");

    const params = new URLSearchParams(location.search);
    templatePath = params.get("template") || "/template.js";

    const configRes = await fetch("/api/config");
    if (!configRes.ok) throw new Error(`Failed to load config: ${configRes.statusText}`);
    devConfig = await configRes.json();

    // Set up player config
    config = {
      fps: devConfig.fps,
      durationSeconds: devConfig.durationSeconds,
    };

    // Populate output select
    if (devConfig.outputs) {
      for (const [name, preset] of Object.entries(devConfig.outputs)) {
        const p = preset as { width?: number; height?: number };
        const option = document.createElement("option");
        option.value = name;
        option.textContent = `${name} (${p.width ?? devConfig.width}x${p.height ?? devConfig.height})`;
        outputSelect.appendChild(option);
      }
    }

    setStatus("Initializing preview...");
    canvas.width = devConfig.width;
    canvas.height = devConfig.height;
    previewSink = new CanvasRenderer(canvas);
    await previewSink.warmup(); // Pre-cache fonts before first render

    // Create store - immediately available with correct totalFrames
    store = createPlayerStore(config, {
      onPlay: () => playbackController.play(store.getState().currentFrame),
      onPause: () => playbackController.pause(),
      onFrameChange: (frame) => renderFrame(frame),
    });

    // Subscribe for UI updates
    store.subscribe(() => updateUI());

    // Create playback controller
    playbackController = createPlaybackController(store, {
      onFrame: (frame) => {
        store.getState().setFrame(frame);
        setStatus(`Playing frame ${frame}/${store.getState().totalFrames}`);
      },
      onEnd: () => {
        store.getState().pause();
        store.getState().setFrame(store.getState().totalFrames - 1);
      },
    });

    // Create timeline controller - pass store directly
    const timelineController = createTimelineController(
      {
        progress: timelineProgress,
        playhead: timelinePlayhead,
        currentTime: currentTimeEl,
        totalTime: totalTimeEl,
      },
      store
    );
    timelineController.attach(timelineContainer);

    setStatus("Loading template...");
    template = await loadTemplate(templatePath);

    setStatus("Ready - Click Play to start preview");
    await renderFrame(0);

    connectWebSocket();
    updateUI();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Error: ${message}`);
    console.error("Initialization error:", error);
    const ctx = get2DContext(canvas);
    renderErrorOnCanvas(ctx, message);
  }
}

init();
