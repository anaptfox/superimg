import type { Medium, OutputFormat, TemplateConfig } from "@superimg/types";

/** Host-facing output kind (e.g. gumbo's `MediaKind`). */
export type MediaKind = "video" | "image" | "gif" | "svg";

export function inferMediaKind(
  medium: Medium,
  animated: boolean,
  templateConfig?: TemplateConfig,
): MediaKind {
  if (medium === "svg") return "svg";
  if (!animated) return "image";
  if (templateConfig?.encoding?.format === "gif") return "gif";
  const outputs = templateConfig?.outputs;
  if (outputs) {
    const formats = Object.values(outputs)
      .map((o) => o.format)
      .filter(Boolean);
    if (formats.length > 0 && formats.every((f) => f === "gif")) return "gif";
  }
  return "video";
}

export function defaultOutputFormat(kind: MediaKind): OutputFormat {
  switch (kind) {
    case "svg":
      return "svg";
    case "image":
      return "png";
    case "gif":
      return "gif";
    case "video":
      return "mp4";
  }
}

export function formatToExtension(format: OutputFormat | undefined): string {
  switch (format) {
    case "webm":
      return "webm";
    case "gif":
      return "gif";
    case "png":
      return "png";
    case "webp":
      return "webp";
    case "jpeg":
      return "jpg";
    case "svg":
      return "svg";
    case "html":
      return "html";
    default:
      return "mp4";
  }
}