//! In-memory `TakeStore` for browsers, tests, edge previews, and ephemeral studio sessions.
//! Zero `node:fs` dependencies.

import type {
  AddTakeFeedbackInput,
  TakeFeedbackEntry,
  TakeRecordV2,
  TakeStore,
  TakeStoreFilter,
} from "./types.js";

function cloneTake(take: TakeRecordV2): TakeRecordV2 {
  return structuredClone(take);
}

/** Create a portable in-memory `TakeStore` backed by JavaScript `Map`s. */
export function createMemoryTakeStore(): TakeStore {
  const takes = new Map<string, TakeRecordV2>();
  const blobs = new Map<string, Uint8Array>();
  let feedbackSeq = 0;

  return {
    async list(filter?: TakeStoreFilter): Promise<readonly TakeRecordV2[]> {
      const results: TakeRecordV2[] = [];
      for (const take of takes.values()) {
        if (filter?.tenantId !== undefined && take.tenantId !== filter.tenantId) continue;
        if (filter?.storyId !== undefined && take.storyId !== filter.storyId) continue;
        if (filter?.mediaFile !== undefined && take.mediaFile !== filter.mediaFile) continue;
        results.push(cloneTake(take));
      }
      results.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
      return results;
    },

    async get(id: string): Promise<TakeRecordV2 | null> {
      const hit = takes.get(id);
      return hit ? cloneTake(hit) : null;
    },

    async put(take: TakeRecordV2): Promise<void> {
      takes.set(take.id, cloneTake(take));
    },

    async putBlob(sha256: string, bytes: Uint8Array): Promise<void> {
      blobs.set(sha256, new Uint8Array(bytes));
    },

    async getBlob(sha256: string): Promise<Uint8Array | null> {
      const hit = blobs.get(sha256);
      return hit ? new Uint8Array(hit) : null;
    },

    async addFeedback(id: string, entry: AddTakeFeedbackInput): Promise<TakeRecordV2> {
      const current = takes.get(id);
      if (!current) {
        throw new Error(`Take "${id}" not found.`);
      }
      feedbackSeq += 1;
      const now = entry.createdAt ?? new Date().toISOString();
      const created: TakeFeedbackEntry = {
        ...entry,
        id: entry.id ?? `fb-${feedbackSeq}`,
        createdAt: now,
      };
      const good = entry.kind === "good" ? [...current.good, entry.text] : [...current.good];
      const bad = entry.kind === "bad" ? [...current.bad, entry.text] : [...current.bad];
      const updated: TakeRecordV2 = {
        ...cloneTake(current),
        updatedAt: now,
        good,
        bad,
        feedback: [...current.feedback, created],
      };
      takes.set(id, updated);
      return cloneTake(updated);
    },

    async findByRendition(sha256: string): Promise<readonly TakeRecordV2[]> {
      const matches: TakeRecordV2[] = [];
      for (const take of takes.values()) {
        if (take.renditions.some((r) => r.sha256 === sha256)) {
          matches.push(cloneTake(take));
        }
      }
      matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
      return matches;
    },
  };
}
