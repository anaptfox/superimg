//! Storage-agnostic take record, store contract, and diff types.
//! Zero `node:fs` dependencies so cloud hosts (Next.js, Vercel, Workers, R2/S3,
//! Postgres) and local CLI share one canonical schema.

import type { RuntimeRenditionCoordinates } from "@superimg/types";

export interface TakeFile {
  readonly path: string;
  readonly sha256: string;
}

export interface TakeOmission {
  readonly path: string;
  readonly reason: string;
}

export interface TakeRendition {
  readonly sha256: string;
  readonly path?: string;
  readonly mimeType?: string;
  readonly label?: string;
  readonly coordinates?: RuntimeRenditionCoordinates;
}

export interface TakeFeedbackEntry {
  readonly id: string;
  readonly kind: "good" | "bad" | "note";
  readonly text: string;
  readonly createdAt: string;
  readonly author?: string;
  readonly cueId?: string;
  readonly atSeconds?: number;
}

export interface TakeCueSnapshot {
  readonly id: string;
  readonly kind?: "shot" | "speech" | "card";
  readonly start?: number;
  readonly end?: number;
  readonly still?: number;
  readonly hold?: number;
  readonly who?: string;
  readonly text?: string;
}

export interface TakeRecordV2 {
  readonly schemaVersion: 2;
  readonly id: string;
  readonly tenantId?: string;
  readonly storyId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly mediaFile: string;
  readonly label?: string;
  readonly packages?: Readonly<Record<string, string>>;
  readonly programHash?: string;
  readonly scriptHash?: string;
  readonly editHash?: string;
  readonly canvas?: Readonly<{ width: number; height: number }>;
  readonly fps?: number;
  readonly duration?: number;
  readonly note?: string;
  readonly good: readonly string[];
  readonly bad: readonly string[];
  readonly feedback: readonly TakeFeedbackEntry[];
  readonly files: readonly TakeFile[];
  readonly omitted?: readonly TakeOmission[];
  readonly renditions: readonly TakeRendition[];
  readonly cues?: readonly TakeCueSnapshot[];
  readonly poster?: string;
}

/** Structural input accepted by `diffTakes()`, compatible with CLI v1 and portable v2 takes. */
export interface TakeLike {
  readonly id: string;
  readonly label?: string;
  readonly duration?: number;
  readonly fps?: number;
  readonly canvas?: Readonly<{ width: number; height: number }>;
  readonly programHash?: string;
  readonly scriptHash?: string;
  readonly editHash?: string;
  readonly files?: readonly TakeFile[];
  readonly renditions?: readonly TakeRendition[];
  readonly cues?: readonly TakeCueSnapshot[];
}

export interface TakeStoreFilter {
  readonly tenantId?: string;
  readonly storyId?: string;
  readonly mediaFile?: string;
}

export type AddTakeFeedbackInput = Omit<TakeFeedbackEntry, "id" | "createdAt"> & {
  readonly id?: string;
  readonly createdAt?: string;
};

/**
 * Storage-agnostic async take store implemented by local filesystem, S3/R2,
 * Postgres, or in-memory hosts.
 */
export interface TakeStore {
  list(filter?: TakeStoreFilter): Promise<readonly TakeRecordV2[]>;
  get(id: string): Promise<TakeRecordV2 | null>;
  put(take: TakeRecordV2): Promise<void>;
  putBlob(sha256: string, bytes: Uint8Array, mimeType?: string): Promise<void>;
  getBlob(sha256: string): Promise<Uint8Array | null>;
  addFeedback(id: string, entry: AddTakeFeedbackInput): Promise<TakeRecordV2>;
  findByRendition(sha256: string): Promise<readonly TakeRecordV2[]>;
}

export interface TakeCueDiff {
  readonly id: string;
  readonly kind?: "shot" | "speech" | "card";
  readonly change: "added" | "removed" | "changed";
  readonly before?: TakeCueSnapshot;
  readonly after?: TakeCueSnapshot;
  readonly deltaSeconds?: number;
  readonly textChanged?: boolean;
}

export interface TakeFileDiff {
  readonly path: string;
  readonly change: "added" | "removed" | "changed";
  readonly beforeSha256?: string;
  readonly afterSha256?: string;
}

export interface TakeDiff {
  readonly fromId: string;
  readonly toId: string;
  readonly durationDeltaSeconds: number | null;
  readonly programChanged: boolean;
  readonly scriptChanged: boolean;
  readonly files: readonly TakeFileDiff[];
  readonly cues: readonly TakeCueDiff[];
}
