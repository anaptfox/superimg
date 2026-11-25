//! Per-frame stdlib binding — video sync and scale helpers (+ optional IR sink).

import type { Stdlib } from "@superimg/types";
import { sync as videoSync, type ClipSyncOptions } from "@superimg/stdlib/video";
import {
  video as mediaVideo,
  youtube as mediaYoutube,
  type MediaVideoOptions,
  type MediaYoutubeOptions,
} from "@superimg/stdlib/media";
import type { StaticStdlib } from "./stdlib.js";
import type { IrInstrumentSink } from "../ir/instrument.js";

export interface TimingWindow {
  fps: number;
  frame: number;
  totalFrames: number;
  progress: number;
  timeSeconds: number;
  durationSeconds: number;
}

export function bindStdTiming(
  base: StaticStdlib,
  window: TimingWindow,
  scale = 1,
  instrument?: IrInstrumentSink,
): Stdlib {
  const sceneId = instrument?.sceneId ?? "default";
  const sceneStartFrame = instrument?.sceneStartFrame ?? 0;
  const totalFrames = instrument?.totalFrames ?? window.totalFrames;
  const frame = instrument?.frame ?? window.frame;
  const strict = instrument?.strictIds === true;

  /** Only require ids when the matching IR hook is active (strict compile attaches all hooks). */
  const requireId = (
    api: string,
    id: string | undefined,
    hookActive: boolean,
  ): string => {
    if (id) return id;
    if (strict && instrument && hookActive) {
      throw new Error(
        `${api}: missing required id (Media IR). Pass id: "my.${api.split(".").pop()}"`,
      );
    }
    if (instrument && hookActive) {
      instrument.onIssue?.({
        code: "anonymous_id",
        message: `${api} has no stable id; temporal semantics are sampled`,
        sceneId,
        frame,
      });
    }
    return "";
  };

  return {
    ...base,
    px: (value: number) => `${value * scale}px`,
    scale,
    stack: (items, opts) => {
      const hook = !!instrument?.onStack;
      const id = requireId("std.stack", opts.id, hook);
      if (id && instrument?.onStack) {
        const itemIds =
          opts.itemIds ??
          (strict
            ? (() => {
                throw new Error(
                  `std.stack: missing required itemIds (Media IR) for stack "${id}"`,
                );
              })()
            : items.map((_, i) => String(i)));
        if (!opts.itemIds) {
          instrument.onIssue?.({
            code: "anonymous_item_ids",
            message: `std.stack "${id}" uses positional item IDs; item identity may shift`,
            sceneId,
            id,
            frame,
          });
        }
        if (opts.itemIds && opts.itemIds.length !== items.length && strict) {
          throw new Error(
            `std.stack: itemIds length (${opts.itemIds.length}) must match items (${items.length})`,
          );
        }
        instrument.onStack({
          localId: id,
          sceneId,
          itemIds: [...itemIds],
          frame,
          sceneStartFrame,
          totalFrames,
        });
      }
      return base.stack(items, opts);
    },
    carousel: (items, opts) => {
      const hook = !!instrument?.onCarousel;
      const id = requireId("std.carousel", opts.id, hook);
      if (id && instrument?.onCarousel) {
        const itemIds =
          opts.itemIds ??
          (strict
            ? (() => {
                throw new Error(
                  `std.carousel: missing required itemIds (Media IR) for carousel "${id}"`,
                );
              })()
            : items.map((_, i) => String(i)));
        if (!opts.itemIds) {
          instrument.onIssue?.({
            code: "anonymous_item_ids",
            message: `std.carousel "${id}" uses positional item IDs; item identity may shift`,
            sceneId,
            id,
            frame,
          });
        }
        if (opts.itemIds && opts.itemIds.length !== items.length && strict) {
          throw new Error(
            `std.carousel: itemIds length (${opts.itemIds.length}) must match items (${items.length})`,
          );
        }
        instrument.onCarousel({
          localId: id,
          sceneId,
          itemIds: [...itemIds],
          frame,
          sceneStartFrame,
          totalFrames,
        });
      }
      return base.carousel(items, opts);
    },
    video: {
      sync: (opts: ClipSyncOptions) => {
        const hook = !!instrument?.onVideoSync;
        const id = requireId("std.video.sync", opts.id, hook);
        const result = videoSync(opts, window.fps);
        if (id && instrument?.onVideoSync) {
          instrument.onVideoSync({
            localId: id,
            sceneId,
            src: opts.src,
            mediaTime: result.time,
            frame,
            sceneStartFrame,
            totalFrames,
          });
        }
        return result;
      },
    },
    media: {
      video: (opts: MediaVideoOptions) => mediaVideo(opts, window.fps),
      youtube: (opts: MediaYoutubeOptions) => mediaYoutube(opts, window.fps),
    },
  };
}
