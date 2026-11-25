//! `superimg takes` — list, annotate, restore, and look up source takes.
// `--json` is the agent surface. `good`, `bad`, and `note` live on `take.json`.

import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { diffTakes, formatTakeDiff } from "@superimg/core/takes";
import { findProjectRoot } from "../utils/find-project-root.js";
import { commandResult } from "../utils/command-result.js";
import { listMediaTakeFiles } from "../takes/capture.js";
import {
  findTakeInSearch,
  hashFileSync,
  isProjectFile,
  isScratchMedia,
  listTakes,
  matchTakes,
  readTakeFile,
  recordFeedback,
  restoreTake,
  searchTakes,
  sourcesFromFiles,
  takeDirectory,
  takeRelativePath,
  takesForRendition,
  type TakeFile,
  type TakeHit,
  type TakeRecord,
} from "../takes/store.js";

type TakeOptions = {
  json?: boolean;
  media?: string;
};

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

function emit(json: boolean | undefined, value: object, text: string): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(commandResult(value))}\n`);
    return;
  }
  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
}

function projectRootOr(start: string): string {
  try {
    return findProjectRoot(start);
  } catch {
    return resolve(start);
  }
}

function assertNotScratch(filePath: string): void {
  if (isScratchMedia(filePath)) fail("TAKE_SCRATCH", "scratch/ media is not recorded as a take");
}

function mediaQuery(media: string | undefined): { root: string; mediaDir?: string; mediaFile?: string } {
  if (!media) return { root: projectRootOr(process.cwd()) };
  const absolute = resolve(media);
  assertNotScratch(absolute);
  if (!existsSync(absolute)) fail("TAKE_NOT_FOUND", `Media path does not exist: ${absolute}`);
  const stat = statSync(absolute);
  if (stat.isDirectory()) return { root: absolute, mediaDir: absolute };
  const mediaDir = dirname(absolute);
  return { root: mediaDir, mediaDir, mediaFile: takeRelativePath(mediaDir, absolute) };
}

function listed(query: { root: string; mediaDir?: string; mediaFile?: string }): TakeHit[] {
  if (query.mediaDir) {
    return listTakes(query.mediaDir)
      .filter((record) => query.mediaFile === undefined || record.mediaFile === query.mediaFile)
      .map((record) => ({ mediaDir: query.mediaDir!, record }));
  }
  return searchTakes(query.root);
}

function located(id: string, media: string | undefined): TakeHit {
  const query = mediaQuery(media);
  if (!query.mediaDir) return findTakeInSearch(query.root, id);
  const matches = matchTakes(
    listTakes(query.mediaDir).filter((record) => query.mediaFile === undefined || record.mediaFile === query.mediaFile),
    id,
  );
  if (matches.length === 0) fail("TAKE_NOT_FOUND", `No take matches ${id}`);
  if (matches.length > 1) fail("TAKE_AMBIGUOUS", `${id} matches more than one take: ${matches.map((record) => record.id).join(", ")}`);
  return { mediaDir: query.mediaDir, record: matches[0]! };
}

function publicTake(hit: TakeHit): TakeRecord & { directory: string } {
  return { ...hit.record, directory: takeDirectory(hit.mediaDir, hit.record.id) };
}

function humanTake(hit: TakeHit): string {
  const record = hit.record;
  const duration = record.duration === undefined ? "" : `  ${record.duration}s`;
  const poster = record.poster ? takeDirectory(hit.mediaDir, record.id) + "/" + record.poster : "-";
  const lines = [
    `${record.id}${duration}  ${record.updatedAt}  ${poster}`,
    `  ${record.label ?? "unlabelled"}  ${record.mediaFile}`,
  ];
  if (record.note) lines.push(`  note: ${record.note}`);
  lines.push(`  good: ${record.good.length > 0 ? record.good.join(" | ") : "-"}`);
  lines.push(`  bad: ${record.bad.length > 0 ? record.bad.join(" | ") : "-"}`);
  for (const rendition of record.renditions) {
    lines.push(`  rendition ${rendition.sha256}${rendition.label ? `  ${rendition.label}` : ""}`);
  }
  return lines.join("\n");
}

export async function takesListCommand(media: string | undefined, options: { json?: boolean } = {}): Promise<void> {
  const hits = listed(mediaQuery(media));
  const takes = hits.map(publicTake);
  emit(options.json, { takes }, takes.length === 0 ? "No takes." : hits.map(humanTake).join("\n\n"));
}

export async function takesFeedbackCommand(id: string, options: TakeOptions & {
  good?: string[];
  bad?: string[];
  note?: string;
  label?: string;
  replace?: boolean;
}): Promise<void> {
  const good = options.good && options.good.length > 0 ? options.good : undefined;
  const bad = options.bad && options.bad.length > 0 ? options.bad : undefined;
  const hit = located(id, options.media);
  const record = recordFeedback({
    mediaDir: hit.mediaDir,
    id: hit.record.id,
    ...(good ? { good } : {}),
    ...(bad ? { bad } : {}),
    ...(options.note !== undefined ? { note: options.note } : {}),
    ...(options.label !== undefined ? { label: options.label } : {}),
    ...(options.replace ? { replace: true } : {}),
  });
  const next = publicTake({ mediaDir: hit.mediaDir, record });
  emit(options.json, { take: next }, humanTake({ mediaDir: hit.mediaDir, record }));
}

export async function takesRestoreCommand(id: string, options: TakeOptions & {
  listFiles?: (templatePath: string) => Promise<readonly string[]>;
} = {}): Promise<void> {
  const hit = located(id, options.media);
  const mediaPath = resolve(hit.mediaDir, hit.record.mediaFile);
  assertNotScratch(mediaPath);
  if (!existsSync(mediaPath)) {
    fail(
      "TAKE_SOURCE",
      `Current media file is missing (${mediaPath}). Refusing to restore until a current take can be saved. Print the old file with: superimg takes show ${hit.record.id} ${hit.record.mediaFile}`,
    );
  }
  const paths = options.listFiles
    ? await options.listFiles(mediaPath)
    : await currentTakeFiles(mediaPath, hit.mediaDir, hit.record.files);
  const current = sourcesFromFiles(hit.mediaDir, [...new Set([resolve(mediaPath), ...paths.map((file) => resolve(hit.mediaDir, file))])]);
  const outcome = restoreTake({
    mediaDir: hit.mediaDir,
    id: hit.record.id,
    mediaFile: hit.record.mediaFile,
    current,
  });
  const skippedText = outcome.skipped.length > 0
    ? `\nskipped ${outcome.skipped.length} file${outcome.skipped.length === 1 ? "" : "s"} outside the project`
    : "";
  const text = outcome.saved
    ? `saved ${outcome.saved.id}\nrestored ${outcome.target.id}\nwrote ${outcome.wrote.length} file${outcome.wrote.length === 1 ? "" : "s"}${skippedText}`
    : `already ${outcome.target.id}`;
  emit(options.json, {
    saved: outcome.saved ? publicTake({ mediaDir: hit.mediaDir, record: outcome.saved }) : null,
    restored: publicTake({ mediaDir: hit.mediaDir, record: outcome.target }),
    wrote: outcome.wrote,
    omitted: outcome.omitted,
    skipped: outcome.skipped,
  }, text);
}

async function currentTakeFiles(
  templatePath: string,
  mediaDir: string,
  targetFiles: readonly TakeFile[],
): Promise<readonly string[]> {
  const files = new Set<string>();
  try {
    for (const file of await listMediaTakeFiles(templatePath)) files.add(resolve(mediaDir, file));
  } catch {
    // Keep restoring even when the current media file no longer compiles.
  }
  // Files the target take recorded (such as a score) may be gone or changed on disk now.
  for (const file of targetFiles) {
    const absolute = resolve(mediaDir, file.path);
    if (!isProjectFile(mediaDir, absolute)) continue;
    try {
      if (statSync(absolute).isFile()) files.add(absolute);
    } catch {
      // Target file is absent on disk right now.
    }
  }
  return [...files];
}

export async function takesShowCommand(
  id: string,
  file: string,
  options: TakeOptions & { write?: (chunk: Uint8Array | string) => void } = {},
): Promise<void> {
  const hit = located(id, options.media);
  const shown = readTakeFile(hit.mediaDir, hit.record.id, file);
  if (options.json) {
    const text = asText(shown.bytes);
    emit(true, {
      path: shown.path,
      sha256: shown.sha256,
      ...(text === undefined ? { base64: Buffer.from(shown.bytes).toString("base64") } : { text }),
    }, "");
    return;
  }
  (options.write ?? ((chunk) => process.stdout.write(chunk)))(shown.bytes);
}

export async function takesFromCommand(file: string, options: { json?: boolean } = {}): Promise<void> {
  const absolute = resolve(file);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) fail("TAKE_NOT_FOUND", `Rendition file does not exist: ${absolute}`);
  const sha256 = hashFileSync(absolute);
  const hits = takesForRendition(projectRootOr(dirname(absolute)), sha256);
  if (hits.length === 0) fail("TAKE_NOT_FOUND", `No take recorded rendition ${sha256}`);
  emit(options.json, { takes: hits.map(publicTake) }, hits.map(humanTake).join("\n\n"));
}

function readTakeScriptMarkdown(hit: TakeHit): string | undefined {
  const scriptEntry = hit.record.files.find((file) => file.path.toLowerCase().endsWith(".script.md"));
  if (!scriptEntry) return undefined;
  try {
    const shown = readTakeFile(hit.mediaDir, hit.record.id, scriptEntry.path);
    return asText(shown.bytes);
  } catch {
    return undefined;
  }
}

export async function takesDiffCommand(
  fromId: string,
  toId: string,
  options: TakeOptions = {},
): Promise<void> {
  const fromHit = located(fromId, options.media);
  const toHit = located(toId, options.media);
  const fromScript = readTakeScriptMarkdown(fromHit);
  const toScript = readTakeScriptMarkdown(toHit);
  const diff = diffTakes(fromHit.record, toHit.record, {
    ...(fromScript !== undefined ? { fromScript } : {}),
    ...(toScript !== undefined ? { toScript } : {}),
  });
  emit(options.json, { diff }, formatTakeDiff(diff));
}

function asText(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}
