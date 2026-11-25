//! Host-side asset inspection for Media IR and portable artifacts.

import { readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashBytes } from "@superimg/core";
import type {
  MediaIRAsset,
  MediaIRCapabilityIssue,
  TemplateModule,
  AudioValue,
} from "@superimg/types";
import { discoverTemplateAssets } from "./asset-discovery.js";

export interface InspectedLocalAsset {
  path: string;
  /** Runtime spellings that should resolve to the vendored file. */
  aliases: string[];
}

export interface InspectedIRAssets {
  additionalAssets: MediaIRAsset[];
  additionalIssues: MediaIRCapabilityIssue[];
  localAssets: Record<string, InspectedLocalAsset>;
  /** Existing or missing local dependency paths suitable for file watching. */
  watchPaths: string[];
}

const remote = (src: string) => /^(?:https?:)?\/\//i.test(src);
const dataUrl = (src: string) => src.startsWith("data:");

function canonicalSource(src: string, templateDir: string): string {
  if (!isAbsolute(src)) return src.replace(/\\/g, "/");
  const relative = src.startsWith(`${templateDir}/`)
    ? src.slice(templateDir.length + 1)
    : `external/${basename(src)}`;
  return relative.replace(/\\/g, "/");
}

function flattenAudio(
  value: AudioValue | undefined,
): Array<{ id?: string; role?: string; src: string }> {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && "clips" in value) return value.clips;
  return [value];
}

function kindFor(src: string): MediaIRAsset["kind"] {
  if (/\.(?:mp4|webm|mov|avi|mkv|flv|wmv)$/i.test(src)) return "video";
  if (/\.(?:mp3|wav|ogg|aac|m4a|flac|opus)$/i.test(src)) return "audio";
  if (/\.(?:png|jpe?g|gif|webp|svg|avif)$/i.test(src)) return "image";
  if (/\.(?:woff2?|ttf|otf)$/i.test(src)) return "font";
  return "other";
}

function kindForMimeType(mimeType: string): MediaIRAsset["kind"] {
  const family = mimeType.trim().toLowerCase().split("/", 1)[0];
  if (family === "image" || family === "video" || family === "audio") return family;
  return "other";
}

export function inspectIRAssets(
  templatePath: string,
  template: TemplateModule,
): InspectedIRAssets {
  const templateDir = dirname(templatePath);
  const assets = new Map<string, MediaIRAsset>();
  const localAssets: Record<string, InspectedLocalAsset> = {};
  const issues: MediaIRCapabilityIssue[] = [];
  const watchPaths = new Set<string>();

  const add = (
    id: string,
    kind: MediaIRAsset["kind"],
    src: string,
    sourceDir = templateDir,
    aliases: string[] = [],
  ) => {
    if (remote(src)) {
      assets.set(id, { id, kind, src, remote: true });
      return;
    }
    if (dataUrl(src)) {
      assets.set(id, {
        id,
        kind,
        src,
        remote: false,
        contentHash: hashBytes(src),
      });
      return;
    }

    let abs: string;
    try {
      abs = src.startsWith("file:") ? fileURLToPath(src) : isAbsolute(src) ? src : resolve(sourceDir, src);
    } catch {
      assets.set(id, { id, kind, src, remote: false });
      issues.push({ code: "missing_asset", message: `Local asset "${src}" could not be read`, id });
      return;
    }
    watchPaths.add(abs);
    const canonical = canonicalSource(src.startsWith("file:") ? abs : src, templateDir);
    let bytes: Buffer;
    try {
      if (!statSync(abs).isFile()) throw new Error("not a file");
      bytes = readFileSync(abs);
    } catch {
      assets.set(id, { id, kind, src: canonical, remote: false });
      issues.push({
        code: "missing_asset",
        message: `Local asset "${src}" could not be read`,
        id,
      });
      return;
    }
    const contentHash = hashBytes(bytes);
    assets.set(id, {
      id,
      kind,
      src: canonical,
      remote: false,
      contentHash,
    });
    localAssets[id] = {
      path: abs,
      aliases: [...new Set([src, canonical, basename(src), ...aliases])],
    };
  };

  const configAssets = template.config?.assets ?? {};
  for (const [key, declaration] of Object.entries(configAssets)) {
    if ("url" in declaration) {
      const src = String(declaration.url);
      add(`asset:${key}`, declaration.type ?? kindFor(src), src, templateDir, [key]);
    } else {
      const contentHash = hashBytes(declaration.bytes);
      assets.set(`asset:${key}`, {
        id: `asset:${key}`,
        kind: declaration.type ?? kindForMimeType(declaration.mimeType),
        src: `bytes:${contentHash}`,
        remote: false,
        contentHash,
      });
    }
  }

  for (const declaration of discoverTemplateAssets(templateDir)) {
    const id = `discovered:${declaration.key}`;
    if (assets.has(`asset:${declaration.key}`)) continue;
    add(
      id,
      declaration.type,
      declaration.src,
      declaration.sourceDir,
      [declaration.key, basename(declaration.src)],
    );
  }

  const background = template.config?.background;
  if (background) {
    const src = typeof background === "string" ? background : background.src;
    if (!/^(?:#|rgba?\(|hsla?\()/i.test(src)) {
      add("background", "image", src);
    }
  }

  const watermark = template.config?.watermark;
  if (typeof watermark === "string") {
    add("watermark", "image", watermark);
  } else if (watermark?.type === "image") {
    add("watermark", "image", watermark.content);
  }

  for (const [index, clip] of flattenAudio(template.config?.audio).entries()) {
    add(
      `audio:${clip.id ?? clip.role ?? "clip"}-${clip.id ? "" : index}`.replace(
        /-$/,
        "",
      ),
      "audio",
      clip.src,
    );
  }

  for (const [index, stylesheet] of (
    template.config?.stylesheets ?? []
  ).entries()) {
    add(`stylesheet:${index}`, "other", stylesheet);
  }

  const cssUrl = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  for (const [cssIndex, css] of (template.config?.inlineCss ?? []).entries()) {
    let match: RegExpExecArray | null;
    let urlIndex = 0;
    while ((match = cssUrl.exec(css))) {
      const src = match[2]!;
      if (src.startsWith("#")) continue;
      add(`inline-css:${cssIndex}:${urlIndex++}`, "other", src);
    }
  }

  return {
    additionalAssets: [...assets.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    additionalIssues: issues,
    localAssets,
    watchPaths: [...watchPaths].sort(),
  };
}
