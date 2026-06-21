//! Pure library function for listing discovered videos without side-effects.

import { readFileSync } from "node:fs";
import { findProjectRoot } from "./cli/utils/find-project-root.js";
import { discoverVideos, type TemplateKind } from "./cli/utils/discover-videos.js";
import { loadCascadingConfig } from "./cli/utils/config-loader.js";
import { resolveRenderConfig, metadataToTemplateConfig } from "./cli/utils/template-config.js";
import { extractTemplateMetadata } from "@superimg/core/template-metadata";

export interface VideoSummary {
  name: string;
  shortName: string;
  relativePath: string;
  entrypoint: string;
  hasLocalConfig: boolean;
  kind: TemplateKind;
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
        const imageDefaults = video.kind === "image"
          ? { width: 1920, height: 1080, fps: 1, duration: 1 }
          : undefined;
        const resolved = resolveRenderConfig({
          templateConfig: metadataToTemplateConfig(metadata.config),
          cascadingConfig,
          defaults: imageDefaults,
        });
        const configStr = video.kind === "image"
          ? `${resolved.width}x${resolved.height}`
          : `${resolved.width}x${resolved.height} ${resolved.fps}fps`;
        config = configStr;

        const isOg = metadata.config?.type === "og" || video.shortName.startsWith("og-") || video.shortName === "og";
        let variants: { suffix: string; width: number; height?: number }[] | undefined;

        if (metadata.config?.responsive && video.kind === "image") {
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
          kind: video.kind,
          config,
          isOg,
          variants,
        };
      } catch {
        config = "⚠ parse failed";
        return {
          name: video.name,
          shortName: video.shortName,
          relativePath: video.relativePath,
          entrypoint: video.entrypoint,
          hasLocalConfig: video.hasLocalConfig,
          kind: video.kind,
          config,
        };
      }
    })
  );
}
