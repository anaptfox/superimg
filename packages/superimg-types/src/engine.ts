//! Engine contract interfaces for pluggable rendering backends

import type {
  TemplateModule,
  AudioValue,
  EncodingOptions,
  BackgroundValue,
} from "./types.js";

export interface RenderJob {
  templateCode: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  fonts?: string[];
  audio?: AudioValue;
  outputName?: string;
  encoding?: EncodingOptions;
  data?: Record<string, unknown>;
  background?: BackgroundValue;
}

export interface RenderProgress {
  frame: number;
  totalFrames: number;
  fps: number;
}

export interface FrameRendererConfig {
  width: number;
  height: number;
  fonts?: string[];
}

export interface FrameRenderer<TFrame = unknown> {
  init(config: FrameRendererConfig): Promise<void>;
  captureFrame(html: string, options?: { alpha?: boolean }): Promise<TFrame>;
  dispose(): Promise<void>;
}

export interface VideoEncoderConfig {
  width: number;
  height: number;
  fps: number;
  encoding?: EncodingOptions;
  audio?: AudioValue;
}

export interface VideoEncoder<TFrame = unknown> {
  init(config: VideoEncoderConfig): Promise<void>;
  addFrame(frame: TFrame, timestamp: number): Promise<void>;
  finalize(): Promise<Uint8Array>;
  dispose(): Promise<void>;
}

export interface RenderEngine<TFrame = unknown> {
  init(): Promise<void>;
  createAdapters(): { renderer: FrameRenderer<TFrame>; encoder: VideoEncoder<TFrame> };
  dispose(): Promise<void>;
}

export interface RenderPlan {
  template: TemplateModule;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  fonts: string[];
  audio?: AudioValue;
  outputName: string;
  encoding?: EncodingOptions;
  data?: Record<string, unknown>;
  background?: BackgroundValue;
}
