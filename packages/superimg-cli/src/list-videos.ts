//! Pure library function for listing discovered videos without side-effects.

import { readFileSync } from "node:fs";
import type { Medium } from "@superimg/types";
import { findProjectRoot } from "./cli/utils/find-project-root.js";
import { discoverVideos } from "./cli/utils/discover-videos.js";
import { loadCascadingConfig } from "./cli/utils/config-loader.js";
import { resolveRenderConfig, metadataToTemplateConfig } from "./cli/utils/template-config.js";
import { extractTemplateMetadata } from "@superimg/core/template-metadata";
import { inferMediaKind, type MediaKind } from "./integration/kind.js";

export interface VideoSummary {
  name: string;
  shortName: string;
  relativePath: string;
  entrypoint: string;
  hasLocalConfig: boolean;
  /** Rasterizer family — read from the parsed config (default "html"). */
  medium: Medium;
  /** True when the config declares fps + duration. */
  animated: boolean;
  /** Host-facing output kind. */
  kind: MediaKind;
  width: number;
  height: number;
  fps: number;
  duration: number;
  config?: string;
  isOg?: boolean;
  variants?: { suffix: string; width: number; height?: number }[];
}

export async function listVideos(projectRoot?: string): Promise<VideoSummary[]> {
  const root = projectRoot ?? findProjectRoot();
  const videos = discoverVideos(root);

  return Promise.all(
    videos.map(async (video) => {
      let config: string | undefined;
      try {
        const cascadingConfig = await loadCascadingConfig(video.entrypoint, root);
        const templateCode = readFileSync(video.entrypoint, "utf-8");
        const metadata = await extractTemplateMetadata(templateCode);
        const medium: Medium = metadata.medium ?? "html";
        const animated =
          typeof metadata.config?.fps === "number" && metadata.config?.duration != null;
        const stillDefaults = !animated
          ? { width: 1920, height: 1080, fps: 1, duration: 1 }
          : undefined;
        const templateConfig = metadataToTemplateConfig(metadata.config);
        const resolved = resolveRenderConfig({
          ...(templateConfig !== undefined ? { templateConfig } : {}),
          cascadingConfig,
          ...(stillDefaults !== undefined ? { defaults: stillDefaults } : {}),
        });
        const kind = inferMediaKind(medium, animated, templateConfig);
        const configStr = !animated
          ? `${resolved.width}x${resolved.height}`
          : `${resolved.width}x${resolved.height} ${resolved.fps}fps`;
        config = configStr;

        const isOg = metadata.config?.type === "og" || video.shortName.startsWith("og-") || video.shortName === "og";
        let variants: { suffix: string; width: number; height?: number }[] | undefined;

        if (metadata.config?.responsive && !animated && medium === "html") {
          variants = [
            { suffix: "@1x", width: resolved.width, height: resolved.height },
            { suffix: "@2x", width: resolved.width * 2, height: resolved.height * 2 },
          ];
        } else if (metadata.config?.outputs) {
          variants = Object.entries(metadata.config.outputs).map(([suffix, preset]) => ({
            suffix,
            width: preset.width ?? resolved.width,
            height: preset.height ?? resolved.height,
          }));
        }

        return {
          name: video.name,
          shortName: video.shortName,
          relativePath: video.relativePath,
          entrypoint: video.entrypoint,
          hasLocalConfig: video.hasLocalConfig,
          medium,
          animated,
          kind,
          width: resolved.width,
          height: resolved.height,
          fps: resolved.fps,
          duration: resolved.duration,
          ...(config !== undefined ? { config } : {}),
          ...(isOg ? { isOg } : {}),
          ...(variants !== undefined ? { variants } : {}),
        };
      } catch {
        config = "⚠ parse failed";
        return {
          name: video.name,
          shortName: video.shortName,
          relativePath: video.relativePath,
          entrypoint: video.entrypoint,
          hasLocalConfig: video.hasLocalConfig,
          medium: "html",
          animated: false,
          kind: "image",
          width: 1920,
          height: 1080,
          fps: 1,
          duration: 1,
          config,
        };
      }
    })
  );
}
