//! Pure library function for listing discovered videos without side-effects.

import { readFileSync } from "node:fs";
import { findProjectRoot } from "./cli/utils/find-project-root.js";
import { discoverVideos } from "./cli/utils/discover-videos.js";
import { loadCascadingConfig } from "./cli/utils/config-loader.js";
import { resolveRenderConfig, metadataToTemplateConfig } from "./cli/utils/template-config.js";
import { extractTemplateMetadata } from "@superimg/core/template-metadata";

export interface VideoSummary {
  name: string;
  shortName: string;
  relativePath: string;
  entrypoint: string;
  hasLocalConfig: boolean;
  config?: string;
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
        const resolved = resolveRenderConfig({
          templateConfig: metadataToTemplateConfig(metadata.config),
          cascadingConfig,
        });
        config = `${resolved.width}x${resolved.height} ${resolved.fps}fps`;
      } catch {
        config = "⚠ parse failed";
      }
      return {
        name: video.name,
        shortName: video.shortName,
        relativePath: video.relativePath,
        entrypoint: video.entrypoint,
        hasLocalConfig: video.hasLocalConfig,
        config,
      };
    })
  );
}
