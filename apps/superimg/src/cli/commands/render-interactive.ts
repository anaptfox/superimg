//! Interactive video/preset selection for render command

import * as p from "@clack/prompts";
import { findProjectRoot } from "../utils/find-project-root.js";
import { discoverVideos } from "../utils/discover-videos.js";
import { parseTemplate } from "../utils/template-config.js";
import { loadCascadingConfig } from "../utils/config-loader.js";

export async function selectVideoInteractive(): Promise<{ template: string; preset?: string } | null> {
  const projectRoot = findProjectRoot();
  const videos = discoverVideos(projectRoot);

  if (videos.length === 0) {
    p.log.error("No *.video.ts files found in project.");
    return null;
  }

  p.intro("SuperImg Render");

  // Select video
  const selectedVideo = await p.select({
    message: "Select a video to render",
    options: videos.map(v => ({
      value: v.entrypoint,
      label: v.name,
      hint: v.relativePath
    }))
  });

  if (p.isCancel(selectedVideo)) return null;

  // Load config to check for output presets
  const cascadingConfig = await loadCascadingConfig(selectedVideo as string, projectRoot);
  const templateData = await parseTemplate(selectedVideo as string, { cascadingConfig });
  const outputs = templateData.templateConfig?.outputs;
  const baseWidth = templateData.templateConfig?.width || cascadingConfig?.width || 1920;
  const baseHeight = templateData.templateConfig?.height || cascadingConfig?.height || 1080;

  let selectedPreset: string | undefined;

  if (outputs && Object.keys(outputs).length > 0) {
    const outputKeys = Object.keys(outputs);

    const presetChoice = await p.select({
      message: "Select output size",
      initialValue: "landscape", // Pre-select common default if available
      options: [
        { value: "__default__", label: "Default", hint: `${baseWidth}×${baseHeight}` },
        ...outputKeys.map(k => ({
          value: k,
          label: k.charAt(0).toUpperCase() + k.slice(1),
          hint: `${outputs[k].width || baseWidth}×${outputs[k].height || baseHeight}`
        }))
      ]
    });

    if (p.isCancel(presetChoice)) return null;
    if (presetChoice !== "__default__") {
      selectedPreset = presetChoice as string;
    }
  }

  return { template: selectedVideo as string, preset: selectedPreset };
}
