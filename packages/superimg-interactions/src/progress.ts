import type { MediaInteractionId } from "./contracts.js";

export type MediaInteractionProgressUnit =
  | "items"
  | "renditions"
  | "frames"
  | "bytes";

export type MediaInteractionProgressState =
  | "started"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "uncertain";

export type MediaInteractionProgressItem = Readonly<{
  itemId: string;
  kind?: "source" | "entry" | "rendition" | "artifact";
  sourceId?: string;
  entryId?: string;
  variantId?: string;
  editionId?: string;
  renditionId?: string;
}>;

export type MediaInteractionProgressSubject =
  | Readonly<{ kind: "interaction" }>
  | Readonly<{ kind: "stage"; stageId: string }>
  | Readonly<{
      kind: "item";
      stageId: string;
      item: MediaInteractionProgressItem;
    }>;

export type MediaInteractionProgressWork = Readonly<{
  unit: MediaInteractionProgressUnit;
  completed: number;
  /** Omitted until the producer genuinely knows the total. */
  total?: number;
}>;

export type MediaInteractionProgressFailure = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type MediaInteractionProgressInteractionIdentity = Readonly<{
  executionId: string;
  attemptId?: string;
  programDigest: string;
  interactionId: MediaInteractionId;
  contractDigest: string;
}>;

type MediaInteractionProgressRecordBase = Readonly<{
  schemaVersion: 1;
  kind: "media-interaction-progress";
  interaction: MediaInteractionProgressInteractionIdentity;
  sequence: number;
  elapsedMs: number;
  subject: MediaInteractionProgressSubject;
  work?: MediaInteractionProgressWork;
}>;

export type MediaInteractionProgressRecord = MediaInteractionProgressRecordBase &
  (
    | Readonly<{ state: "started" | "running" | "succeeded" }>
    | Readonly<{
        state: "failed";
        error: MediaInteractionProgressFailure;
      }>
    | Readonly<{
        state: "cancelled";
        reason?: string;
      }>
    | Readonly<{
        state: "uncertain";
        reason: string;
      }>
  );

type MediaInteractionProgressUpdateBase = Readonly<{
  subject: MediaInteractionProgressSubject;
  work?: MediaInteractionProgressWork;
}>;

export type MediaInteractionProgressUpdate = MediaInteractionProgressUpdateBase &
  (
    | Readonly<{ state: "started" | "running" | "succeeded" }>
    | Readonly<{
        state: "failed";
        error: MediaInteractionProgressFailure;
      }>
    | Readonly<{
        state: "cancelled";
        reason?: string;
      }>
    | Readonly<{
        state: "uncertain";
        reason: string;
      }>
  );

export interface MediaInteractionProgressObserver {
  append(
    record: MediaInteractionProgressRecord,
  ): void | Promise<void>;
}

export type MediaInteractionProgressOptions = Readonly<{
  executionId: string;
  attemptId?: string;
  observer: MediaInteractionProgressObserver;
  /** Last committed position. The next record uses `sequence + 1`. */
  resume?: Readonly<{
    sequence: number;
    elapsedMs: number;
  }>;
}>;

export interface MediaInteractionProgressReporter {
  report(
    update: MediaInteractionProgressUpdate,
  ): Promise<MediaInteractionProgressRecord>;
}

export type MediaInteractionProgressErrorCode =
  | "INVALID_PROGRESS_VALUE"
  | "INVALID_PROGRESS_TRANSITION"
  | "PROGRESS_AFTER_TERMINAL"
  | "PROGRESS_IDENTITY_MISMATCH"
  | "PROGRESS_NON_MONOTONIC"
  | "PROGRESS_TOTAL_CHANGED";

export class MediaInteractionProgressError extends Error {
  readonly code: MediaInteractionProgressErrorCode;
  readonly path: string;

  constructor(
    code: MediaInteractionProgressErrorCode,
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "MediaInteractionProgressError";
    this.code = code;
    this.path = path;
  }
}

type ProgressTarget = Readonly<{
  programDigest: string;
  interactionId: MediaInteractionId;
  contractDigest: string;
}>;

type SubjectLifecycle = Readonly<{
  subject: MediaInteractionProgressSubject;
  state: MediaInteractionProgressState;
}>;

type WorkCheckpoint = Readonly<{
  completed: number;
  total?: number;
}>;

type PreparedWork = Readonly<{
  unit: MediaInteractionProgressUnit;
  checkpoint: WorkCheckpoint;
  record: MediaInteractionProgressWork;
}>;

type SubjectSlot = {
  lifecycle?: SubjectLifecycle;
  readonly work: Map<MediaInteractionProgressUnit, WorkCheckpoint>;
};

const TERMINAL_STATES = new Set<MediaInteractionProgressState>([
  "succeeded",
  "failed",
  "cancelled",
  "uncertain",
]);

function requireNonEmptyString(value: string, path: string): void {
  if (value.length === 0) {
    throw new MediaInteractionProgressError(
      "INVALID_PROGRESS_VALUE",
      path,
      `${path} must not be empty`,
    );
  }
}

function requireCount(value: number, path: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MediaInteractionProgressError(
      "INVALID_PROGRESS_VALUE",
      path,
      `${path} must be a non-negative safe integer`,
    );
  }
}

function copyItem(item: MediaInteractionProgressItem): MediaInteractionProgressItem {
  requireNonEmptyString(item.itemId, "update.subject.item.itemId");
  for (const [name, value] of Object.entries(item)) {
    if (value !== undefined && typeof value !== "string") {
      throw new MediaInteractionProgressError(
        "INVALID_PROGRESS_VALUE",
        `update.subject.item.${name}`,
        `update.subject.item.${name} must be a string`,
      );
    }
  }
  return Object.freeze({
    itemId: item.itemId,
    ...(item.kind === undefined ? {} : { kind: item.kind }),
    ...(item.sourceId === undefined ? {} : { sourceId: item.sourceId }),
    ...(item.entryId === undefined ? {} : { entryId: item.entryId }),
    ...(item.variantId === undefined ? {} : { variantId: item.variantId }),
    ...(item.editionId === undefined ? {} : { editionId: item.editionId }),
    ...(item.renditionId === undefined ? {} : { renditionId: item.renditionId }),
  });
}

function copySubject(
  subject: MediaInteractionProgressSubject,
): MediaInteractionProgressSubject {
  if (subject.kind === "interaction") {
    return Object.freeze({ kind: "interaction" });
  }
  requireNonEmptyString(subject.stageId, "update.subject.stageId");
  if (subject.kind === "stage") {
    return Object.freeze({ kind: "stage", stageId: subject.stageId });
  }
  return Object.freeze({
    kind: "item",
    stageId: subject.stageId,
    item: copyItem(subject.item),
  });
}

function sameSubject(
  left: MediaInteractionProgressSubject,
  right: MediaInteractionProgressSubject,
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "interaction" || right.kind === "interaction") return true;
  if (left.stageId !== right.stageId) return false;
  if (left.kind === "stage" || right.kind === "stage") return true;
  return left.item.itemId === right.item.itemId &&
    left.item.kind === right.item.kind &&
    left.item.sourceId === right.item.sourceId &&
    left.item.entryId === right.item.entryId &&
    left.item.variantId === right.item.variantId &&
    left.item.editionId === right.item.editionId &&
    left.item.renditionId === right.item.renditionId;
}

function copyFailure(
  failure: MediaInteractionProgressFailure,
): MediaInteractionProgressFailure {
  requireNonEmptyString(failure.code, "update.error.code");
  requireNonEmptyString(failure.path, "update.error.path");
  requireNonEmptyString(failure.message, "update.error.message");
  return Object.freeze({
    code: failure.code,
    path: failure.path,
    message: failure.message,
  });
}

function assertTransition(
  previous: MediaInteractionProgressState | undefined,
  next: MediaInteractionProgressState,
  path: string,
): void {
  if (previous === undefined) {
    if (next === "started") return;
  } else if (!TERMINAL_STATES.has(previous)) {
    if (next === "running" || TERMINAL_STATES.has(next)) return;
  }
  throw new MediaInteractionProgressError(
    TERMINAL_STATES.has(previous ?? "running")
      ? "PROGRESS_AFTER_TERMINAL"
      : "INVALID_PROGRESS_TRANSITION",
    path,
    `cannot transition progress from ${previous ?? "unreported"} to ${next}`,
  );
}

/**
 * Creates one ordered interaction reporter. Its records are portable values; the
 * observer is a host-local adapter and is never part of a Program contract.
 */
export function createMediaInteractionProgressReporter(
  options: MediaInteractionProgressOptions,
  target: ProgressTarget,
): MediaInteractionProgressReporter {
  requireNonEmptyString(options.executionId, "options.executionId");
  if (options.attemptId !== undefined) {
    requireNonEmptyString(options.attemptId, "options.attemptId");
  }
  requireNonEmptyString(target.programDigest, "target.programDigest");
  requireNonEmptyString(target.interactionId, "target.interactionId");
  requireNonEmptyString(target.contractDigest, "target.contractDigest");
  if (options.resume !== undefined) {
    requireCount(options.resume.sequence, "options.resume.sequence");
    if (!Number.isFinite(options.resume.elapsedMs) || options.resume.elapsedMs < 0) {
      throw new MediaInteractionProgressError(
        "INVALID_PROGRESS_VALUE",
        "options.resume.elapsedMs",
        "options.resume.elapsedMs must be finite and non-negative",
      );
    }
  }

  const interaction = Object.freeze({
    executionId: options.executionId,
    ...(options.attemptId === undefined ? {} : { attemptId: options.attemptId }),
    programDigest: target.programDigest,
    interactionId: target.interactionId,
    contractDigest: target.contractDigest,
  });
  const interactionSlot: SubjectSlot = { work: new Map() };
  const stageSlots = new Map<string, SubjectSlot>();
  const itemSlots = new Map<string, Map<string, SubjectSlot>>();
  if (options.resume !== undefined) {
    interactionSlot.lifecycle = {
      subject: Object.freeze({ kind: "interaction" }),
      state: "running",
    };
  }
  let sequence = options.resume?.sequence ?? -1;
  let elapsedMs = options.resume?.elapsedMs ?? 0;
  const startedAt = performance.now();
  let appendTail: Promise<void> = Promise.resolve();

  function findSlot(
    subject: MediaInteractionProgressSubject,
  ): SubjectSlot | undefined {
    if (subject.kind === "interaction") return interactionSlot;
    if (subject.kind === "stage") return stageSlots.get(subject.stageId);
    return itemSlots.get(subject.stageId)?.get(subject.item.itemId);
  }

  function ensureSlot(subject: MediaInteractionProgressSubject): SubjectSlot {
    if (subject.kind === "interaction") return interactionSlot;
    if (subject.kind === "stage") {
      const existing = stageSlots.get(subject.stageId);
      if (existing) return existing;
      const created: SubjectSlot = { work: new Map() };
      stageSlots.set(subject.stageId, created);
      return created;
    }
    let stageItems = itemSlots.get(subject.stageId);
    if (!stageItems) {
      stageItems = new Map();
      itemSlots.set(subject.stageId, stageItems);
    }
    const existing = stageItems.get(subject.item.itemId);
    if (existing) return existing;
    const created: SubjectSlot = { work: new Map() };
    stageItems.set(subject.item.itemId, created);
    return created;
  }

  function prepareWork(
    slot: SubjectSlot | undefined,
    value: MediaInteractionProgressWork | undefined,
  ): PreparedWork | undefined {
    if (value === undefined) return undefined;
    requireCount(value.completed, "update.work.completed");
    if (value.total !== undefined) {
      requireCount(value.total, "update.work.total");
      if (value.completed > value.total) {
        throw new MediaInteractionProgressError(
          "INVALID_PROGRESS_VALUE",
          "update.work.completed",
          "completed work cannot exceed total work",
        );
      }
    }
    const previous = slot?.work.get(value.unit);
    if (previous && value.completed < previous.completed) {
      throw new MediaInteractionProgressError(
        "PROGRESS_NON_MONOTONIC",
        "update.work.completed",
        "completed work cannot decrease",
      );
    }
    if (
      previous?.total !== undefined &&
      value.total !== undefined &&
      value.total !== previous.total
    ) {
      throw new MediaInteractionProgressError(
        "PROGRESS_TOTAL_CHANGED",
        "update.work.total",
        "known total work cannot change",
      );
    }
    const total = previous?.total ?? value.total;
    if (total !== undefined && value.completed > total) {
      throw new MediaInteractionProgressError(
        "INVALID_PROGRESS_VALUE",
        "update.work.completed",
        "completed work cannot exceed the known total",
      );
    }
    const checkpoint = Object.freeze({
      completed: value.completed,
      ...(total === undefined ? {} : { total }),
    });
    return Object.freeze({
      unit: value.unit,
      checkpoint,
      record: Object.freeze({
        unit: value.unit,
        completed: value.completed,
        ...(total === undefined ? {} : { total }),
      }),
    });
  }

  function assertNoRunningDescendants(
    subject: MediaInteractionProgressSubject,
    state: MediaInteractionProgressState,
  ): void {
    if (!TERMINAL_STATES.has(state) || subject.kind === "item") return;
    if (subject.kind === "stage") {
      for (const slot of itemSlots.get(subject.stageId)?.values() ?? []) {
        if (slot.lifecycle && !TERMINAL_STATES.has(slot.lifecycle.state)) {
          throw new MediaInteractionProgressError(
            "INVALID_PROGRESS_TRANSITION",
            "update.state",
            "stage progress cannot terminate while descendant progress is running",
          );
        }
      }
      return;
    }
    for (const slot of stageSlots.values()) {
      if (slot.lifecycle && !TERMINAL_STATES.has(slot.lifecycle.state)) {
        throw new MediaInteractionProgressError(
          "INVALID_PROGRESS_TRANSITION",
          "update.state",
          "interaction progress cannot terminate while descendant progress is running",
        );
      }
    }
    for (const stageItems of itemSlots.values()) {
      for (const slot of stageItems.values()) {
        if (slot.lifecycle && !TERMINAL_STATES.has(slot.lifecycle.state)) {
          throw new MediaInteractionProgressError(
            "INVALID_PROGRESS_TRANSITION",
            "update.state",
            "interaction progress cannot terminate while descendant progress is running",
          );
        }
      }
    }
  }

  function assertKnownWorkComplete(
    slot: SubjectSlot | undefined,
    prepared: PreparedWork | undefined,
  ): void {
    const visited = new Set<MediaInteractionProgressUnit>();
    for (const [unit, stored] of slot?.work ?? []) {
      const checkpoint = prepared?.unit === unit
        ? prepared.checkpoint
        : stored;
      visited.add(unit);
      if (
        checkpoint.total !== undefined &&
        checkpoint.completed !== checkpoint.total
      ) {
        throw new MediaInteractionProgressError(
          "INVALID_PROGRESS_TRANSITION",
          "update.state",
          "known work must be complete before success",
        );
      }
    }
    if (
      prepared !== undefined &&
      !visited.has(prepared.unit) &&
      prepared.checkpoint.total !== undefined &&
      prepared.checkpoint.completed !== prepared.checkpoint.total
    ) {
      throw new MediaInteractionProgressError(
        "INVALID_PROGRESS_TRANSITION",
        "update.state",
        "known work must be complete before success",
      );
    }
  }

  function report(
    update: MediaInteractionProgressUpdate,
  ): Promise<MediaInteractionProgressRecord> {
    const subject = copySubject(update.subject);
    const interactionLifecycle = interactionSlot.lifecycle;
    if (
      subject.kind !== "interaction" &&
      (interactionLifecycle === undefined ||
        TERMINAL_STATES.has(interactionLifecycle.state))
    ) {
      throw new MediaInteractionProgressError(
        interactionLifecycle === undefined
          ? "INVALID_PROGRESS_TRANSITION"
          : "PROGRESS_AFTER_TERMINAL",
        "update.subject",
        "stage and item progress requires a running interaction",
      );
    }
    if (subject.kind === "item") {
      const stage = stageSlots.get(subject.stageId)?.lifecycle;
      if (stage === undefined || TERMINAL_STATES.has(stage.state)) {
        throw new MediaInteractionProgressError(
          stage === undefined
            ? "INVALID_PROGRESS_TRANSITION"
            : "PROGRESS_AFTER_TERMINAL",
          "update.subject.stageId",
          "item progress requires a running stage",
        );
      }
    }

    const existingSlot = findSlot(subject);
    const previous = existingSlot?.lifecycle;
    if (previous && !sameSubject(previous.subject, subject)) {
      throw new MediaInteractionProgressError(
        "PROGRESS_IDENTITY_MISMATCH",
        "update.subject",
        "a progress subject cannot change identity",
      );
    }
    assertTransition(previous?.state, update.state, "update.state");
    const preparedWork = prepareWork(existingSlot, update.work);

    let terminalDetail:
      | Readonly<{ kind: "failed"; error: MediaInteractionProgressFailure }>
      | Readonly<{ kind: "cancelled"; reason?: string }>
      | Readonly<{ kind: "uncertain"; reason: string }>
      | undefined;
    if (update.state === "failed") {
      terminalDetail = Object.freeze({
        kind: "failed",
        error: copyFailure(update.error),
      });
    } else if (update.state === "cancelled") {
      if (update.reason !== undefined) {
        requireNonEmptyString(update.reason, "update.reason");
      }
      terminalDetail = Object.freeze({
        kind: "cancelled",
        ...(update.reason === undefined ? {} : { reason: update.reason }),
      });
    } else if (update.state === "uncertain") {
      requireNonEmptyString(update.reason, "update.reason");
      terminalDetail = Object.freeze({
        kind: "uncertain",
        reason: update.reason,
      });
    }

    assertNoRunningDescendants(subject, update.state);
    if (update.state === "succeeded") {
      assertKnownWorkComplete(existingSlot, preparedWork);
    }

    const nextSequence = sequence + 1;
    const measuredElapsed = (options.resume?.elapsedMs ?? 0) +
      Math.max(0, performance.now() - startedAt);
    const nextElapsedMs = Math.max(elapsedMs, measuredElapsed);

    const base = {
      schemaVersion: 1 as const,
      kind: "media-interaction-progress" as const,
      interaction,
      sequence: nextSequence,
      elapsedMs: nextElapsedMs,
      subject,
      ...(preparedWork === undefined ? {} : { work: preparedWork.record }),
    };
    let record: MediaInteractionProgressRecord;
    if (terminalDetail?.kind === "failed") {
      record = Object.freeze({
        ...base,
        state: "failed",
        error: terminalDetail.error,
      });
    } else if (terminalDetail?.kind === "cancelled") {
      record = Object.freeze({
        ...base,
        state: "cancelled",
        ...(terminalDetail.reason === undefined
          ? {}
          : { reason: terminalDetail.reason }),
      });
    } else if (terminalDetail?.kind === "uncertain") {
      record = Object.freeze({
        ...base,
        state: "uncertain",
        reason: terminalDetail.reason,
      });
    } else if (
      update.state === "started" ||
      update.state === "running" ||
      update.state === "succeeded"
    ) {
      record = Object.freeze({ ...base, state: update.state });
    } else {
      throw new MediaInteractionProgressError(
        "INVALID_PROGRESS_VALUE",
        "update.state",
        "terminal progress is missing its required detail",
      );
    }

    const slot = ensureSlot(subject);
    if (preparedWork !== undefined) {
      slot.work.set(preparedWork.unit, preparedWork.checkpoint);
    }
    slot.lifecycle = Object.freeze({ subject, state: update.state });
    sequence = nextSequence;
    elapsedMs = nextElapsedMs;

    const appended = appendTail.then(() => options.observer.append(record));
    appendTail = appended.then(() => undefined, () => undefined);
    return appendTail.then(() => record);
  }

  return Object.freeze({ report });
}
