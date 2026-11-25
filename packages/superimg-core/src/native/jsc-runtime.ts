import { compileTemplate } from "../rendering/compiler.js";
import {
  createRenderContext,
  createImageRenderContext,
  createSvgRenderContext,
} from "../rendering/create-render-context.js";
import { createStaticStdlib, type StaticStdlib } from "../shared/stdlib.js";
import { lowerDisplayList } from "@superimg/stdlib/tree";
import { parseFontMetrics, createTextMeasurer, type MetricFontFace } from "@superimg/stdlib/svg";
import * as math from "@superimg/stdlib/math";
import * as color from "@superimg/stdlib/color";
import * as text from "@superimg/stdlib/text";
import * as responsive from "@superimg/stdlib/responsive";
import * as code from "@superimg/stdlib/code";
import { carousel } from "@superimg/stdlib/carousel";
import { stack } from "@superimg/stdlib/stack";
import { layoutTimeline } from "@superimg/stdlib/layout-timeline";
import { oscillate, loop, pingpong, wiggle } from "@superimg/stdlib/oscillate";
import { spring } from "@superimg/stdlib/spring";
import { stagger } from "@superimg/stdlib/stagger";
import { interpolateColor } from "@superimg/stdlib/interpolate";
import { timing } from "@superimg/stdlib/timing";
import { phases } from "@superimg/stdlib/phase-recipes";
import { motion } from "@superimg/stdlib/motion-presets";
import { getSafeArea, getSafeBox } from "@superimg/stdlib/safe-area";
import { path, createMotionPath } from "@superimg/stdlib/path";
import * as svgBase from "@superimg/stdlib/svg/base";
import * as layout from "@superimg/stdlib/layout";

function createPreparedNativeStdlib(): StaticStdlib {
  const std = createStaticStdlib();
  Object.assign(std, {
    math,
    color,
    text,
    responsive,
    code,
    carousel,
    stack,
    layoutTimeline,
    oscillate,
    loop,
    pingpong,
    wiggle,
    spring,
    stagger,
    interpolateColor,
    timing,
    phases,
    motion,
    getSafeArea,
    getSafeBox,
    path,
    createMotionPath,
    layout,
  });
  Object.assign(std.svg, svgBase);
  return std;
}

export function decodeBase64(input: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = input.replace(/\s/g, "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(clean)) {
    throw new TypeError("Invalid base64");
  }
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (alphabet.indexOf(clean[i]!) << 18) |
      (alphabet.indexOf(clean[i + 1]!) << 12) |
      ((clean[i + 2] === "=" ? 0 : alphabet.indexOf(clean[i + 2]!)) << 6) |
      (clean[i + 3] === "=" ? 0 : alphabet.indexOf(clean[i + 3]!));
    bytes.push((n >>> 16) & 255);
    if (clean[i + 2] !== "=") bytes.push((n >>> 8) & 255);
    if (clean[i + 3] !== "=") bytes.push(n & 255);
  }
  return new Uint8Array(bytes);
}

export interface NativeArtifactFont {
  family: string;
  weight?: number;
  style?: "normal" | "italic";
  base64: string;
}

export interface NativeArtifactPayload {
  programCode: string;
  media: Record<string, unknown>;
  job: Record<string, unknown>;
  fonts?: NativeArtifactFont[];
}

export interface NativeSampleRequest {
  seconds?: number;
  frame?: number;
  width?: number;
  height?: number;
  scale?: number;
  safeArea?: { top: number; left: number; bottom: number; right: number };
  reduceMotion?: boolean;
  data?: Record<string, unknown>;
  edition?: string;
  strict?: boolean;
}

export function createNativeRuntime() {
  const baseStdlib = createPreparedNativeStdlib();
  const sessions = new Map<
    string,
    {
      template: NonNullable<ReturnType<typeof compileTemplate>["media"]>;
      job: Record<string, unknown>;
      measurer: ReturnType<typeof createTextMeasurer>;
    }
  >();
  let nextId = 0;

  return {
    loadArtifact(payload: NativeArtifactPayload) {
      const compiled = compileTemplate(payload.programCode);
      if (!compiled.media) throw compiled.error ?? new Error("Expected a media artifact");
      const template = compiled.media;
      const faces: MetricFontFace[] = [];
      for (const font of payload.fonts ?? []) {
        try {
          faces.push({
            family: font.family,
            weight: font.weight ?? 400,
            style: font.style ?? "normal",
            metrics: parseFontMetrics(decodeBase64(font.base64)),
          });
        } catch {
          /* unsupported font container (e.g. woff2 without brotli): fall back to heuristic */
        }
      }
      const id = String(++nextId);
      sessions.set(id, { template, job: payload.job, measurer: createTextMeasurer(faces) });
      const { width, height, fps, durationSeconds, totalFrames, animated } = payload.job;
      return {
        id,
        width: Number(width),
        height: Number(height),
        fps: Number(fps),
        durationSeconds: Number(durationSeconds),
        totalFrames: Number(totalFrames),
        animated: Boolean(animated),
        editions: Object.keys(template.editions ?? {}),
        defaultData: {
          ...template.sample,
          ...((payload.job.data as Record<string, unknown>) ?? {}),
        },
      };
    },
    sampleArtifact(id: string, request: NativeSampleRequest = {}) {
      const session = sessions.get(id);
      if (!session) throw new Error(`Unknown artifact: ${id}`);
      const { template, job, measurer } = session;
      const edition = request.edition ? template.editions?.[request.edition] : undefined;
      const width = request.width ?? edition?.size.width ?? Number(job.width);
      const height = request.height ?? edition?.size.height ?? Number(job.height);
      const fps = Number(job.fps);
      const totalFrames = Number(job.totalFrames);
      const duration = Number(job.durationSeconds);
      const frame = Math.max(
        0,
        Math.min(
          totalFrames - 1,
          Math.round(request.frame ?? Math.max(0, Math.min(duration, request.seconds ?? 0)) * fps),
        ),
      );
      const data = {
        ...template.sample,
        ...((job.data as Record<string, unknown>) ?? {}),
        ...request.data,
      };
      const assetResolver = (key: string) => key;
      const ctx = job.animated
        ? createRenderContext(
            frame,
            fps,
            totalFrames,
            width,
            height,
            data,
            {},
            assetResolver,
            undefined,
            undefined,
            undefined,
            baseStdlib,
          )
        : job.medium === "svg"
          ? createSvgRenderContext(width, height, { data, assetResolver }, baseStdlib)
          : createImageRenderContext(width, height, { data, assetResolver }, baseStdlib);
      Object.assign(ctx, {
        scale: request.scale ?? 1,
        safeArea: request.safeArea ?? { top: 0, left: 0, bottom: 0, right: 0 },
        reduceMotion: request.reduceMotion ?? false,
      });
      const render = edition?.render ?? template.render;
      const tree = render(ctx as never);
      return lowerDisplayList(tree, {
        width,
        height,
        measurer,
        ...(typeof job.background === "string" ? { background: job.background } : {}),
        ...(request.strict !== undefined ? { strict: request.strict } : {}),
      });
    },
    disposeArtifact(id: string) {
      sessions.delete(id);
    },
  };
}

export function installNativeRuntime(target: object = globalThis) {
  const runtime = createNativeRuntime();
  Object.assign(target, { __superimgNative: runtime });
  return runtime;
}
