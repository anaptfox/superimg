//! Dynamic layer mounts — keep compile/export graphs out of the default Player import.

"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { CompileError } from "@superimg/types";
import type { CompileLayerState } from "./PlayerCompileLayer.js";

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
