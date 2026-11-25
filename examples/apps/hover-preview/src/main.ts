import { Player } from "@foxworth/superimg/player";
import preview, { previews } from "../../_shared/preview.media";

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
  loading: Promise<void> | null;
  wantsPlayback: boolean;
  disposed: boolean;
  observer: IntersectionObserver;
}

const grid = document.querySelector<HTMLDivElement>("#grid");
if (!grid) {
  throw new Error("Grid container not found");
}

const videoCards: VideoCard[] = [];

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

  // The host owns visibility, loading, and keyboard/pointer intent.
  const player = new Player({ container: thumbnail, size: { width: 640, height: 360 }, playbackMode: "loop" });
  cardElement.tabIndex = 0;
  cardElement.setAttribute("aria-label", `${video.title}: focus to preview`);
  const card: VideoCard = { id: video.id, player, loading: null, wantsPlayback: false, disposed: false, observer: null! };
  function load(): Promise<void> {
    if (card.disposed || player.isReady) return Promise.resolve();
    if (card.loading) return card.loading;
    card.loading = (async () => {
      const result = await player.load(preview, { data: previews[video.template] });
      if (card.disposed) return;
      if (result.status !== "success") throw new Error(result.message);
      if (card.wantsPlayback) player.play();
      card.observer.unobserve(cardElement);
    })().catch(error => {
      if (!card.disposed) thumbnail.textContent = `Preview unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }).finally(() => { card.loading = null; });
    return card.loading;
  }
  card.observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) void load();
  }, { rootMargin: "100px" });
  card.observer.observe(cardElement);
  const enter = () => {
    clearTimeout(card.hoverTimeout);
    card.hoverTimeout = window.setTimeout(() => {
      card.wantsPlayback = true;
      if (player.isReady) player.play();
      else void load();
    }, 200);
  };
  const leave = () => {
    if (cardElement.matches(":hover, :focus-within")) return;
    clearTimeout(card.hoverTimeout);
    card.wantsPlayback = false;
    if (player.isReady) { player.pause(); void player.seek({ frame: 0 }); }
  };
  cardElement.addEventListener("mouseenter", enter);
  cardElement.addEventListener("mouseleave", leave);
  cardElement.addEventListener("focusin", enter);
  cardElement.addEventListener("focusout", leave);
  videoCards.push(card);
});

if (import.meta.hot) import.meta.hot.dispose(() => {
  for (const card of videoCards) {
    card.disposed = true;
    clearTimeout(card.hoverTimeout);
    card.observer.disconnect();
    card.player.dispose();
  }
  grid.replaceChildren();
});
