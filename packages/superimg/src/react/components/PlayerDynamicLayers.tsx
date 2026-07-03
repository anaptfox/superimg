//! Dynamic layer mounts — keep compile/export graphs out of the default Player import.

"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { CompileError, EncodingOptions, TemplateModule } from "@superimg/types";
import type { CompileLayerState } from "./PlayerCompileLayer.js";
import type { ExportLayerState } from "./export-layer-state.js";

export function DynamicCompileLayer(
  props: {
    code?: string;
    bundled?: string;
    wasmCompile?: boolean;
    debounceMs?: number;
    onChange: (state: CompileLayerState) => void;
    onCompiling?: (compiling: boolean) => void;
    onCompileError?: (error: CompileError) => void;
  },
) {
  const [Layer, setLayer] = useState<ComponentType<typeof props> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("./PlayerCompileLayer.js").then((mod) => {
      if (!cancelled) setLayer(() => mod.PlayerCompileLayer);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Layer) return null;
  return <Layer {...props} />;
}

export function DynamicExportLayer(
  props: {
    template: TemplateModule | null;
    data: Record<string, unknown>;
    fps?: number;
    encoding?: EncodingOptions;
    onChange: (state: ExportLayerState) => void;
  },
) {
  const [Layer, setLayer] = useState<ComponentType<typeof props> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("./PlayerExportLayer.js").then((mod) => {
      if (!cancelled) setLayer(() => mod.PlayerExportLayer);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Layer) return null;
  return <Layer {...props} />;
}