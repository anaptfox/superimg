import { Player } from "superimg/browser";
import type { RenderContext, TemplateModule } from "superimg";

// Template modules for variety
const templates: TemplateModule[] = [
  // Gradient rotation
  {
    config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
    render: (ctx: RenderContext) => {
      const hue = Math.floor(ctx.sceneProgress * 360);
      return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:system-ui;font-size:32px;color:white;background:linear-gradient(120deg, hsl(${hue}, 80%, 40%), #0f0f0f)">Gradient ${(ctx.sceneProgress * 100).toFixed(0)}%</div>`;
    },
  },
  // Pulse animation
  {
    config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
    render: (ctx: RenderContext) => {
      const scale = 0.8 + Math.sin(ctx.sceneProgress * Math.PI * 4) * 0.2;
      return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1a1a2e"><div style="width:80px;height:80px;border-radius:50%;background:#16213e;transform:scale(${scale});box-shadow:0 0 40px rgba(0,149,255,0.8)"></div></div>`;
    },
  },
  // Color bars
  {
    config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
    render: (ctx: RenderContext) => {
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
      const bars = colors.map((c, i) => {
        const height = 20 + Math.sin(ctx.sceneProgress * Math.PI * 2 + i) * 60;
        return `<div style="flex:1;background:${c};height:${height}%"></div>`;
      }).join('');
      return `<div style="width:100%;height:100%;display:flex;align-items:flex-end;background:#0f0f0f">${bars}</div>`;
    },
  },
  // Spinning squares
  {
    config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
    render: (ctx: RenderContext) => {
      const rotate = ctx.sceneProgress * 360;
      return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%)"><div style="width:60px;height:60px;background:white;transform:rotate(${rotate}deg)"></div></div>`;
    },
  },
  // Wave pattern
  {
    config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
    render: (ctx: RenderContext) => {
      return `<div style="width:100%;height:100%;background:#0a0e27;display:flex;align-items:center;justify-content:center;font-size:24px;color:#64ffda">◆ ◇ ◆ ◇<br>Wave ${Math.floor(ctx.sceneProgress * 100)}%</div>`;
    },
  },
  // Gradient sweep
  {
    config: { width: 640, height: 360, fps: 24, durationSeconds: 2 },
    render: (ctx: RenderContext) => {
      const angle = ctx.sceneProgress * 360;
      return `<div style="width:100%;height:100%;background:linear-gradient(${angle}deg, #ee0979 0%, #ff6a00 100%);display:flex;align-items:center;justify-content:center;font-size:28px;color:white;font-weight:bold">SWEEP</div>`;
    },
  },
];

// Sample video data with template assignments
const videos = [
  { id: 1, title: "Amazing Gradient Animation", channel: "SuperImg Channel", views: "1.2M views", avatar: "🎬", template: 0 },
  { id: 2, title: "Colorful Preview Demo", channel: "Design Studio", views: "856K views", avatar: "🎨", template: 2 },
  { id: 3, title: "Smooth Transitions Tutorial", channel: "Web Dev Tips", views: "432K views", avatar: "💻", template: 3 },
  { id: 4, title: "Canvas Rendering Explained", channel: "Tech Talks", views: "234K views", avatar: "⚡", template: 1 },
  { id: 5, title: "Interactive Video Previews", channel: "UI Showcase", views: "678K views", avatar: "✨", template: 4 },
  { id: 6, title: "Performance Optimization Guide", channel: "Code Reviews", views: "345K views", avatar: "🚀", template: 5 },
  { id: 7, title: "Modern Web Animations", channel: "Frontend Weekly", views: "567K views", avatar: "🎯", template: 0 },
  { id: 8, title: "Browser Canvas API Deep Dive", channel: "Dev Insights", views: "123K views", avatar: "🔍", template: 2 },
  { id: 9, title: "Real-time Video Generation", channel: "Innovation Lab", views: "890K views", avatar: "💡", template: 1 },
  { id: 10, title: "WebGL vs Canvas Comparison", channel: "Graphics Pro", views: "456K views", avatar: "🎪", template: 3 },
  { id: 11, title: "Frame-by-Frame Animation", channel: "Animation Hub", views: "789K views", avatar: "🎭", template: 4 },
  { id: 12, title: "Optimized Rendering Pipeline", channel: "Performance Gurus", views: "234K views", avatar: "⚙️", template: 5 },
];

interface VideoCard {
  id: number;
  player: Player;
  hoverTimeout?: number;
  isLoaded: boolean;
  observer: IntersectionObserver;
  resizeObserver: ResizeObserver;
}

const grid = document.querySelector<HTMLDivElement>("#grid");
if (!grid) {
  throw new Error("Grid container not found");
}

const videoCards: VideoCard[] = [];

// Helper to calculate responsive dimensions
function getResponsiveDimensions(container: HTMLElement) {
  const rect = container.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(width * (9 / 16)); // 16:9 aspect ratio
  return { width, height };
}

// Create video cards
videos.forEach((video) => {
  const cardElement = document.createElement("div");
  cardElement.className = "video-card";
  cardElement.setAttribute("data-video-id", video.id.toString());

  const thumbnailContainer = document.createElement("div");
  thumbnailContainer.className = "thumbnail-container";

  const thumbnail = document.createElement("div");
  thumbnail.className = "thumbnail";
  thumbnail.id = `preview-${video.id}`;

  thumbnailContainer.appendChild(thumbnail);
  cardElement.appendChild(thumbnailContainer);

  const videoInfo = document.createElement("div");
  videoInfo.className = "video-info";

  const avatar = document.createElement("div");
  avatar.className = "channel-avatar";
  avatar.textContent = video.avatar;

  const details = document.createElement("div");
  details.className = "video-details";

  const title = document.createElement("h3");
  title.className = "video-title";
  title.textContent = video.title;

  const channelName = document.createElement("p");
  channelName.className = "channel-name";
  channelName.textContent = video.channel;

  const meta = document.createElement("p");
  meta.className = "video-meta";
  meta.textContent = video.views;

  details.appendChild(title);
  details.appendChild(channelName);
  details.appendChild(meta);

  videoInfo.appendChild(avatar);
  videoInfo.appendChild(details);
  cardElement.appendChild(videoInfo);

  grid.appendChild(cardElement);

  // Get initial dimensions
  const initialDims = getResponsiveDimensions(thumbnailContainer);

  // Create player instance with new options
  const player = new Player({
    container: `#preview-${video.id}`,
    width: initialDims.width,
    height: initialDims.height,
    playbackMode: "loop",
    loadMode: "lazy",
    maxCacheFrames: 30,
  });

  // ResizeObserver to handle responsive canvas sizing
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const dims = getResponsiveDimensions(entry.target as HTMLElement);
      const canvas = thumbnail.querySelector("canvas");
      if (canvas && (Math.abs(canvas.width - dims.width) > 10 || Math.abs(canvas.height - dims.height) > 10)) {
        canvas.width = dims.width;
        canvas.height = dims.height;
        canvas.style.width = `${dims.width}px`;
        canvas.style.height = `${dims.height}px`;
      }
    }
  });

  resizeObserver.observe(thumbnailContainer);

  // Intersection Observer for lazy loading
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const card = videoCards.find((c) => c.id === video.id);
        if (entry.isIntersecting && card && !card.isLoaded) {
          card.isLoaded = true;
          const template = templates[video.template];
          player.load(template).then((result) => {
            if (result.status === "success") {
              player.seekToFrame(0);
            }
          });
        }
      });
    },
    { rootMargin: "100px" }
  );

  observer.observe(cardElement);

  // Hover with 200ms debounce delay
  cardElement.addEventListener("mouseenter", () => {
    const card = videoCards.find((c) => c.id === video.id);
    if (card) {
      card.hoverTimeout = window.setTimeout(() => {
        if (card.player.isReady) {
          card.player.play();
        }
      }, 200);
    }
  });

  cardElement.addEventListener("mouseleave", () => {
    const card = videoCards.find((c) => c.id === video.id);
    if (card) {
      if (card.hoverTimeout) {
        clearTimeout(card.hoverTimeout);
        card.hoverTimeout = undefined;
      }
      if (card.player.isReady) {
        card.player.pause();
        card.player.seekToFrame(0);
      }
    }
  });

  videoCards.push({
    id: video.id,
    player,
    isLoaded: false,
    observer,
    resizeObserver,
  });
});
