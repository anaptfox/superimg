import type { ExportBundle } from "@superimg/types";
import type { TakeCueSnapshot, TakeFile, TakeRecordV2, TakeRendition } from "./types.js";

export interface TakeFromBundleMeta {
  readonly id: string;
  readonly mediaFile: string;
  readonly label?: string;
  readonly tenantId?: string;
  readonly storyId?: string;
  readonly scriptHash?: string;
  readonly editHash?: string;
  readonly duration?: number;
  readonly fps?: number;
  readonly canvas?: Readonly<{ width: number; height: number }>;
  readonly cues?: readonly TakeCueSnapshot[];
  readonly files?: readonly TakeFile[];
  readonly poster?: string;
  readonly now?: Date;
}

/**
 * Construct a portable `TakeRecordV2` from a runtime `ExportBundle` without
 * touching the local filesystem. Suitable for cloud workers storing takes in
 * Postgres + R2/S3.
 */
export function takeFromExportBundle(
  bundle: Pick<ExportBundle, "manifest">,
  meta: TakeFromBundleMeta,
): TakeRecordV2 {
  const timestamp = (meta.now ?? new Date()).toISOString();
  const renditions: TakeRendition[] = bundle.manifest.artifacts.map((artifact) => ({
    sha256: artifact.sha256,
    path: artifact.path,
    mimeType: artifact.mimeType,
    label: artifact.coordinates.renditionId,
    coordinates: artifact.coordinates,
  }));

  return {
    schemaVersion: 2,
    id: meta.id,
    ...(meta.tenantId !== undefined ? { tenantId: meta.tenantId } : {}),
    ...(meta.storyId !== undefined ? { storyId: meta.storyId } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
    mediaFile: meta.mediaFile,
    ...(meta.label !== undefined ? { label: meta.label } : {}),
    programHash: bundle.manifest.programDigest,
    ...(meta.scriptHash !== undefined ? { scriptHash: meta.scriptHash } : {}),
    ...(meta.editHash !== undefined ? { editHash: meta.editHash } : {}),
    ...(meta.canvas !== undefined ? { canvas: meta.canvas } : {}),
    ...(meta.fps !== undefined ? { fps: meta.fps } : {}),
    ...(meta.duration !== undefined ? { duration: meta.duration } : {}),
    good: [],
    bad: [],
    feedback: [],
    files: [...(meta.files ?? [])],
    renditions,
    ...(meta.cues !== undefined ? { cues: [...meta.cues] } : {}),
    ...(meta.poster !== undefined ? { poster: meta.poster } : {}),
  };
}
