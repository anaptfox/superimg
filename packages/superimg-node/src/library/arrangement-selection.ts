//! Selection shared by native file commands and portable arrangement calls.
//! No paths, publication policy, runtime lifetime or caller authority lives here.
import { parseDuration } from "@superimg/core";
import { resolveDestinationTarget } from "@superimg/core/destinations";
import { resolveEncodedFrame } from "@superimg/core/runtime";
import type { ExportRenditionRequest, ImageDefinition, VideoDefinition } from "@superimg/types";

type ArrangementMedia = ImageDefinition | VideoDefinition;

export function assertArrangementEditions(media: Pick<ArrangementMedia, "editions">, ids: readonly string[]): void {
  for (const id of ids) {
    if (id !== "default" && !Object.hasOwn(media.editions ?? {}, id)) {
      throw Object.assign(new Error(`Unknown arrangement edition '${id}'; add it under editions or select default.`), { code: "UNKNOWN_EDITION", path: `editions.${id}` });
    }
  }
}

/** The root and explicitly authored editions are the complete allowed aspects. */
export function assertArrangementDestinations(
  media: ArrangementMedia,
  destinations: readonly (string | ExportRenditionRequest)[],
  editionIds: readonly string[] = [],
): void {
  assertArrangementEditions(media, editionIds);
  const rootSize = { width: media.config?.width ?? 1080, height: media.config?.height ?? 1080 };
  const sizes = editionIds.length
    ? editionIds.map(id => id === "default" ? rootSize : media.editions![id]!.size)
    : [rootSize, ...Object.values(media.editions ?? {}).map(edition => edition.size)];
  for (const destination of destinations) {
    const target = typeof destination === "string" ? resolveDestinationTarget(destination) : destination;
    const size = "kind" in target
      ? target.kind === "custom" ? target : target.destination.recommendedCanvas.value
      : target;
    if (!sizes.some(candidate => candidate.width * size.height === candidate.height * size.width)) {
      const matching = [
        ...(rootSize.width * size.height === rootSize.height * size.width ? ["default"] : []),
        ...Object.entries(media.editions ?? {}).filter(([, edition]) => edition.size.width * size.height === edition.size.height * size.width).map(([id]) => id),
      ];
      const hint = editionIds.length && matching.length
        ? `Select matching ${matching.length === 1 ? "edition" : "editions"}: ${matching.map(id => `--edition ${id}`).join(", ")}.`
        : `Add an editions entry with size ${size.width}×${size.height}.`;
      throw Object.assign(new Error(`Destination ${typeof destination === "string" ? destination : destination.id} needs a matching arrangement aspect. ${hint}`), { code: "MISSING_EDITION", path: "editions" });
    }
  }
}

/** Seconds in, encoded clock out. Omission selects the pattern's answer poster. */
export function resolveArrangementStillSelection(media: ArrangementMedia, at?: number) {
  const fps = media.config?.fps ?? 30;
  const duration = media.animated ? parseDuration(media.config?.duration, "duration", fps) : 0;
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  if (at !== undefined && (!Number.isFinite(at) || at < 0)) {
    throw Object.assign(new Error("--at must be non-negative and finite"), { code: "INVALID_TIME", path: "at" });
  }
  if (media.animated && at === undefined && media.poster === undefined) {
    throw Object.assign(new Error("No answer poster is available; select --at explicitly"), { code: "EXPORT_STILL_FRAME_REQUIRED", path: "at" });
  }
  const seconds = at ?? (media.poster === undefined ? 0 : parseDuration(media.poster, "poster", fps));
  return Object.freeze({
    ...resolveEncodedFrame(seconds, fps, totalFrames),
    fps, duration, totalFrames,
    origin: at !== undefined ? "explicit" as const : media.animated ? "pattern-poster" as const : "static" as const,
  });
}

/** One warning shared by command output and retained review evidence. */
export function arrangementSelectionFindings(selection: { requestedSeconds: number; frame: number; encodedSeconds: number; clamped: boolean }) {
  return selection.clamped ? [{ code: "STILL_TIME_CLAMPED", severity: "warning" as const, category: "render" as const, message: `Requested ${selection.requestedSeconds}s resolves to frame ${selection.frame} at ${selection.encodedSeconds}s.`, details: { requestedSeconds: selection.requestedSeconds, resolvedSeconds: selection.encodedSeconds, frame: selection.frame } }] : [];
}
