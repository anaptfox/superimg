//! Project-owned review index and immutable per-run evidence directories.
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { findProjectRoot } from "./find-project-root.js";
import { canonicalizeToJson } from "@superimg/core";

export function projectReviewDirectory(sourcePath: string, editionId: string): string {
  const source = resolve(sourcePath);
  let project: string;
  try { project = findProjectRoot(dirname(source)); } catch { project = dirname(source); }
  const sourceKey = createHash("sha256").update(relative(project, source)).digest("hex").slice(0, 24);
  // Hash untrusted edition IDs rather than interpreting them as filesystem paths.
  const editionKey = createHash("sha256").update(editionId).digest("hex").slice(0, 24);
  return join(project, ".superimg", "reviews", sourceKey, editionKey);
}

export async function createReviewCapture(sourcePath: string, editionId: string): Promise<{ directory: string; indexPath: string }> {
  const directory = projectReviewDirectory(sourcePath, editionId);
  const captures = join(directory, "captures");
  await mkdir(captures, { recursive: true });
  return { directory: await mkdtemp(join(captures, "capture-")), indexPath: join(directory, "review.json") };
}

/** Publish a completed packet only. Prior captures and a previous index survive failure. */
export async function publishReviewIndex(indexPath: string, packet: unknown, signal?: AbortSignal): Promise<void> {
  const temporary = join(dirname(indexPath), `.review-${randomUUID()}.tmp`);
  try {
    signal?.throwIfAborted();
    await writeFile(temporary, `${JSON.stringify(packet, null, 2)}\n`, { flag: "wx" });
    signal?.throwIfAborted();
    await rename(temporary, indexPath);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Keep an addressable latest record per selection as well as the edition's latest.
 * Each pointer is atomic; if the second write fails, the outcome is unknown and
 * the previous edition pointer remains intact. Capture files are never replaced. */
export async function publishProjectReview<T extends { reportPath: string }>(indexPath: string, selection: unknown, packet: T, signal?: AbortSignal): Promise<T & { selectionPath: string }> {
  const key = createHash("sha256").update(canonicalizeToJson(selection as never)).digest("hex");
  const selectionPath = join(dirname(indexPath), "selections", key, "review.json");
  signal?.throwIfAborted();
  await mkdir(dirname(selectionPath), { recursive: true });
  await publishReviewIndex(selectionPath, { ...packet, reportPath: selectionPath, selectionPath }, signal);
  const latest = { ...packet, reportPath: indexPath, selectionPath };
  await publishReviewIndex(indexPath, latest, signal);
  return latest;
}
