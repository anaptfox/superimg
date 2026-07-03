//! Compile bridge — only loaded when Player receives `code` or `bundled`.

"use client";

import { useEffect } from "react";
import type { CompileError, TemplateModule } from "@superimg/types";
import { useCompiledTemplate } from "../hooks/useCompiledTemplate.js";

export interface CompileLayerState {
  template: TemplateModule | null;
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
  const { template, compiling, error } = useCompiledTemplate({
    code: code ?? "",
    ...(bundled !== undefined ? { bundled } : {}),
    wasmCompile,
    debounceMs,
    enabled: !!code || (!!bundled && !wasmCompile),
  });

  useEffect(() => {
    onChange({ template, compiling, error });
  }, [template, compiling, error, onChange]);

  useEffect(() => {
    onCompiling?.(compiling);
  }, [compiling, onCompiling]);

  useEffect(() => {
    if (error) onCompileError?.(error);
  }, [error, onCompileError]);

  return null;
}