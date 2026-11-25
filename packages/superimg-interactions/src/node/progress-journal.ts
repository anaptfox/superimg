import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  mkdir,
  lstat,
  open,
  readFile,
  rename,
  truncate,
  unlink,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import type { MediaInteractionId } from "../contracts.js";
import type {
  MediaInteractionProgressFailure,
  MediaInteractionProgressItem,
  MediaInteractionProgressObserver,
  MediaInteractionProgressInteractionIdentity,
  MediaInteractionProgressRecord,
  MediaInteractionProgressState,
  MediaInteractionProgressSubject,
  MediaInteractionProgressUnit,
  MediaInteractionProgressWork,
} from "../progress.js";

export type MediaInteractionProgressJournalKey =
  MediaInteractionProgressInteractionIdentity;

export type MediaInteractionProgressJournalPaths = Readonly<{
  /** Private directory for one exact execution, attempt, Program, and contract. */
  directory: string;
  /** Append-only, fsynced progress records. This is the durable authority. */
  events: string;
  /** Atomically replaced, fsynced projection of the current host status. */
  latest: string;
}>;

export type MediaInteractionProgressRecovery =
  | Readonly<{ classification: "live" }>
  | Readonly<{ classification: "terminal" }>
  | Readonly<{
      classification: "resumable";
      reason: string;
    }>
  | Readonly<{
      classification: "uncertain";
      reason: string;
      consequentialStageIds: readonly string[];
    }>;

export type MediaInteractionProgressJournalStatus = Readonly<{
  schemaVersion: 1;
  kind: "media-interaction-progress-status";
  interaction: MediaInteractionProgressInteractionIdentity;
  /** `started` is projected as the host-level, nonterminal `running` state. */
  state: Exclude<MediaInteractionProgressState, "started">;
  terminal: boolean;
  /** Cursor of the last fsynced record in `events.jsonl`. */
  sequence: number;
  /** Elapsed time retained from that same durable record. */
  elapsedMs: number;
  /** The exact last emitted record. Recovery never fabricates a record. */
  latest: MediaInteractionProgressRecord;
  /** Nonterminal stages at the durable cursor, sorted by stage id. */
  openStageIds: readonly string[];
  recovery: MediaInteractionProgressRecovery;
}>;

export type MediaInteractionProgressResumeCheckpoint = Readonly<{
  sequence: number;
  elapsedMs: number;
}>;

export type MediaInteractionProgressReplayOptions = Readonly<{
  /** Return records whose raw progress sequence is greater than this cursor. */
  afterSequence?: number;
}>;

export interface MediaInteractionProgressSubscription {
  /** Stop future delivery. Already queued observer calls may still finish. */
  unsubscribe(): void;
}

export type CreateNodeMediaInteractionProgressJournalOptions = Readonly<{
  directory: string;
  /** Stages whose interrupted open state requires reconciliation, not retry. */
  consequentialStageIds?: readonly string[];
}>;

export type NodeMediaInteractionProgressJournalErrorCode =
  | "LEGACY_EXECUTION_IDENTITY"
  | "INVALID_PROGRESS_JOURNAL_VALUE"
  | "PROGRESS_JOURNAL_IDENTITY_MISMATCH"
  | "PROGRESS_JOURNAL_NONCONTIGUOUS"
  | "PROGRESS_JOURNAL_CORRUPT"
  | "PROGRESS_JOURNAL_TERMINAL";

export class NodeMediaInteractionProgressJournalError extends Error {
  readonly code: NodeMediaInteractionProgressJournalErrorCode;
  readonly path: string;

  constructor(
    code: NodeMediaInteractionProgressJournalErrorCode,
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "NodeMediaInteractionProgressJournalError";
    this.code = code;
    this.path = path;
  }
}

export interface NodeMediaInteractionProgressJournal
  extends MediaInteractionProgressObserver {
  /** Deterministic, traversal-safe paths for one exact interaction identity. */
  paths(key: MediaInteractionProgressJournalKey): MediaInteractionProgressJournalPaths;
  /** Replay durable records after a raw sequence cursor. */
  replay(
    key: MediaInteractionProgressJournalKey,
    options?: MediaInteractionProgressReplayOptions,
  ): Promise<readonly MediaInteractionProgressRecord[]>;
  /** Read or rebuild `latest.json` from the authoritative JSONL journal. */
  latest(
    key: MediaInteractionProgressJournalKey,
  ): Promise<MediaInteractionProgressJournalStatus | undefined>;
  /**
   * Return a safe reporter checkpoint for interrupted nonconsequential work.
   * Terminal or consequentially uncertain work returns `undefined` so this API
   * cannot authorize a blind retry. The checkpoint is a durable cursor; it
   * does not by itself hydrate a reporter's per-stage or per-item lifecycle.
   */
  resume(
    key: MediaInteractionProgressJournalKey,
  ): Promise<MediaInteractionProgressResumeCheckpoint | undefined>;
  /**
   * Explicitly classify an interrupted attempt from durable progress only.
   * The caller must first establish through its host lease/fence that the prior
   * writer is inactive. This does not prove an effect, retry it, or append a
   * synthetic event.
   */
  recover(
    key: MediaInteractionProgressJournalKey,
  ): Promise<MediaInteractionProgressJournalStatus | undefined>;
  /**
   * Replay then observe without a gap. Observer failure never rolls back a
   * durable append; a failing live observer is unsubscribed and may reconnect.
   */
  subscribe(
    key: MediaInteractionProgressJournalKey,
    observer: MediaInteractionProgressObserver,
    options?: MediaInteractionProgressReplayOptions,
  ): Promise<MediaInteractionProgressSubscription>;
}

type JournalAnalysis = Readonly<{
  interactionState: MediaInteractionProgressState;
  openStageIds: readonly string[];
  stageStates: ReadonlyMap<string, MediaInteractionProgressState>;
}>;

type JournalAuthority = Readonly<{
  records: readonly MediaInteractionProgressRecord[];
  analysis?: JournalAnalysis;
}>;

type MutableSubjectState = {
  subject: MediaInteractionProgressSubject;
  state: MediaInteractionProgressState;
  readonly work: Map<MediaInteractionProgressUnit, MediaInteractionProgressWork>;
};

type Subscriber = {
  readonly observer: MediaInteractionProgressObserver;
  tail: Promise<void>;
};

const DEFAULT_CONSEQUENTIAL_STAGE_IDS = Object.freeze(["publication.commit"]);
const TERMINAL_STATES = new Set<MediaInteractionProgressState>([
  "succeeded",
  "failed",
  "cancelled",
  "uncertain",
]);
const PROGRESS_UNITS = new Set<MediaInteractionProgressUnit>([
  "items",
  "renditions",
  "frames",
  "bytes",
]);
const PROGRESS_STATES = new Set<MediaInteractionProgressState>([
  "started",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "uncertain",
]);
const ITEM_KINDS = new Set(["source", "entry", "rendition", "artifact"]);
const utf8 = new TextDecoder("utf-8", { fatal: true });

/**
 * Creates one process-local coordinator over host-owned durable progress files.
 * Use one instance per root and one host-fenced writer per key. Reconnecting
 * processes reconstruct all state from the files and raw sequence cursor only
 * after the prior writer is inactive.
 */
export function createNodeMediaInteractionProgressJournal(
  options: CreateNodeMediaInteractionProgressJournalOptions,
): NodeMediaInteractionProgressJournal {
  if (typeof options.directory !== "string" || options.directory.length === 0) {
    throw invalid("options.directory", "directory must be a non-empty string");
  }
  const root = resolve(options.directory);
  const consequentialStageIds = copyStageIds(
    options.consequentialStageIds ?? DEFAULT_CONSEQUENTIAL_STAGE_IDS,
  );
  const consequentialStages = new Set(consequentialStageIds);
  const subscribers = new Map<string, Map<symbol, Subscriber>>();
  let serial: Promise<void> = Promise.resolve();

  function paths(
    value: MediaInteractionProgressJournalKey,
  ): MediaInteractionProgressJournalPaths {
    const key = copyIdentity(value, "key");
    const execution = digest(["execution", key.executionId]);
    const attempt = digest(["attempt", key.attemptId ?? null]);
    const identity = digest(identityTuple(key));
    const directory = join(
      root,
      "v1",
      `execution-${execution}`,
      `attempt-${attempt}`,
      `interaction-${identity}`,
    );
    return Object.freeze({
      directory,
      events: join(directory, "events.jsonl"),
      latest: join(directory, "latest.json"),
    });
  }

  function schedule<Value>(work: () => Promise<Value>): Promise<Value> {
    const result = serial.then(work);
    serial = result.then(() => undefined, () => undefined);
    return result;
  }

  function append(
    value: MediaInteractionProgressRecord,
  ): Promise<void> {
    const record = copyRecord(value, "record", "INVALID_PROGRESS_JOURNAL_VALUE");
    const key = record.interaction;
    const interactionPaths = paths(key);
    const interactionToken = token(key);
    const persisted = schedule(async () => {
      const authority = await loadAuthority(interactionPaths, key);
      const currentAnalysis = authority.analysis;
      if (
        currentAnalysis !== undefined &&
        TERMINAL_STATES.has(currentAnalysis.interactionState)
      ) {
        throw new NodeMediaInteractionProgressJournalError(
          "PROGRESS_JOURNAL_TERMINAL",
          "record.state",
          "cannot append progress after the interaction terminal record",
        );
      }
      const records = Object.freeze([...authority.records, record]);
      const analysis = analyzeRecords(
        records,
        key,
        "INVALID_PROGRESS_JOURNAL_VALUE",
      );
      const status = buildLiveStatus(records, analysis);
      await appendDurably(interactionPaths, record);
      await writeStatusAtomically(interactionPaths, status);

      const deliveries = [...(subscribers.get(interactionToken)?.entries() ?? [])]
        .map(([id, subscriber]) => ({
          id,
          subscriber,
          delivery: enqueue(subscriber, record),
        }));
      return { deliveries };
    });

    return persisted.then(async ({ deliveries }) => {
      const results = await Promise.allSettled(
        deliveries.map(({ delivery }) => delivery),
      );
      for (const [index, result] of results.entries()) {
        if (result.status !== "rejected") continue;
        const failed = deliveries[index]!;
        subscribers.get(interactionToken)?.delete(failed.id);
      }
    });
  }

  function replay(
    keyValue: MediaInteractionProgressJournalKey,
    replayOptions: MediaInteractionProgressReplayOptions = {},
  ): Promise<readonly MediaInteractionProgressRecord[]> {
    const key = copyIdentity(keyValue, "key");
    const afterSequence = copyCursor(replayOptions.afterSequence);
    const interactionPaths = paths(key);
    return schedule(async () => {
      const authority = await loadAuthority(interactionPaths, key);
      assertCursorAtTail(afterSequence, authority.records);
      return Object.freeze(
        authority.records.filter((record) => record.sequence > afterSequence),
      );
    });
  }

  function latest(
    keyValue: MediaInteractionProgressJournalKey,
  ): Promise<MediaInteractionProgressJournalStatus | undefined> {
    const key = copyIdentity(keyValue, "key");
    const interactionPaths = paths(key);
    return schedule(async () => {
      const authority = await loadAuthority(interactionPaths, key);
      const analysis = authority.analysis;
      if (authority.records.length === 0 || analysis === undefined) {
        return undefined;
      }
      const cached = await readCurrentSnapshot(
        interactionPaths,
        { records: authority.records, analysis },
        consequentialStages,
      );
      if (cached !== undefined) return cached;
      const rebuilt = buildLiveStatus(authority.records, analysis);
      await writeStatusAtomically(interactionPaths, rebuilt);
      return rebuilt;
    });
  }

  function recover(
    keyValue: MediaInteractionProgressJournalKey,
  ): Promise<MediaInteractionProgressJournalStatus | undefined> {
    const key = copyIdentity(keyValue, "key");
    const interactionPaths = paths(key);
    return schedule(async () => {
      const authority = await loadAuthority(interactionPaths, key);
      if (authority.records.length === 0 || authority.analysis === undefined) {
        return undefined;
      }
      const status = buildRecoveryStatus(
        authority.records,
        authority.analysis,
        consequentialStages,
      );
      await writeStatusAtomically(interactionPaths, status);
      return status;
    });
  }

  async function resume(
    key: MediaInteractionProgressJournalKey,
  ): Promise<MediaInteractionProgressResumeCheckpoint | undefined> {
    const status = await recover(key);
    if (
      status === undefined ||
      status.terminal ||
      status.recovery.classification !== "resumable"
    ) {
      return undefined;
    }
    return Object.freeze({
      sequence: status.sequence,
      elapsedMs: status.elapsedMs,
    });
  }

  function subscribe(
    keyValue: MediaInteractionProgressJournalKey,
    observer: MediaInteractionProgressObserver,
    replayOptions: MediaInteractionProgressReplayOptions = {},
  ): Promise<MediaInteractionProgressSubscription> {
    const key = copyIdentity(keyValue, "key");
    if (typeof observer?.append !== "function") {
      throw invalid("observer.append", "observer.append must be a function");
    }
    const afterSequence = copyCursor(replayOptions.afterSequence);
    const interactionPaths = paths(key);
    const interactionToken = token(key);
    const id = Symbol("media-interaction-progress-subscriber");
    const subscriber: Subscriber = { observer, tail: Promise.resolve() };
    const prepared = schedule(async () => {
      const authority = await loadAuthority(interactionPaths, key);
      assertCursorAtTail(afterSequence, authority.records);
      const deliveries = authority.records
        .filter((record) => record.sequence > afterSequence)
        .map((record) => enqueue(subscriber, record));
      let interactionSubscribers = subscribers.get(interactionToken);
      if (interactionSubscribers === undefined) {
        interactionSubscribers = new Map();
        subscribers.set(interactionToken, interactionSubscribers);
      }
      interactionSubscribers.set(id, subscriber);
      return { deliveries };
    });

    return prepared.then(async ({ deliveries }) => {
      try {
        await Promise.all(deliveries);
      } catch (cause) {
        subscribers.get(interactionToken)?.delete(id);
        throw cause;
      }
      return Object.freeze({
        unsubscribe() {
          const current = subscribers.get(interactionToken);
          current?.delete(id);
          if (current?.size === 0) subscribers.delete(interactionToken);
        },
      });
    });
  }

  return Object.freeze({ paths, append, replay, latest, resume, recover, subscribe });
}

function copyStageIds(value: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) {
    throw invalid(
      "options.consequentialStageIds",
      "consequentialStageIds must be an array",
    );
  }
  const unique = new Set<string>();
  for (const [index, stageId] of value.entries()) {
    requireString(
      stageId,
      `options.consequentialStageIds[${index}]`,
      "INVALID_PROGRESS_JOURNAL_VALUE",
    );
    unique.add(stageId);
  }
  return Object.freeze([...unique].sort(compareUtf8));
}

function copyCursor(value: number | undefined): number {
  if (value === undefined) return -1;
  if (!Number.isSafeInteger(value) || value < -1) {
    throw invalid(
      "options.afterSequence",
      "afterSequence must be a safe integer greater than or equal to -1",
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function identityTuple(
  identity: MediaInteractionProgressInteractionIdentity,
): readonly unknown[] {
  return Object.freeze([
    "media-interaction-progress-journal-key/v1",
    identity.executionId,
    identity.attemptId ?? null,
    identity.programDigest,
    identity.interactionId,
    identity.contractDigest,
  ]);
}

function token(identity: MediaInteractionProgressInteractionIdentity): string {
  return JSON.stringify(identityTuple(identity));
}

function sameIdentity(
  left: MediaInteractionProgressInteractionIdentity,
  right: MediaInteractionProgressInteractionIdentity,
): boolean {
  return left.executionId === right.executionId &&
    left.attemptId === right.attemptId &&
    left.programDigest === right.programDigest &&
    left.interactionId === right.interactionId &&
    left.contractDigest === right.contractDigest;
}

function copyIdentity(
  value: unknown,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode =
    "INVALID_PROGRESS_JOURNAL_VALUE",
): MediaInteractionProgressInteractionIdentity {
  const identity = requireObject(value, path, code);
  if (Object.hasOwn(identity, "operationId")) {
    throw journalError("LEGACY_EXECUTION_IDENTITY", path,
      "Historical execution requires fresh Boundary bindings and approvals");
  }
  const executionId = requireString(identity.executionId, `${path}.executionId`, code);
  const attemptId = identity.attemptId === undefined
    ? undefined
    : requireString(identity.attemptId, `${path}.attemptId`, code);
  const programDigest = requireString(
    identity.programDigest,
    `${path}.programDigest`,
    code,
  );
  const interactionId = requireString(
    identity.interactionId,
    `${path}.interactionId`,
    code,
  ) as MediaInteractionId;
  const contractDigest = requireString(
    identity.contractDigest,
    `${path}.contractDigest`,
    code,
  );
  return Object.freeze({
    executionId,
    ...(attemptId === undefined ? {} : { attemptId }),
    programDigest,
    interactionId,
    contractDigest,
  });
}

function copyRecord(
  value: unknown,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode,
): MediaInteractionProgressRecord {
  const raw = requireObject(value, path, code);
  if (raw.schemaVersion === 0 && raw.kind === "media-operation-progress") {
    throw journalError("LEGACY_EXECUTION_IDENTITY", path,
      "Historical progress requires reconciliation and fresh execution identity");
  }
  if (raw.schemaVersion !== 1) {
    throw journalError(code, `${path}.schemaVersion`, "schemaVersion must be 1");
  }
  if (raw.kind !== "media-interaction-progress") {
    throw journalError(
      code,
      `${path}.kind`,
      "kind must be media-interaction-progress",
    );
  }
  const interaction = copyIdentity(raw.interaction, `${path}.interaction`, code);
  const sequence = requireCount(raw.sequence, `${path}.sequence`, code);
  const elapsedMs = requireElapsed(raw.elapsedMs, `${path}.elapsedMs`, code);
  const subject = copySubject(raw.subject, `${path}.subject`, code);
  const work = raw.work === undefined
    ? undefined
    : copyWork(raw.work, `${path}.work`, code);
  const state = raw.state;
  if (typeof state !== "string" || !PROGRESS_STATES.has(state as MediaInteractionProgressState)) {
    throw journalError(code, `${path}.state`, "state is not a supported progress state");
  }
  const base = {
    schemaVersion: 1 as const,
    kind: "media-interaction-progress" as const,
    interaction,
    sequence,
    elapsedMs,
    subject,
    ...(work === undefined ? {} : { work }),
  };
  if (state === "failed") {
    return Object.freeze({
      ...base,
      state,
      error: copyFailure(raw.error, `${path}.error`, code),
    });
  }
  if (state === "cancelled") {
    const reason = raw.reason === undefined
      ? undefined
      : requireString(raw.reason, `${path}.reason`, code);
    return Object.freeze({
      ...base,
      state,
      ...(reason === undefined ? {} : { reason }),
    });
  }
  if (state === "uncertain") {
    return Object.freeze({
      ...base,
      state,
      reason: requireString(raw.reason, `${path}.reason`, code),
    });
  }
  if (state === "started" || state === "running" || state === "succeeded") {
    return Object.freeze({ ...base, state });
  }
  throw journalError(code, `${path}.state`, "state is not a supported progress state");
}

function copySubject(
  value: unknown,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode,
): MediaInteractionProgressSubject {
  const subject = requireObject(value, path, code);
  if (subject.kind === "interaction") {
    return Object.freeze({ kind: "interaction" });
  }
  if (subject.kind !== "stage" && subject.kind !== "item") {
    throw journalError(code, `${path}.kind`, "subject kind is not supported");
  }
  const stageId = requireString(subject.stageId, `${path}.stageId`, code);
  if (subject.kind === "stage") return Object.freeze({ kind: "stage", stageId });
  return Object.freeze({
    kind: "item",
    stageId,
    item: copyItem(subject.item, `${path}.item`, code),
  });
}

function copyItem(
  value: unknown,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode,
): MediaInteractionProgressItem {
  const item = requireObject(value, path, code);
  const itemId = requireString(item.itemId, `${path}.itemId`, code);
  const kind = item.kind === undefined
    ? undefined
    : requireString(item.kind, `${path}.kind`, code);
  if (kind !== undefined && !ITEM_KINDS.has(kind)) {
    throw journalError(code, `${path}.kind`, "item kind is not supported");
  }
  const optional = (name: string): string | undefined =>
    item[name] === undefined
      ? undefined
      : requireString(item[name], `${path}.${name}`, code);
  const sourceId = optional("sourceId");
  const entryId = optional("entryId");
  const variantId = optional("variantId");
  const editionId = optional("editionId");
  const renditionId = optional("renditionId");
  return Object.freeze({
    itemId,
    ...(kind === undefined
      ? {}
      : { kind: kind as NonNullable<MediaInteractionProgressItem["kind"]> }),
    ...(sourceId === undefined ? {} : { sourceId }),
    ...(entryId === undefined ? {} : { entryId }),
    ...(variantId === undefined ? {} : { variantId }),
    ...(editionId === undefined ? {} : { editionId }),
    ...(renditionId === undefined ? {} : { renditionId }),
  });
}

function copyWork(
  value: unknown,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode,
): MediaInteractionProgressWork {
  const work = requireObject(value, path, code);
  const unit = work.unit;
  if (typeof unit !== "string" || !PROGRESS_UNITS.has(unit as MediaInteractionProgressUnit)) {
    throw journalError(code, `${path}.unit`, "work unit is not supported");
  }
  const completed = requireCount(work.completed, `${path}.completed`, code);
  const total = work.total === undefined
    ? undefined
    : requireCount(work.total, `${path}.total`, code);
  if (total !== undefined && completed > total) {
    throw journalError(code, `${path}.completed`, "completed work exceeds total work");
  }
  return Object.freeze({
    unit: unit as MediaInteractionProgressUnit,
    completed,
    ...(total === undefined ? {} : { total }),
  });
}

function copyFailure(
  value: unknown,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode,
): MediaInteractionProgressFailure {
  const failure = requireObject(value, path, code);
  return Object.freeze({
    code: requireString(failure.code, `${path}.code`, code),
    path: requireString(failure.path, `${path}.path`, code),
    message: requireString(failure.message, `${path}.message`, code),
  });
}

function analyzeRecords(
  records: readonly MediaInteractionProgressRecord[],
  key: MediaInteractionProgressInteractionIdentity,
  code: NodeMediaInteractionProgressJournalErrorCode,
): JournalAnalysis {
  let previousElapsedMs = 0;
  let interaction: MutableSubjectState | undefined;
  const stages = new Map<string, MutableSubjectState>();
  const items = new Map<string, MutableSubjectState>();

  for (const [index, record] of records.entries()) {
    if (!sameIdentity(record.interaction, key)) {
      throw journalError(
        "PROGRESS_JOURNAL_IDENTITY_MISMATCH",
        `events[${index}].interaction`,
        "progress record identity does not match its journal key",
      );
    }
    if (record.sequence !== index) {
      throw journalError(
        "PROGRESS_JOURNAL_NONCONTIGUOUS",
        `events[${index}].sequence`,
        `expected sequence ${index}, received ${record.sequence}`,
      );
    }
    if (index > 0 && record.elapsedMs < previousElapsedMs) {
      throw journalError(
        code,
        `events[${index}].elapsedMs`,
        "elapsedMs cannot decrease",
      );
    }
    previousElapsedMs = record.elapsedMs;

    let slot: MutableSubjectState | undefined;
    if (record.subject.kind === "interaction") {
      slot = interaction;
    } else {
      if (interaction === undefined || TERMINAL_STATES.has(interaction.state)) {
        throw journalError(
          code,
          `events[${index}].subject`,
          "stage and item progress requires a running interaction",
        );
      }
      if (record.subject.kind === "stage") {
        slot = stages.get(record.subject.stageId);
      } else {
        const stage = stages.get(record.subject.stageId);
        if (stage === undefined || TERMINAL_STATES.has(stage.state)) {
          throw journalError(
            code,
            `events[${index}].subject.stageId`,
            "item progress requires a running stage",
          );
        }
        slot = items.get(itemToken(record.subject));
      }
    }

    assertTransition(slot?.state, record.state, `events[${index}].state`, code);
    if (slot !== undefined && tokenSubject(slot.subject) !== tokenSubject(record.subject)) {
      throw journalError(
        "PROGRESS_JOURNAL_IDENTITY_MISMATCH",
        `events[${index}].subject`,
        "a progress subject changed identity",
      );
    }
    if (record.work !== undefined) {
      const previous = slot?.work.get(record.work.unit);
      if (previous !== undefined && record.work.completed < previous.completed) {
        throw journalError(
          code,
          `events[${index}].work.completed`,
          "completed work cannot decrease",
        );
      }
      if (
        previous?.total !== undefined &&
        record.work.total !== undefined &&
        previous.total !== record.work.total
      ) {
        throw journalError(
          code,
          `events[${index}].work.total`,
          "known total work cannot change",
        );
      }
    }
    assertNoOpenDescendants(record, stages, items, index, code);

    const next: MutableSubjectState = slot ?? {
      subject: record.subject,
      state: record.state,
      work: new Map(),
    };
    next.state = record.state;
    if (record.work !== undefined) next.work.set(record.work.unit, record.work);
    if (record.subject.kind === "interaction") interaction = next;
    else if (record.subject.kind === "stage") {
      stages.set(record.subject.stageId, next);
    } else {
      items.set(itemToken(record.subject), next);
    }
  }

  if (interaction === undefined) {
    throw journalError(code, "events", "journal is missing interaction progress");
  }
  return Object.freeze({
    interactionState: interaction.state,
    openStageIds: Object.freeze(
      [...stages.entries()]
        .filter(([, stage]) => !TERMINAL_STATES.has(stage.state))
        .map(([stageId]) => stageId)
        .sort(compareUtf8),
    ),
    stageStates: new Map(
      [...stages.entries()].map(([stageId, stage]) => [stageId, stage.state]),
    ),
  });
}

function assertTransition(
  previous: MediaInteractionProgressState | undefined,
  next: MediaInteractionProgressState,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode,
): void {
  if (previous === undefined && next === "started") return;
  if (
    previous !== undefined &&
    !TERMINAL_STATES.has(previous) &&
    (next === "running" || TERMINAL_STATES.has(next))
  ) {
    return;
  }
  throw journalError(
    code,
    path,
    `cannot transition from ${previous ?? "unreported"} to ${next}`,
  );
}

function assertNoOpenDescendants(
  record: MediaInteractionProgressRecord,
  stages: ReadonlyMap<string, MutableSubjectState>,
  items: ReadonlyMap<string, MutableSubjectState>,
  index: number,
  code: NodeMediaInteractionProgressJournalErrorCode,
): void {
  if (!TERMINAL_STATES.has(record.state) || record.subject.kind === "item") return;
  if (record.subject.kind === "stage") {
    for (const item of items.values()) {
      if (
        item.subject.kind === "item" &&
        item.subject.stageId === record.subject.stageId &&
        !TERMINAL_STATES.has(item.state)
      ) {
        throw journalError(
          code,
          `events[${index}].state`,
          "stage cannot terminate while an item remains open",
        );
      }
    }
    return;
  }
  if (
    [...stages.values(), ...items.values()]
      .some((subject) => !TERMINAL_STATES.has(subject.state))
  ) {
    throw journalError(
      code,
      `events[${index}].state`,
      "interaction cannot terminate while a descendant remains open",
    );
  }
}

function itemToken(subject: Extract<MediaInteractionProgressSubject, { kind: "item" }>): string {
  return JSON.stringify([subject.stageId, subject.item.itemId]);
}

function tokenSubject(subject: MediaInteractionProgressSubject): string {
  return JSON.stringify(subject);
}

async function loadAuthority(
  paths: MediaInteractionProgressJournalPaths,
  key: MediaInteractionProgressInteractionIdentity,
): Promise<JournalAuthority> {
  const records = await readCommittedRecords(paths, key);
  if (records.length === 0) return Object.freeze({ records });
  return Object.freeze({
    records,
    analysis: analyzeRecords(records, key, "PROGRESS_JOURNAL_CORRUPT"),
  });
}

async function readCommittedRecords(
  paths: MediaInteractionProgressJournalPaths,
  key: MediaInteractionProgressInteractionIdentity,
): Promise<readonly MediaInteractionProgressRecord[]> {
  let bytes: Buffer;
  try {
    await assertRegularFile(paths.events);
    bytes = await readFile(paths.events);
  } catch (cause) {
    if (isNodeError(cause, "ENOENT")) return Object.freeze([]);
    throw cause;
  }
  const committedEnd = bytes.length === 0 || bytes[bytes.length - 1] === 0x0a
    ? bytes.length
    : bytes.lastIndexOf(0x0a) + 1;
  if (committedEnd < bytes.length) {
    await truncate(paths.events, committedEnd);
    const handle = await open(paths.events, constants.O_RDWR);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    bytes = bytes.subarray(0, committedEnd);
  }
  if (bytes.length === 0) return Object.freeze([]);

  let text: string;
  try {
    text = utf8.decode(bytes);
  } catch {
    throw new NodeMediaInteractionProgressJournalError(
      "PROGRESS_JOURNAL_CORRUPT",
      paths.events,
      "committed journal bytes are not valid UTF-8",
    );
  }
  const lines = text.slice(0, -1).split("\n");
  const records: MediaInteractionProgressRecord[] = [];
  for (const [index, line] of lines.entries()) {
    if (line.length === 0) {
      throw new NodeMediaInteractionProgressJournalError(
        "PROGRESS_JOURNAL_CORRUPT",
        `${paths.events}:${index + 1}`,
        "committed journal line is empty",
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new NodeMediaInteractionProgressJournalError(
        "PROGRESS_JOURNAL_CORRUPT",
        `${paths.events}:${index + 1}`,
        "committed journal line is not valid JSON",
      );
    }
    records.push(copyRecord(
      value,
      `${paths.events}:${index + 1}`,
      "PROGRESS_JOURNAL_CORRUPT",
    ));
  }
  const frozen = Object.freeze(records);
  analyzeRecords(frozen, key, "PROGRESS_JOURNAL_CORRUPT");
  return frozen;
}

function buildLiveStatus(
  records: readonly MediaInteractionProgressRecord[],
  analysis: JournalAnalysis,
): MediaInteractionProgressJournalStatus {
  return buildStatus(records, analysis, Object.freeze({ classification: "live" }));
}

function buildRecoveryStatus(
  records: readonly MediaInteractionProgressRecord[],
  analysis: JournalAnalysis,
  consequentialStages: ReadonlySet<string>,
): MediaInteractionProgressJournalStatus {
  if (TERMINAL_STATES.has(analysis.interactionState)) {
    return buildStatus(
      records,
      analysis,
      Object.freeze({ classification: "terminal" }),
    );
  }
  const interruptedConsequential = [...analysis.stageStates.entries()]
    .filter(([stageId, state]) =>
      consequentialStages.has(stageId) &&
      (state === "started" ||
        state === "running" ||
        state === "succeeded" ||
        state === "uncertain")
    )
    .map(([stageId]) => stageId)
    .sort(compareUtf8);
  if (interruptedConsequential.length > 0) {
    const stageIds = Object.freeze([...interruptedConsequential]);
    return buildStatus(
      records,
      analysis,
      Object.freeze({
        classification: "uncertain",
        reason: `process interruption left consequential stage(s) open (${stageIds.join(", ")}); reconcile reality before starting another attempt`,
        consequentialStageIds: stageIds,
      }),
    );
  }
  return buildStatus(
    records,
    analysis,
    Object.freeze({
      classification: "resumable",
      reason: "process interruption occurred outside an open consequential stage; resume from the last durable cursor",
    }),
  );
}

function buildStatus(
  records: readonly MediaInteractionProgressRecord[],
  analysis: JournalAnalysis,
  recovery: MediaInteractionProgressRecovery,
): MediaInteractionProgressJournalStatus {
  const latest = records[records.length - 1]!;
  const recoveredUncertain = recovery.classification === "uncertain";
  const state = recoveredUncertain
    ? "uncertain"
    : analysis.interactionState === "started"
    ? "running"
    : analysis.interactionState;
  return Object.freeze({
    schemaVersion: 1,
    kind: "media-interaction-progress-status",
    interaction: latest.interaction,
    state,
    terminal: recoveredUncertain || TERMINAL_STATES.has(analysis.interactionState),
    sequence: latest.sequence,
    elapsedMs: latest.elapsedMs,
    latest,
    openStageIds: analysis.openStageIds,
    recovery,
  });
}

async function readCurrentSnapshot(
  paths: MediaInteractionProgressJournalPaths,
  authority: JournalAuthority & Readonly<{ analysis: JournalAnalysis }>,
  consequentialStages: ReadonlySet<string>,
): Promise<MediaInteractionProgressJournalStatus | undefined> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(paths.latest, "utf8"));
  } catch (cause) {
    if (isNodeError(cause, "ENOENT") || cause instanceof SyntaxError) return undefined;
    throw cause;
  }
  let parsed: MediaInteractionProgressJournalStatus;
  try {
    parsed = copyStatus(value, paths.latest);
  } catch {
    return undefined;
  }
  const live = buildLiveStatus(authority.records, authority.analysis);
  const recovered = buildRecoveryStatus(
    authority.records,
    authority.analysis,
    consequentialStages,
  );
  if (sameJson(parsed, live) || sameJson(parsed, recovered)) return parsed;
  return undefined;
}

function copyStatus(
  value: unknown,
  path: string,
): MediaInteractionProgressJournalStatus {
  const status = requireObject(value, path, "PROGRESS_JOURNAL_CORRUPT");
  if (status.schemaVersion !== 1 || status.kind !== "media-interaction-progress-status") {
    throw journalError(
      "PROGRESS_JOURNAL_CORRUPT",
      path,
      "latest status has an unsupported schema",
    );
  }
  const interaction = copyIdentity(
    status.interaction,
    `${path}.interaction`,
    "PROGRESS_JOURNAL_CORRUPT",
  );
  const state = status.state;
  if (
    typeof state !== "string" ||
    state === "started" ||
    !PROGRESS_STATES.has(state as MediaInteractionProgressState)
  ) {
    throw journalError(
      "PROGRESS_JOURNAL_CORRUPT",
      `${path}.state`,
      "latest status state is invalid",
    );
  }
  if (typeof status.terminal !== "boolean") {
    throw journalError(
      "PROGRESS_JOURNAL_CORRUPT",
      `${path}.terminal`,
      "latest terminal must be boolean",
    );
  }
  const openStageIds = copyStringArray(
    status.openStageIds,
    `${path}.openStageIds`,
    "PROGRESS_JOURNAL_CORRUPT",
  );
  return Object.freeze({
    schemaVersion: 1,
    kind: "media-interaction-progress-status",
    interaction,
    state: state as MediaInteractionProgressJournalStatus["state"],
    terminal: status.terminal,
    sequence: requireCount(
      status.sequence,
      `${path}.sequence`,
      "PROGRESS_JOURNAL_CORRUPT",
    ),
    elapsedMs: requireElapsed(
      status.elapsedMs,
      `${path}.elapsedMs`,
      "PROGRESS_JOURNAL_CORRUPT",
    ),
    latest: copyRecord(
      status.latest,
      `${path}.latest`,
      "PROGRESS_JOURNAL_CORRUPT",
    ),
    openStageIds,
    recovery: copyRecovery(status.recovery, `${path}.recovery`),
  });
}

function copyRecovery(value: unknown, path: string): MediaInteractionProgressRecovery {
  const recovery = requireObject(value, path, "PROGRESS_JOURNAL_CORRUPT");
  if (recovery.classification === "live" || recovery.classification === "terminal") {
    return Object.freeze({ classification: recovery.classification });
  }
  if (recovery.classification === "resumable") {
    return Object.freeze({
      classification: "resumable",
      reason: requireString(
        recovery.reason,
        `${path}.reason`,
        "PROGRESS_JOURNAL_CORRUPT",
      ),
    });
  }
  if (recovery.classification === "uncertain") {
    return Object.freeze({
      classification: "uncertain",
      reason: requireString(
        recovery.reason,
        `${path}.reason`,
        "PROGRESS_JOURNAL_CORRUPT",
      ),
      consequentialStageIds: copyStringArray(
        recovery.consequentialStageIds,
        `${path}.consequentialStageIds`,
        "PROGRESS_JOURNAL_CORRUPT",
      ),
    });
  }
  throw journalError(
    "PROGRESS_JOURNAL_CORRUPT",
    `${path}.classification`,
    "latest recovery classification is invalid",
  );
}

async function appendDurably(
  paths: MediaInteractionProgressJournalPaths,
  record: MediaInteractionProgressRecord,
): Promise<void> {
  await mkdir(paths.directory, { recursive: true });
  await assertRegularFile(paths.events);
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const handle = await open(
    paths.events,
    constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | noFollow,
    0o600,
  );
  try {
    await handle.appendFile(`${JSON.stringify(record)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(paths.directory);
}

async function writeStatusAtomically(
  paths: MediaInteractionProgressJournalPaths,
  status: MediaInteractionProgressJournalStatus,
): Promise<void> {
  await mkdir(paths.directory, { recursive: true });
  const temporary = join(
    paths.directory,
    `.latest-${process.pid}-${randomUUID()}.tmp`,
  );
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(status)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, paths.latest);
    await syncDirectory(paths.directory);
  } catch (cause) {
    await unlink(temporary).catch(() => undefined);
    throw cause;
  }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function enqueue(
  subscriber: Subscriber,
  record: MediaInteractionProgressRecord,
): Promise<void> {
  const delivery = subscriber.tail.then(() => subscriber.observer.append(record));
  subscriber.tail = delivery.then(() => undefined, () => undefined);
  return delivery.then(() => undefined);
}

function copyStringArray(
  value: unknown,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode,
): readonly string[] {
  if (!Array.isArray(value)) {
    throw journalError(code, path, `${path} must be an array`);
  }
  return Object.freeze(
    value.map((item, index) => requireString(item, `${path}[${index}]`, code)),
  );
}

function assertCursorAtTail(
  afterSequence: number,
  records: readonly MediaInteractionProgressRecord[],
): void {
  const durableTail = records.at(-1)?.sequence ?? -1;
  if (afterSequence > durableTail) {
    throw invalid(
      "options.afterSequence",
      `afterSequence ${afterSequence} is ahead of durable tail ${durableTail}`,
    );
  }
}

async function assertRegularFile(path: string): Promise<void> {
  try {
    const entry = await lstat(path);
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new NodeMediaInteractionProgressJournalError(
        "PROGRESS_JOURNAL_CORRUPT",
        path,
        "journal authority must be a regular file, not a link or special entry",
      );
    }
  } catch (cause) {
    if (isNodeError(cause, "ENOENT")) return;
    throw cause;
  }
}

function requireObject(
  value: unknown,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw journalError(code, path, `${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(
  value: unknown,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw journalError(code, path, `${path} must be a non-empty string`);
  }
  return value;
}

function requireCount(
  value: unknown,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode,
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw journalError(code, path, `${path} must be a non-negative safe integer`);
  }
  return value;
}

function requireElapsed(
  value: unknown,
  path: string,
  code: NodeMediaInteractionProgressJournalErrorCode,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw journalError(code, path, `${path} must be finite and non-negative`);
  }
  return value;
}

function invalid(path: string, message: string): NodeMediaInteractionProgressJournalError {
  return new NodeMediaInteractionProgressJournalError(
    "INVALID_PROGRESS_JOURNAL_VALUE",
    path,
    message,
  );
}

function journalError(
  code: NodeMediaInteractionProgressJournalErrorCode,
  path: string,
  message: string,
): NodeMediaInteractionProgressJournalError {
  return new NodeMediaInteractionProgressJournalError(code, path, message);
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isNodeError(cause: unknown, code: string): cause is NodeJS.ErrnoException {
  return cause instanceof Error && (cause as NodeJS.ErrnoException).code === code;
}
