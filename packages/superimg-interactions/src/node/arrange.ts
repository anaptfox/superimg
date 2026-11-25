//! Handler for `media.arrange.still`: a portable arrangement request in,
//! one still rendition's bytes out. Empty footprint — `reads: []`,
//! `changes: []` in the interaction spec — because rendering writes nothing
//! durable; the caller decides whether to attach or publish the bytes.
//!
//! Refusal is a completed reject of caller input, not a new error family:
//! both a malformed request (`parseArrangeRequest`) and an admitted-but-
//! unearned arrangement (`checkArrangeRequest` failures) surface as the one
//! declared `INVALID_INPUT` Media already has. The declared-error details
//! schema (`declaredErrorDetailsSchema`) only carries `path` and `message`,
//! so `ArrangeFailure[]` evidence is serialized into `message`, one failure
//! per line, the same way `ArrangeError` already joins them for the native
//! caller.

import {
  ArrangeRequestError,
} from "@superimg/core/arrange";
import type { ExportRenditionRequest, Runtime } from "@superimg/types";
import { bytesToBase64 } from "../rasters.js";
import {
  MediaInteractionError,
  type MediaArrangeStillInteractionInput,
  type MediaArrangeStillOutput,
  type MediaInteractionHandlerArgs,
} from "../contracts.js";
import type { NodeMediaRuntimeExport } from "./mount.js";
import { exportNodeArrangement } from "@superimg/node/arrangement";

/** Square by default, matching the door's own default (chat stills). */
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1080;
const RENDITION_ID = "arrange-still";
const INPUT_BASE_PATH = "media.arrange.still.input.request";

export type CreateNodeArrangeHandlerOptions = Readonly<{
  runtime: Runtime;
  exportMedia: NodeMediaRuntimeExport;
}>;

function requestIssuePath(path: string): string {
  return path.length === 0 ? INPUT_BASE_PATH : `${INPUT_BASE_PATH}.${path}`;
}

/** Translate shared domain failures into this interaction's declared error family. */
function refuse(cause: unknown): never {
  if (cause instanceof ArrangeRequestError) {
    throw new MediaInteractionError("INVALID_INPUT", requestIssuePath(cause.path), cause.message, { cause });
  }
  const error = cause as { code?: string; path?: string; message?: string; failures?: readonly { code: string; message: string }[] };
  if (error.code === "ARRANGEMENT_REFUSED" || error.code === "ARRANGEMENT_RESOURCE_REQUIRED" || error.code === "MISSING_EDITION" || error.code === "INVALID_TIME" || error.code === "EXPORT_STILL_FRAME_REQUIRED") {
    const message = error.failures?.map(failure => `${failure.code}: ${failure.message}`).join("; ") ?? error.message ?? String(cause);
    const path = error.path === "at" ? "media.arrange.still.input.at" : requestIssuePath(error.path ?? "spec");
    throw new MediaInteractionError("INVALID_INPUT", path, message, { cause });
  }
  throw cause;
}

export function createNodeArrangeHandler<Context>(
  options: CreateNodeArrangeHandlerOptions,
) {
  return async function arrange({
    input,
  }: MediaInteractionHandlerArgs<
    MediaArrangeStillInteractionInput,
    Context
  >): Promise<MediaArrangeStillOutput> {
    const width = input.width ?? DEFAULT_WIDTH;
    const height = input.height ?? DEFAULT_HEIGHT;
    const rendition: ExportRenditionRequest = {
      id: RENDITION_ID,
      format: "png",
      width,
      height,
    };
    let bundle;
    try {
      ({ bundle } = await exportNodeArrangement(options.runtime, input.request, {
        for: [rendition], providers: "skip", ...(input.at === undefined ? {} : { at: input.at }),
      }, {}, options.exportMedia));
    } catch (cause) {
      refuse(cause);
    }
    let primaryFailure: { error: unknown } | undefined;
    try {
      const artifact = bundle.artifacts[0];
      if (artifact === undefined) {
        throw new Error("Arrangement export produced no artifact");
      }
      const bytes = await artifact.bytes();
      return Object.freeze({
        mimeType: artifact.mimeType,
        bytes: bytesToBase64(bytes),
        width,
        height,
        sha256: artifact.sha256,
      });
    } catch (error) {
      primaryFailure = { error };
      throw error;
    } finally {
      try {
        await bundle.dispose();
      } catch (cleanupError) {
        if (primaryFailure) {
          throw new AggregateError([primaryFailure.error, cleanupError], "Arrangement byte read failed and bundle cleanup also failed", { cause: primaryFailure.error });
        }
        throw new Error("Arrangement bytes rendered but bundle cleanup failed", { cause: cleanupError });
      }
    }
  };
}
