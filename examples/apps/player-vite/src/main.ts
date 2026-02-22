import { Player } from "superimg/browser";
import type { RenderContext, TemplateModule } from "superimg";

// Template module for demo
const template: TemplateModule = {
  config: { width: 640, height: 360, fps: 30, durationSeconds: 5 },
  render: (ctx: RenderContext) => {
    const { sceneProgress: progress, sceneFrame: frame, sceneTotalFrames } = ctx;
    const hue = Math.floor(progress * 360);
    return `
      <div style="
        width:100%;height:100%;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        font-family:system-ui;color:white;
        background:linear-gradient(120deg, hsl(${hue}, 80%, 35%), #111);
      ">
        <div style="font-size:28px;margin-bottom:12px">Demo Player</div>
        <div style="font-size:18px;opacity:0.8">Frame ${frame} / ${sceneTotalFrames}</div>
      </div>
    `;
  },
};

// Create player
const player = new Player({
  container: "#player",
  width: 640,
  height: 360,
  playbackMode: "loop",
});

// Load template
const result = await player.load(template);

if (result.status === "success") {
  console.log(`Loaded: ${result.totalFrames} frames`);
}

// Create simple timeline
const timelineContainer = document.querySelector("#timeline") as HTMLElement;
if (timelineContainer && player.store) {
  const progressEl = document.createElement("div");
  progressEl.style.cssText = "position:absolute;left:0;top:0;bottom:0;background:#3b82f6;border-radius:4px;transition:width 0.05s;";
  const playheadEl = document.createElement("div");
  playheadEl.style.cssText = "position:absolute;top:50%;width:12px;height:12px;background:#fff;border-radius:50%;transform:translate(-50%,-50%);transition:left 0.05s;";

  timelineContainer.style.cssText = "position:relative;height:20px;background:#333;border-radius:4px;cursor:pointer;margin:20px 0;";
  timelineContainer.appendChild(progressEl);
  timelineContainer.appendChild(playheadEl);

  // Subscribe to store updates
  player.store.subscribe((state) => {
    const progress = state.currentFrame / (state.totalFrames - 1);
    progressEl.style.width = `${progress * 100}%`;
    playheadEl.style.left = `${progress * 100}%`;
  });

  // Click to seek
  timelineContainer.addEventListener("click", (e) => {
    const rect = timelineContainer.getBoundingClientRect();
    const progress = (e.clientX - rect.left) / rect.width;
    player.seekToProgress(progress);
  });
}

// Play/pause buttons
const playBtn = document.querySelector("#play-btn") as HTMLButtonElement;
const pauseBtn = document.querySelector("#pause-btn") as HTMLButtonElement;

playBtn?.addEventListener("click", () => player.play());
pauseBtn?.addEventListener("click", () => player.pause());

// Auto-play
player.play();
