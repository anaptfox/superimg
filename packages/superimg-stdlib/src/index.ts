/**
 * SuperImg Standard Library
 *
 * Re-exports all modules for convenience.
 * Individual modules can also be imported directly:
 *
 * @example
 * import { easeOutCubic } from 'superimg/stdlib/easing';
 * import { lerp } from 'superimg/stdlib/math';
 */

export * from "./easing";
export * from "./math";
export * from "./color";
export * from "./date";
export * from "./text";
export * from "./css";
export * from "./responsive";
export * from "./subtitle";
export * from "./presets";
export * from "./code";
export * as cue from "./cue/index.js";
export { score, createScore, mergeMotion, type PhaseConfig, type MotionEasing, type MotionOpts,
  type MotionResult, type MotionValue, type TweenOpts, type ValueOpts, type ValueResult,
  type Score, type ScoreOf, type ScoreContext, type ClipOpts, type ScoreClip } from "./score";
export * from "./backgrounds";
export * from "./montage";
export * from "./spring";
export { stagger, staggerLead, type StaggerItem, type StaggerLeadOptions } from "./stagger";
export * from "./interpolate";
export * from "./path";
export * from "./svg";
export * as layout from "./layout";
export * from "./layers";
export * from "./safe-area";
export { sync as videoSync, quantizeVideoTime, VIDEO_SYNC_ATTR, type VideoSyncOptions, type VideoSyncResult } from "./video";
export { revealFx as reveal } from "./reveal";
export { oscillate, loop, pingpong, wiggle,
  type OscillateOpts, type LoopOpts, type WiggleOpts } from "./oscillate";
