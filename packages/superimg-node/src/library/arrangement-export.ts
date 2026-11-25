import { parseDuration } from "@superimg/core";
import { exportMedia } from "@superimg/core/runtime";
import { resolveDestinationTarget } from "@superimg/core/destinations";
import type { ExportBundle, ExportOptions, ExportableMedia, Runtime } from "@superimg/types";
import { assertArrangementDestinations, resolveArrangementStillSelection } from "./arrangement-selection.js";
import { prepareNodeArrangementRequest } from "./prepared-arrangement.js";

type PreparedArrangement = Awaited<ReturnType<typeof prepareNodeArrangementRequest>>;
export type ArrangementExportRunner = (runtime: Runtime, media: ExportableMedia, options: ExportOptions) => Promise<ExportBundle>;

/** Export an admitted arrangement without publishing it. The caller owns bundle disposal. */
export async function exportPreparedNodeArrangement(
  runtime: Runtime,
  prepared: PreparedArrangement,
  options: ExportOptions,
  runner: ArrangementExportRunner = exportMedia,
) {
  assertArrangementDestinations(prepared.media, options.for, options.editionIds);
  const isStill = options.for.some(destination => {
    const target = typeof destination === "string" ? resolveDestinationTarget(destination) : destination;
    return (!("kind" in target) || target.kind === "custom") && ["png", "jpeg", "webp", "svg"].includes(target.format ?? (prepared.media.animated ? "mp4" : "png"));
  });
  const at = typeof options.at === "string" ? parseDuration(options.at, "at", prepared.media.config?.fps ?? 30) : options.at;
  const clock = isStill && prepared.media.animated ? resolveArrangementStillSelection(prepared.media, at) : undefined;
  const bundle = await runner(runtime, prepared.media, { ...options, ...(clock === undefined ? {} : { at: clock.encodedSeconds }) });
  return Object.freeze({ bundle, clock });
}

/** Admit, prepare and export one portable request; no publication is performed. */
export async function exportNodeArrangement(
  runtime: Runtime,
  request: unknown,
  options: ExportOptions,
  preparation: Parameters<typeof prepareNodeArrangementRequest>[1] = {},
  runner: ArrangementExportRunner = exportMedia,
) {
  options.signal?.throwIfAborted();
  const prepared = await prepareNodeArrangementRequest(request, preparation);
  options.signal?.throwIfAborted();
  const result = await exportPreparedNodeArrangement(runtime, prepared, options, runner);
  return Object.freeze({ prepared, ...result });
}
