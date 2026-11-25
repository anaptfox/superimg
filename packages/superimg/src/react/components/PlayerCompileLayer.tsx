//! Compile bridge — only loaded when Player receives `code` or `bundled`.

"use client";

import { useEffect } from "react";
import type { CompileError, MediaDefinition } from "@superimg/types";
import { useCompiledMedia } from "../hooks/useCompiledMedia.js";

export interface CompileLayerState {
  media: MediaDefinition | null;
  compiling: boolean;
  error: CompileError | null;
}

export interface PlayerCompileLayerProps {
  code?: string;
  bundled?: string;
  wasmCompile?: boolean;
  debounceMs?: number;
  onChange: (state: CompileLayerState) => void;
  onCompiling?: (compiling: boolean) => void;
  onCompileError?: (error: CompileError) => void;
}

export function PlayerCompileLayer({
  code,
  bundled,
  wasmCompile = true,
  debounceMs = 300,
  onChange,
  onCompiling,
  onCompileError,
}: PlayerCompileLayerProps) {
  const { media, compiling, error } = useCompiledMedia({
    code: code ?? "",
    ...(bundled !== undefined ? { bundled } : {}),
    wasmCompile,
    debounceMs,
    enabled: !!code || (!!bundled && !wasmCompile),
  });

  useEffect(() => {
    onChange({ media, compiling, error });
  }, [media, compiling, error, onChange]);

  useEffect(() => {
    onCompiling?.(compiling);
  }, [compiling, onCompiling]);

  useEffect(() => {
    if (error) onCompileError?.(error);
  }, [error, onCompileError]);

  return null;
}
