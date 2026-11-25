//! Authoring-capable React Player.
//!
//! The passive `@foxworth/superimg/react/player` entry exports `PassivePlayer` directly,
//! so source compilation and OXC never enter an application playback bundle.
"use client";

import { useState } from "react";
import type { CompileError } from "@superimg/types";
import type { PlayerInput } from "@superimg/player";
import {
  PassivePlayer,
  type PassivePlayerProps,
  type PlayerRef,
} from "./PassivePlayer.js";
import { DynamicCompileLayer } from "./PlayerDynamicLayers.js";
import type { CompileLayerState } from "./PlayerCompileLayer.js";

export interface PlayerProps extends Omit<PassivePlayerProps, "media" | "compilePending"> {
  media?: PlayerInput;
  code?: string;
  bundled?: string;
  wasmCompile?: boolean;
  compileDebounceMs?: number;
  onCompiling?: (compiling: boolean) => void;
  onCompileError?: (error: CompileError) => void;
}

export function Player({
  media: mediaProp,
  code,
  bundled,
  wasmCompile = true,
  compileDebounceMs = 300,
  onCompiling,
  onCompileError,
  ...playerProps
}: PlayerProps) {
  const [compileState, setCompileState] = useState<CompileLayerState>({
    media: null,
    compiling: false,
    error: null,
  });
  const needsCompile = !!(code || bundled);
  const media = mediaProp ?? compileState.media ?? undefined;

  return (
    <>
      {needsCompile && (
        <DynamicCompileLayer
          {...(code !== undefined ? { code } : {})}
          {...(bundled !== undefined ? { bundled } : {})}
          wasmCompile={wasmCompile}
          debounceMs={compileDebounceMs}
          onChange={setCompileState}
          {...(onCompiling !== undefined ? { onCompiling } : {})}
          {...(onCompileError !== undefined ? { onCompileError } : {})}
        />
      )}
      <PassivePlayer
        {...playerProps}
        {...(media !== undefined ? { media } : {})}
        compilePending={compileState.compiling}
      />
    </>
  );
}

export type { PlayerRef } from "./PassivePlayer.js";
