//! Export bridge — only loaded when Player `controls="full"` without a custom `onExport`.

"use client";

import { useEffect } from "react";
import type { EncodingOptions, TemplateModule } from "@superimg/types";
import { usePlaygroundExport } from "../hooks/usePlaygroundExport.js";
import type { ExportLayerState } from "./export-layer-state.js";

export interface PlayerExportLayerProps {
  template: TemplateModule | null;
  data: Record<string, unknown>;
  fps?: number;
  encoding?: EncodingOptions;
  onChange: (state: ExportLayerState) => void;
}

export function PlayerExportLayer({
  template,
  data,
  fps,
  encoding,
  onChange,
}: PlayerExportLayerProps) {
  const exportState = usePlaygroundExport({
    template,
    data,
    ...(fps !== undefined ? { fps } : {}),
    ...(encoding !== undefined ? { encoding } : {}),
  });

  useEffect(() => {
    onChange(exportState);
  }, [
    exportState.exporting,
    exportState.exportProgress,
    exportState.exportMp4,
    exportState.download,
    onChange,
  ]);

  return null;
}