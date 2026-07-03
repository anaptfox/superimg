import { createRenderContext } from "@superimg/core";
import { buildCompositeHtml } from "@superimg/core/html";
import { CanvasRenderer } from "@superimg/runtime";
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
  const tempContainer = document.createElement("div");
  tempContainer.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:400px;height:225px;";
  document.body.appendChild(tempContainer);

  try {
    const mod = await loadTemplate(`/api/videos/${encodeURIComponent(video.name)}/template`);
    const template = mod.default ?? mod;
    const config = template.config ?? {};
    const width = config.width ?? 1920;
    const height = config.height ?? 1080;
    const fps = config.fps ?? 30;
    const duration = typeof config.duration === "number" ? config.duration : 5;
    const totalFrames = Math.max(1, Math.floor(fps * duration));
    const frame = Math.floor(totalFrames / 2);

    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 225;
    const renderer = new CanvasRenderer(canvas);
    renderer.setOptions({
      fonts: config.fonts,
      inlineCss: config.inlineCss,
      stylesheets: config.stylesheets,
    });
    await renderer.warmup();

    const data = template.sample ?? template.data ?? {};
    const ctx = createRenderContext(frame, fps, totalFrames, width, height, data, "default", {}, undefined, config.width);
    const html = template.render(ctx);
    const compositeHtml = buildCompositeHtml(html, config.background, config.watermark, width, height);
    await renderer.renderFrame(() => compositeHtml, ctx);
    await renderer.dispose();

    thumbnailImg.src = canvas.toDataURL("image/jpeg", 0.85);
    thumbnailImg.onload = () => {
      thumbnailImg.style.opacity = "1";
      placeholder.style.opacity = "0";
    };
  } finally {
    document.body.removeChild(tempContainer);
  }
}