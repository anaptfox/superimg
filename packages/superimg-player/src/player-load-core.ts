//! Deferred Player load preparation.
//!
//! createDomPlayer is useful as an island shell before any media is loaded.
//! Keep resolver and session construction out of that initial browser graph.

import {
  applyTemplateResolve,
  sessionOptionsFromResolve,
  normalizeCues,
  type NormalizedCue,
} from "@superimg/core/player-core";
import { createMediaSession, type MediaSession, type MediaSessionOptions } from "@superimg/media";
import type {
  CanvasSize,
  CompositionEntryData,
  Marker,
  MediaDefinition,
  PlaybackMode,
  Program,
  ResolveBreakdown,
  ResolveCue,
  ResolveCueFinding,
  RetainedComposition,
} from "@superimg/types";
import type { LoadOptions, PlayerInput } from "./player-types.js";

export interface PreparedSessionLoad {
  sessionInput: PlayerInput;
  sessionData: Record<string, unknown> | undefined;
  sessionDuration: number | undefined;
  sessionFps: number | undefined;
  sessionWidth: number | undefined;
  sessionHeight: number | undefined;
  markers: Marker[];
  cues: readonly ResolveCue[];
  resolveCues: (fps: number, duration: number) => readonly NormalizedCue[];
  cueFindings?: readonly ResolveCueFinding[];
  breakdown?: ResolveBreakdown;
  dimensions: { width?: number; height?: number };
  captureSemantic?: MediaSessionOptions["captureSemantic"];
}

function hasChildResolve(program: Program): boolean {
  if (program.op === "sequence" || program.op === "together") {
    return program.parts.some((use) =>
      "op" in use.content
        ? hasChildResolve(use.content)
        : "kind" in use.content && use.content.kind === "interactive"
          ? false
          : typeof use.content.resolve === "function",
    );
  }
  return Object.values(program.paths).some((content) =>
    "op" in content
      ? hasChildResolve(content)
      : "kind" in content && content.kind === "interactive"
        ? false
        : typeof content.resolve === "function",
  );
}

/** Apply resolve() + preview-size overrides to one canonical media definition. */
export async function prepareSessionLoad(
  input: PlayerInput,
  options: LoadOptions,
  size: CanvasSize | undefined,
): Promise<PreparedSessionLoad> {
  const dimensions = size ?? {};
  let sessionInput: PlayerInput = input;
  let sessionData = options.data;
  let sessionDuration: number | undefined;
  let sessionFps: number | undefined;
  let sessionWidth: number | undefined;
  let sessionHeight: number | undefined;
  let markers = options.markers ?? [];

  const retained = (input as MediaDefinition & { composition?: RetainedComposition }).composition;
  if (retained && (options.data !== undefined || hasChildResolve(retained.program))) {
    const compositionSize = size ?? retained.outputSize;
    const { prepareComposition, time, interactiveCompositionRuntimes } = await import("@superimg/core/player-composition");
    const interactiveRuntimes = Object.fromEntries(interactiveCompositionRuntimes(input).map(({ path, runtime }) => [path, runtime]));
    const preparedComposition = await prepareComposition(retained.program, {
      size: compositionSize,
      fps: retained.schedule.fps,
      ...(retained.schedule.selectedRoutes !== undefined
        ? { routes: retained.schedule.selectedRoutes }
        : {}),
      ...(options.data !== undefined
        ? { data: options.data as CompositionEntryData }
        : {}),
      ...(Object.keys(interactiveRuntimes).length ? { interactiveRuntimes } : {}),
    });
    const projected = time(preparedComposition.program, {
      size: compositionSize,
      fps: preparedComposition.plan.fps,
      routes: preparedComposition.plan.selectedRoutes,
      ...((input.render as unknown as Record<symbol, unknown>)[Symbol.for("superimg.composition-inspection")] === true
        ? { inspection: true } : {}),
    });
    const entries = interactiveCompositionRuntimes(projected);
    const captureSemantic = entries.length
      ? () => Object.fromEntries(entries.map(({ path, runtime }) => [path, runtime.getSnapshot()]))
      : undefined;
    const resolvedProjection = await applyTemplateResolve(projected as MediaDefinition, {});
    const session = sessionOptionsFromResolve(resolvedProjection, {
      formatDims: dimensions,
      ...(options.markers !== undefined ? { extraMarkers: options.markers } : {}),
    });
    return {
      sessionInput: session.template as PlayerInput,
      sessionData: undefined,
      sessionDuration: session.durationSeconds,
      sessionFps: session.fps,
      sessionWidth: session.width,
      sessionHeight: session.height,
      markers: session.markers,
      cues: resolvedProjection.resolved?.cues ?? [],
      resolveCues: (fps, duration) => normalizeCues(resolvedProjection.resolved?.cues ?? [], fps, duration),
      ...(resolvedProjection.resolved?.cueFindings !== undefined ? { cueFindings: resolvedProjection.resolved.cueFindings } : {}),
      ...(resolvedProjection.resolved?.breakdown !== undefined ? { breakdown: resolvedProjection.resolved.breakdown } : {}),
      dimensions,
      ...(captureSemantic ? { captureSemantic } : {}),
    };
  }

  const applied = await applyTemplateResolve(input as MediaDefinition, {
    ...(options.data !== undefined ? { data: options.data } : {}),
    ...(options.overrides !== undefined ? { overrides: options.overrides } : {}),
    ...(options.assets !== undefined ? { assets: options.assets } : {}),
    ...(options.assetResolver !== undefined ? { assetResolver: options.assetResolver } : {}),
  });
  const session = sessionOptionsFromResolve(applied, {
    formatDims: dimensions,
    ...(options.markers !== undefined ? { extraMarkers: options.markers } : {}),
  });
  sessionInput = session.template as PlayerInput;
  sessionData = session.data;
  sessionDuration = session.durationSeconds;
  sessionFps = session.fps;
  sessionWidth = session.width;
  sessionHeight = session.height;
  markers = session.markers;
  let captureSemantic: MediaSessionOptions["captureSemantic"];
  if (retained) {
    const { interactiveCompositionRuntimes } = await import("@superimg/core/player-composition");
    const entries = interactiveCompositionRuntimes(input);
    if (entries.length) captureSemantic = () => Object.fromEntries(entries.map(({ path, runtime }) => [path, runtime.getSnapshot()]));
  }

  return {
    sessionInput,
    sessionData,
    sessionDuration,
    sessionFps,
    sessionWidth,
    sessionHeight,
    markers,
    cues: applied.resolved?.cues ?? [],
    resolveCues: (fps, duration) => normalizeCues(applied.resolved?.cues ?? [], fps, duration),
    ...(applied.resolved?.cueFindings !== undefined ? { cueFindings: applied.resolved.cueFindings } : {}),
    ...(applied.resolved?.breakdown !== undefined ? { breakdown: applied.resolved.breakdown } : {}),
    dimensions,
    ...(captureSemantic ? { captureSemantic } : {}),
  };
}

/** Create MediaSession from prepared resolve result + load options. */
export async function openPlayerSession(
  prepared: PreparedSessionLoad,
  options: LoadOptions,
  playerMode: "render-only" | "dev",
  playbackMode: PlaybackMode,
): Promise<MediaSession> {
  const candidate = await createMediaSession(prepared.sessionInput, {
    ...prepared.dimensions,
    ...(prepared.dimensions.width !== undefined && prepared.dimensions.height !== undefined
      ? { size: { width: prepared.dimensions.width, height: prepared.dimensions.height } }
      : {}),
    ...(prepared.sessionWidth !== undefined ? { width: prepared.sessionWidth } : {}),
    ...(prepared.sessionHeight !== undefined ? { height: prepared.sessionHeight } : {}),
    ...(prepared.sessionFps !== undefined ? { fps: prepared.sessionFps } : {}),
    ...(prepared.sessionDuration !== undefined ? { duration: prepared.sessionDuration } : {}),
    ...(prepared.sessionData !== undefined ? { data: prepared.sessionData } : {}),
    ...(options.assets !== undefined ? { assets: options.assets } : {}),
    ...(options.assetResolver !== undefined ? { assetResolver: options.assetResolver } : {}),
    ...(options.fonts !== undefined ? { fonts: options.fonts } : {}),
    ...(prepared.captureSemantic !== undefined ? { captureSemantic: prepared.captureSemantic } : {}),
    ...(options.performance !== undefined ? { performance: options.performance } : {}),
    playerMode,
    playbackMode,
    playback: "native",
    validateClock: ({ fps, duration }) => { normalizeCues(prepared.cues, fps, duration); },
  });
  try {
    const state = candidate.getState();
    normalizeCues(prepared.cues, state.fps, state.duration);
    return candidate;
  } catch (error) { candidate.dispose(); throw error; }
}
