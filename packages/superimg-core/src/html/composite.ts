//! Pure per-frame HTML composition without page-shell or font capabilities.

import type { BackgroundValue, WatermarkValue } from "@superimg/types";
import { resolveBackground } from "../shared/assets.js";
import { escapeCssUrl, escapeHtmlAttr } from "./sanitize.js";

/**
 * Build composite HTML from template output and optional config background/watermark.
 *
 * The template wrapper is transparent. Authors own fill (`Fill` / root CSS /
 * `config.background`). Do not paint a near-black floor here — uncolored text
 * on `#07070c` exports as a successful blank PNG.
 */
export function buildCompositeHtml(
  templateHtml: string,
  background: BackgroundValue | undefined,
  watermark: WatermarkValue | undefined,
  width: number,
  height: number,
): string {
  const layers: string[] = [];

  if (background !== undefined) {
    const resolved = resolveBackground(background);
    if (resolved.type === "solid") {
      const safeSrc = escapeHtmlAttr(resolved.src);
      layers.push(
        `<div style="position:absolute;inset:0;background:${safeSrc};opacity:${resolved.opacity}"></div>`,
      );
    } else if (resolved.type === "image") {
      const fit = resolved.fit === "contain" ? "contain" : "cover";
      const safeSrc = escapeCssUrl(resolved.src);
      layers.push(
        `<div style="position:absolute;inset:0;background:url('${safeSrc}') center/${fit} no-repeat;opacity:${resolved.opacity}"></div>`,
      );
    }
  }

  layers.push(
    `<div style="position:absolute;inset:0;overflow:hidden">${templateHtml}</div>`,
  );

  if (watermark) layers.push(buildWatermarkHtml(watermark));
  return layers.join("\n");
}

function buildWatermarkHtml(watermark: WatermarkValue): string {
  const options =
    typeof watermark === "string"
      ? {
          content: watermark,
          type: "image",
          position: "bottom-right",
          opacity: 0.8,
          width: undefined,
          height: undefined,
          style: undefined,
          className: undefined,
          href: undefined,
        }
      : {
          ...watermark,
          opacity: watermark.opacity ?? 0.8,
          position: watermark.position ?? "bottom-right",
        };

  let type = options.type;
  if (!type) {
    if (options.content.startsWith("<")) type = "html";
    else if (
      options.content.match(/\.(png|jpe?g|gif|webp|svg)$/i) ||
      options.content.startsWith("data:image")
    ) {
      type = "image";
    } else type = "text";
  }

  const safeContent = type === "html" ? options.content : escapeHtmlAttr(options.content);
  let contentHtml: string;
  if (type === "image") {
    const widthStyle = options.width
      ? `width:${options.width}${typeof options.width === "number" ? "px" : ""};`
      : "";
    const heightStyle = options.height
      ? `height:${options.height}${typeof options.height === "number" ? "px" : ""};`
      : "";
    contentHtml = `<img src="${safeContent}" style="${widthStyle}${heightStyle}" alt="Watermark" />`;
  } else if (type === "text") contentHtml = `<span>${options.content}</span>`;
  else contentHtml = options.content;

  const positions: Record<string, string> = {
    "bottom-right": "bottom: 20px; right: 20px;",
    "bottom-left": "bottom: 20px; left: 20px;",
    "top-right": "top: 20px; right: 20px;",
    "top-left": "top: 20px; left: 20px;",
    center: "top: 50%; left: 50%; transform: translate(-50%, -50%);",
  };
  const positionStyle = positions[options.position as string] ?? positions["bottom-right"];
  const customStyle = options.style
    ? Object.entries(options.style)
        .map(([key, value]) => `${key}:${value}`)
        .join(";")
    : "";
  const containerStyle = `position: absolute; z-index: 9999; opacity: ${options.opacity}; ${positionStyle} ${customStyle}`;
  const containerClass = options.className
    ? ` class="${escapeHtmlAttr(options.className)}"`
    : "";
  let html = `<div style="${containerStyle}"${containerClass}>${contentHtml}</div>`;
  if (options.href) {
    const safeHref = escapeHtmlAttr(options.href);
    html = `<a href="${safeHref}" target="_blank" style="all: unset; cursor: pointer;">${html}</a>`;
  }
  return html;
}
