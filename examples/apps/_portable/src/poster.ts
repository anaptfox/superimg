import {
  payloadFromMediaIR,
  renderPosterMarkup,
  type SerializableMediaPayload,
} from "@superimg/adapters";
import { makeSampleMediaIR } from "./sample-ir.js";

export type { SerializableMediaPayload };

/** Build RSC/SSR-safe serializable payload for a framework shell. */
export function buildDemoPayload(
  sourceId: string,
  options?: { width?: number; height?: number; title?: string; alt?: string },
): SerializableMediaPayload {
  const ir = makeSampleMediaIR(
    sourceId,
    options?.width ?? 960,
    options?.height ?? 540,
  );
  return payloadFromMediaIR(ir, {
    data: { title: options?.title ?? sourceId },
    alt: options?.alt ?? sourceId,
    includeMedia: true,
  });
}

export function posterHtmlFromPayload(payload: SerializableMediaPayload): string {
  return renderPosterMarkup(payload.poster);
}
