import { createRenderContext, lowerRenderOutput } from "@superimg/core";
import { buildCompositeHtml } from "@superimg/core/html";
import { CanvasRenderer } from "@superimg/browser-export";
import type { BackgroundValue, FontInput, Medium, WatermarkValue } from "@superimg/types";
import { loadTemplate } from "./template-loader";

export interface VideoItem {
  name: string;
  shortName: string;
  relativePath: string;
  hasLocalConfig: boolean;
  sourceKind?: "media" | "collection";
  width?: number;
  height?: number;
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
    const template = (await loadTemplate(
      `/api/videos/${encodeURIComponent(video.name)}/template`,
      { current: null },
      { showOverlay: false },
    )) as {
      config?: {
        width?: number;
        height?: number;
        fps?: number;
        duration?: number;
        fonts?: readonly FontInput[];
        inlineCss?: string[];
        stylesheets?: string[];
        background?: BackgroundValue;
        watermark?: WatermarkValue;
      };
      sample?: Record<string, unknown>;
      data?: Record<string, unknown>;
      render: (ctx: unknown) => unknown;
      medium?: Medium;
    };
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
      ...(config.fonts ? { fonts: config.fonts } : {}),
      ...(config.inlineCss ? { inlineCss: config.inlineCss } : {}),
      ...(config.stylesheets ? { stylesheets: config.stylesheets } : {}),
    });
    await renderer.warmup();

    const data = template.sample ?? template.data ?? {};
    const ctx = createRenderContext(frame, fps, totalFrames, width, height, data, {}, undefined, config.width);
    const html = lowerRenderOutput(template.render(ctx), template.medium, { width, height });
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
