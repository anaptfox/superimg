//! Dev UI home grid — template list with hover previews + lazy thumbnails.

import { Player } from "@superimg/player";
import { homeView, videoGrid } from "./dom";
import { loadTemplate, type BundleState } from "./template-loader";
import { generateThumbnail, type VideoItem } from "./thumbnails";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}

export function formatDisplayName(shortName: string): string {
  return shortName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatCategory(relativePath: string): string {
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  const dirs = parts.slice(0, -1).filter((part) => part !== "examples");
  return dirs[0] ?? "Programs";
}

export function getTemplateDisplayName(path: string): string {
  if (path.startsWith("/api/videos/") && path.endsWith("/template")) {
    const name = path.replace("/api/videos/", "").replace("/template", "");
    const decoded = decodeURIComponent(name);
    const short = decoded.split("/").filter(Boolean).at(-1) ?? decoded;
    return formatDisplayName(short);
  }
  return "Media program";
}

export function titleFromTemplateDir(dir?: string): string | null {
  if (!dir) return null;
  const base = dir.split(/[/\\]/).filter(Boolean).at(-1);
  return base ? formatDisplayName(base) : null;
}

function setHomeCount(count: number | null, note?: string): void {
  const countEl = document.getElementById("home-count");
  if (!countEl) return;
  if (note) {
    countEl.textContent = note;
    return;
  }
  countEl.textContent = count === 1 ? "1 program" : `${count ?? 0} programs`;
}

function showHomeMessage(kind: "empty" | "error", message: string): void {
  videoGrid.innerHTML = `<div class="si-${kind}">${message}</div>`;
  homeView.classList.add("visible");
}

function groupVideos(videos: VideoItem[]): Map<string, VideoItem[]> {
  const groups = new Map<string, VideoItem[]>();
  for (const video of videos) {
    const category = formatCategory(video.relativePath);
    const list = groups.get(category) ?? [];
    list.push(video);
    groups.set(category, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => formatDisplayName(a.shortName).localeCompare(formatDisplayName(b.shortName)));
  }
  return new Map(
    [...groups.entries()].sort(([a], [b]) => {
      const rank = (name: string) => (name.startsWith("_") || name === "Programs" ? 1 : 0);
      return rank(a) - rank(b) || formatDisplayName(a).localeCompare(formatDisplayName(b));
    }),
  );
}

function bindCard(card: HTMLElement, video: VideoItem, bundleState: BundleState): void {
  const previewContainer = card.querySelector(".preview-container") as HTMLDivElement;
  const thumbnailImg = card.querySelector(".thumbnail-img") as HTMLImageElement;
  const placeholder = card.querySelector(".thumbnail-placeholder") as HTMLDivElement;
  let hoverPlayer: Player | null = null;
  let hoverTimeout: ReturnType<typeof setTimeout>;
  let thumbnailGenerated = false;

  const observer = new IntersectionObserver(
    async (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !thumbnailGenerated) {
          thumbnailGenerated = true;
          observer.disconnect();
          try {
            await generateThumbnail(video, thumbnailImg, placeholder);
          } catch {
            placeholder.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)"><path d="M8 5v14l11-7z"/></svg>`;
          }
        }
      }
    },
    { threshold: 0.1 },
  );
  observer.observe(card);

  if (video.sourceKind === "collection") {
    thumbnailGenerated = true;
    placeholder.innerHTML = `<span class="si-card-kind">Collection</span>`;
  }

  card.addEventListener("mouseenter", () => {
    if (video.sourceKind === "collection") return;
    hoverTimeout = setTimeout(async () => {
      try {
        thumbnailImg.style.opacity = "0";
        hoverPlayer = new Player({
          container: previewContainer,
          size: { width: video.width ?? 1920, height: video.height ?? 1080 },
          playbackMode: "loop",
        });
        const mod = (await loadTemplate(
          `/api/videos/${encodeURIComponent(video.name)}/template`,
          bundleState,
          { showOverlay: false },
        )) as { default?: unknown };
        await hoverPlayer.load(((mod as { default?: unknown }).default ?? mod) as Parameters<Player["load"]>[0]);
        hoverPlayer.play();
      } catch {
        thumbnailImg.style.opacity = "1";
      }
    }, 300);
  });

  card.addEventListener("mouseleave", () => {
    clearTimeout(hoverTimeout);
    if (hoverPlayer) {
      hoverPlayer.dispose();
      hoverPlayer = null;
    }
    thumbnailImg.style.opacity = "1";
  });

  card.addEventListener("click", () => {
    const url = new URL(location.href);
    url.searchParams.set(
      "template",
      `/api/videos/${encodeURIComponent(video.name)}/template`,
    );
    location.href = url.toString();
  });

  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      card.click();
    }
  });
}

function createCard(video: VideoItem): HTMLElement {
  const card = document.createElement("article");
  card.className = "si-card";
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="preview-container si-card-stage">
      <div class="thumbnail-placeholder si-card-ph">
        <div class="loading-spinner"></div>
      </div>
      <img class="thumbnail-img si-card-thumb" alt="" />
    </div>
    <div class="si-card-meta">
      <div class="si-card-title">${escapeHtml(formatDisplayName(video.shortName))}</div>
    </div>
  `;
  return card;
}

export async function initHome(bundleState: BundleState): Promise<void> {
  try {
    const res = await fetch("/api/videos");
    if (!res.ok) {
      setHomeCount(null, "Library unavailable");
      showHomeMessage(
        "empty",
        "The videos API is not available on this preview. Reload from the project root, or open a single program and use All media.",
      );
      return;
    }
    const videos: VideoItem[] = await res.json();
    if (videos.length === 0) {
      setHomeCount(0);
      showHomeMessage(
        "empty",
        "No media programs in this project.<br>Create a <code>*.media.ts</code> file — or run <code>superimg init</code>.",
      );
      return;
    }

    setHomeCount(videos.length);
    videoGrid.innerHTML = "";
    for (const [category, items] of groupVideos(videos)) {
      const section = document.createElement("section");
      section.className = "si-library-group";
      section.innerHTML = `<h2 class="si-library-kicker">${escapeHtml(formatDisplayName(category))}</h2>`;
      const grid = document.createElement("div");
      grid.className = "si-grid";
      for (const video of items) {
        const card = createCard(video);
        bindCard(card, video, bundleState);
        grid.appendChild(card);
      }
      section.appendChild(grid);
      videoGrid.appendChild(section);
    }
    homeView.classList.add("visible");
  } catch (e) {
    setHomeCount(null, "Could not load");
    showHomeMessage("error", `Could not load media: ${escapeHtml(String(e))}`);
  }
}
