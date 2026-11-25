import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MEDIA_INTERACTION_IDS } from "../contracts.js";
import type {
  MediaInteractionProgressInteractionIdentity,
  MediaInteractionProgressRecord,
  MediaInteractionProgressSubject,
} from "../progress.js";
import {
  createNodeMediaInteractionProgressJournal,
  NodeMediaInteractionProgressJournalError,
} from "./progress-journal.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Node media interaction progress journal", () => {
  it("refuses legacy journal identities without changing their saved bytes", async () => {
    const root = await temporaryRoot();
    const journal = createNodeMediaInteractionProgressJournal({ directory: root });
    const legacy = { ...INTERACTION, operationId: INTERACTION.interactionId };
    const saved = join(root, "historical.jsonl");
    const bytes = JSON.stringify({ schemaVersion: 0, kind: "media-operation-progress", operation: legacy }) + "\n";
    await writeFile(saved, bytes);
    await expect(async () => journal.replay(legacy)).rejects.toMatchObject({ code: "LEGACY_EXECUTION_IDENTITY" });
    expect(await readFile(saved, "utf8")).toBe(bytes);
  });

  it("rejects historical progress bytes before recovery and leaves them intact", async () => {
    const root = await temporaryRoot();
    const journal = createNodeMediaInteractionProgressJournal({ directory: root });
    const paths = journal.paths(INTERACTION);
    const current = record(0, "started");
    const bytes = JSON.stringify({ ...current, schemaVersion: 0, kind: "media-operation-progress" }) + "\n";
    await mkdir(paths.directory, { recursive: true });
    await writeFile(paths.events, bytes);
    await expect(journal.recover(INTERACTION)).rejects.toMatchObject({ code: "LEGACY_EXECUTION_IDENTITY" });
    expect(await readFile(paths.events, "utf8")).toBe(bytes);
  });

  it("fsyncs raw JSONL beside an atomic latest-status snapshot", async () => {
    const root = await temporaryRoot();
    const journal = createNodeMediaInteractionProgressJournal({ directory: root });
    const started = record(0, "started");

    await journal.append(started);

    const paths = journal.paths(INTERACTION);
    expect(paths.directory.startsWith(root)).toBe(true);
    expect(basename(paths.events)).toBe("events.jsonl");
    expect(basename(paths.latest)).toBe("latest.json");
    expect((await readFile(paths.events, "utf8")).trimEnd()).toBe(
      JSON.stringify(started),
    );
    expect(JSON.parse(await readFile(paths.latest, "utf8"))).toMatchObject({
      schemaVersion: 1,
      kind: "media-interaction-progress-status",
      interaction: INTERACTION,
      state: "running",
      terminal: false,
      sequence: 0,
      elapsedMs: 0,
      latest: started,
      recovery: { classification: "live" },
    });
  });

  it("fans durable records out to multiple live observers", async () => {
    const root = await temporaryRoot();
    const journal = createNodeMediaInteractionProgressJournal({ directory: root });
    const first: number[] = [];
    const second: number[] = [];
    const firstSubscription = await journal.subscribe(INTERACTION, {
      append: (value) => { first.push(value.sequence); },
    });
    await journal.subscribe(INTERACTION, {
      append: (value) => { second.push(value.sequence); },
    });

    await journal.append(record(0, "started"));
    await journal.append(record(1, "running"));
    firstSubscription.unsubscribe();
    await journal.append(record(2, "running"));

    expect(first).toEqual([0, 1]);
    expect(second).toEqual([0, 1, 2]);
  });

  it("replays from a cursor and connects to live delivery without a gap", async () => {
    const root = await temporaryRoot();
    const firstProcess = createNodeMediaInteractionProgressJournal({ directory: root });
    await firstProcess.append(record(0, "started"));
    await firstProcess.append(record(1, "running"));

    const reconnected = createNodeMediaInteractionProgressJournal({ directory: root });
    expect((await reconnected.replay(INTERACTION, { afterSequence: 0 }))
      .map(({ sequence }) => sequence)).toEqual([1]);

    const replayEntered = deferred<void>();
    const releaseReplay = deferred<void>();
    const observed: number[] = [];
    const subscribing = reconnected.subscribe(
      INTERACTION,
      {
        async append(value) {
          observed.push(value.sequence);
          if (value.sequence === 1) {
            replayEntered.resolve();
            await releaseReplay.promise;
          }
        },
      },
      { afterSequence: 0 },
    );
    await replayEntered.promise;
    const appending = reconnected.append(record(2, "running"));
    releaseReplay.resolve();
    await subscribing;
    await appending;

    expect(observed).toEqual([1, 2]);
    expect(await reconnected.resume(INTERACTION)).toEqual({
      sequence: 2,
      elapsedMs: 20,
    });
  });

  it("classifies an interrupted open consequential stage as uncertain", async () => {
    const root = await temporaryRoot();
    const journal = createNodeMediaInteractionProgressJournal({ directory: root });
    await journal.append(record(0, "started"));
    await journal.append(record(
      1,
      "started",
      { kind: "stage", stageId: "publication.commit" },
    ));

    const recovered = await journal.recover(INTERACTION);

    expect(recovered).toMatchObject({
      state: "uncertain",
      terminal: true,
      sequence: 1,
      recovery: {
        classification: "uncertain",
        consequentialStageIds: ["publication.commit"],
      },
    });
    expect(await journal.resume(INTERACTION)).toBeUndefined();
    expect((await journal.replay(INTERACTION)).map(({ sequence }) => sequence))
      .toEqual([0, 1]);
  });

  it("keeps a committed consequential stage uncertain when interaction completion is missing", async () => {
    const root = await temporaryRoot();
    const journal = createNodeMediaInteractionProgressJournal({ directory: root });
    const stage = { kind: "stage", stageId: "publication.commit" } as const;
    await journal.append(record(0, "started"));
    await journal.append(record(1, "started", stage));
    await journal.append(record(2, "succeeded", stage));

    const recovered = await journal.recover(INTERACTION);

    expect(recovered).toMatchObject({
      state: "uncertain",
      terminal: true,
      sequence: 2,
      recovery: {
        classification: "uncertain",
        consequentialStageIds: ["publication.commit"],
      },
    });
    expect(recovered?.openStageIds).toEqual([]);
    expect(await journal.resume(INTERACTION)).toBeUndefined();
  });

  it("returns a resumable cursor for interrupted nonconsequential work", async () => {
    const root = await temporaryRoot();
    const journal = createNodeMediaInteractionProgressJournal({ directory: root });
    await journal.append(record(0, "started"));
    await journal.append(record(
      1,
      "started",
      { kind: "stage", stageId: "runtime.render" },
    ));

    expect(await journal.recover(INTERACTION)).toMatchObject({
      state: "running",
      terminal: false,
      sequence: 1,
      recovery: { classification: "resumable" },
    });
    expect(await journal.resume(INTERACTION)).toEqual({
      sequence: 1,
      elapsedMs: 10,
    });
  });

  it("preserves terminal completion across recovery and reconnect", async () => {
    const root = await temporaryRoot();
    const journal = createNodeMediaInteractionProgressJournal({ directory: root });
    await journal.append(record(0, "started"));
    await journal.append(record(1, "succeeded"));

    const reconnected = createNodeMediaInteractionProgressJournal({ directory: root });
    expect(await reconnected.recover(INTERACTION)).toMatchObject({
      state: "succeeded",
      terminal: true,
      sequence: 1,
      recovery: { classification: "terminal" },
    });
    expect(await reconnected.resume(INTERACTION)).toBeUndefined();
    await expect(reconnected.append(record(2, "running"))).rejects.toMatchObject({
      code: "PROGRESS_JOURNAL_TERMINAL",
    });
  });

  it("rebuilds a missing or stale snapshot from authoritative JSONL", async () => {
    const root = await temporaryRoot();
    const journal = createNodeMediaInteractionProgressJournal({ directory: root });
    await journal.append(record(0, "started"));
    const paths = journal.paths(INTERACTION);
    const stale = await readFile(paths.latest, "utf8");
    await journal.append(record(1, "running"));
    await writeFile(paths.latest, stale, "utf8");

    expect(await journal.latest(INTERACTION)).toMatchObject({ sequence: 1 });
    expect(JSON.parse(await readFile(paths.latest, "utf8"))).toMatchObject({
      sequence: 1,
    });

    await unlink(paths.latest);
    expect(await journal.latest(INTERACTION)).toMatchObject({ sequence: 1 });
    expect(JSON.parse(await readFile(paths.latest, "utf8"))).toMatchObject({
      sequence: 1,
    });
  });

  it("rejects identity mismatches, sequence gaps, and future cursors", async () => {
    const root = await temporaryRoot();
    const journal = createNodeMediaInteractionProgressJournal({ directory: root });
    await expect(journal.append(record(1, "started"))).rejects.toMatchObject({
      code: "PROGRESS_JOURNAL_NONCONTIGUOUS",
    });
    await expect(journal.replay(INTERACTION, { afterSequence: 0 })).rejects
      .toMatchObject({ code: "INVALID_PROGRESS_JOURNAL_VALUE" });

    const paths = journal.paths(INTERACTION);
    await mkdir(paths.directory, { recursive: true });
    const foreign = Object.freeze({ ...INTERACTION, contractDigest: "sha256:foreign" });
    await writeFile(
      paths.events,
      `${JSON.stringify(record(0, "started", { kind: "interaction" }, foreign))}\n`,
      "utf8",
    );
    await expect(journal.replay(INTERACTION)).rejects.toMatchObject({
      code: "PROGRESS_JOURNAL_IDENTITY_MISMATCH",
    });
  });

  it("rejects corrupt committed lines but discards only a final torn line", async () => {
    const corruptRoot = await temporaryRoot();
    const corrupt = createNodeMediaInteractionProgressJournal({ directory: corruptRoot });
    const corruptPaths = corrupt.paths(INTERACTION);
    await mkdir(corruptPaths.directory, { recursive: true });
    await writeFile(
      corruptPaths.events,
      `${JSON.stringify(record(0, "started"))}\n{not-json}\n`,
      "utf8",
    );
    await expect(corrupt.replay(INTERACTION)).rejects.toBeInstanceOf(
      NodeMediaInteractionProgressJournalError,
    );

    const tornRoot = await temporaryRoot();
    const torn = createNodeMediaInteractionProgressJournal({ directory: tornRoot });
    await torn.append(record(0, "started"));
    const tornPaths = torn.paths(INTERACTION);
    await appendFile(tornPaths.events, '{"schemaVersion":0', "utf8");
    expect((await torn.replay(INTERACTION)).map(({ sequence }) => sequence))
      .toEqual([0]);
    expect(await readFile(tornPaths.events, "utf8")).toBe(
      `${JSON.stringify(record(0, "started"))}\n`,
    );
  });
});

const INTERACTION: MediaInteractionProgressInteractionIdentity = Object.freeze({
  executionId: "export:launch",
  attemptId: "attempt:1",
  programDigest: "sha256:program",
  interactionId: MEDIA_INTERACTION_IDS.export,
  contractDigest: "sha256:contract",
});

function record(
  sequence: number,
  state: "started" | "running" | "succeeded",
  subject: MediaInteractionProgressSubject = Object.freeze({ kind: "interaction" }),
  interaction: MediaInteractionProgressInteractionIdentity = INTERACTION,
): MediaInteractionProgressRecord {
  return Object.freeze({
    schemaVersion: 1,
    kind: "media-interaction-progress",
    interaction,
    sequence,
    elapsedMs: sequence * 10,
    subject,
    state,
  });
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "superimg-progress-journal-"));
  roots.push(root);
  return root;
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
