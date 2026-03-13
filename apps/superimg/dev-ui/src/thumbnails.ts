import { Player } from "superimg";
import { loadTemplate } from "./main";

export interface VideoItem {
  name: string;
  shortName: string;
  relativePath: string;
  hasLocalConfig: boolean;
}

export async function generateThumbnail(
  video: VideoItem,
  thumbnailImg: HTMLImageElement,
  placeholder: HTMLDivElement
): Promise<void> {
  // Create offscreen container for player
  const tempContainer = document.createElement("div");
  tempContainer.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:400px;height:225px;";
  document.body.appendChild(tempContainer);

  try {
    const configRes = await fetch(`/api/videos/${encodeURIComponent(video.name)}/config`);
    const config = await configRes.json();
    const w = 400;
    const h = Math.round(w * ((config.height ?? 1080) / (config.width ?? 1920)));

    const player = new Player({
      container: tempContainer,
      format: { width: w, height: h }
    });

    const mod = await loadTemplate(`/api/videos/${encodeURIComponent(video.name)}/template`);
    await player.load(mod.default ?? mod);

    // Capture thumbnail using smart frame selection
    const { dataUrl } = await player.captureFrame({ format: "dataUrl" });

    player.destroy();

    // Set thumbnail
    thumbnailImg.src = dataUrl!;
    thumbnailImg.onload = () => {
      thumbnailImg.style.opacity = "1";
      placeholder.style.opacity = "0";
    };
  } finally {
    document.body.removeChild(tempContainer);
  }
}
