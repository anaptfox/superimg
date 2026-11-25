import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { TemplatePackage } from "@superimg/types";
import {
  canonicalJson,
  isSha256Digest,
  type Sha256Digest,
} from "@foxworth/boundary/program";
import {
  RenderInteractionError,
  type MediaPackageRenderReceipt,
} from "./contracts.js";

export type RenderPackageRecord = Readonly<{
  packageDir: string;
  package: TemplatePackage;
}>;

export interface RenderPackageStore {
  /** Digest of the host's immutable package registry snapshot. */
  readonly identityDigest: Sha256Digest;
  get(
    sourceId: string,
    packageHash: string,
  ): Promise<RenderPackageRecord | undefined> | RenderPackageRecord | undefined;
}

export class InMemoryRenderPackageStore implements RenderPackageStore {
  readonly identityDigest: Sha256Digest;
  private readonly records = new Map<string, RenderPackageRecord>();

  constructor(
    identityDigest: Sha256Digest,
    records: Iterable<RenderPackageRecord> = [],
  ) {
    assertDigest(identityDigest, "packageStore.identityDigest");
    this.identityDigest = identityDigest;
    for (const record of records) this.add(record);
  }

  add(record: RenderPackageRecord): void {
    this.records.set(keyForPackage(record.package.sourceId, record.package.packageHash), record);
  }

  get(sourceId: string, packageHash: string): RenderPackageRecord | undefined {
    return this.records.get(keyForPackage(sourceId, packageHash));
  }
}

export type RenderResultPartial = Readonly<{
  owner: string | null;
  fence: number | null;
  known: boolean;
}>;

export type RenderResultInspection =
  | Readonly<{ status: "missing" }>
  | Readonly<{ status: "partial"; partials: readonly RenderResultPartial[] }>
  | Readonly<{ status: "committed"; receipt: MediaPackageRenderReceipt }>
  | Readonly<{ status: "conflict"; reason: string }>;

export type RenderResultStage = Readonly<{
  resultId: string;
  owner: string;
  fence: number;
  receipt: MediaPackageRenderReceipt;
  token: string;
}>;

export interface RenderResultStore {
  /** Digest of the configured result namespace and backing realization. */
  readonly identityDigest: Sha256Digest;
  inspect(resultId: string): Promise<RenderResultInspection>;
  /** Open committed bytes. Hosts decide whether this becomes a URL or response. */
  open(resultId: string): Promise<ReadableStream<Uint8Array>>;
  stage(args: Readonly<{
    receipt: MediaPackageRenderReceipt;
    body: Uint8Array;
    owner: string;
    fence: number;
  }>): Promise<RenderResultStage>;
  commit(stage: RenderResultStage): Promise<MediaPackageRenderReceipt>;
  discard(stage: RenderResultStage): Promise<void>;
  /** Delete only recognized partials whose fence is not newer than the caller. */
  discardPartials(
    resultId: string,
    throughFence: number,
  ): Promise<Readonly<{ discarded: number; blocked: boolean }>>;
}

type MemoryStage = Readonly<{
  stage: RenderResultStage;
  body: Uint8Array;
}>;

export class InMemoryRenderResultStore implements RenderResultStore {
  readonly identityDigest: Sha256Digest;
  private readonly committed = new Map<
    string,
    Readonly<{ receipt: MediaPackageRenderReceipt; body: Uint8Array }>
  >();
  private readonly staged = new Map<string, MemoryStage>();

  constructor(identityDigest: Sha256Digest) {
    assertDigest(identityDigest, "resultStore.identityDigest");
    this.identityDigest = identityDigest;
  }

  async inspect(resultId: string): Promise<RenderResultInspection> {
    const committed = this.committed.get(resultId);
    if (committed) {
      if (!bytesMatchReceipt(committed.body, committed.receipt)) {
        return { status: "conflict", reason: "committed in-memory result failed integrity verification" };
      }
      return { status: "committed", receipt: committed.receipt };
    }
    const partials = [...this.staged.values()]
      .filter((value) => value.stage.resultId === resultId)
      .map((value) => ({
        owner: value.stage.owner,
        fence: value.stage.fence,
        known: true,
      }));
    return partials.length > 0
      ? { status: "partial", partials }
      : { status: "missing" };
  }

  async open(resultId: string): Promise<ReadableStream<Uint8Array>> {
    const committed = this.committed.get(resultId);
    if (!committed || !bytesMatchReceipt(committed.body, committed.receipt)) {
      throw new RenderInteractionError(
        "RESULT_CONFLICT",
        "resultStore.open",
        "render result is not committed or failed integrity verification",
      );
    }
    const body = committed.body.slice();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      },
    });
  }

  async stage(args: Readonly<{
    receipt: MediaPackageRenderReceipt;
    body: Uint8Array;
    owner: string;
    fence: number;
  }>): Promise<RenderResultStage> {
    assertStageArgs(args);
    const token = `${args.receipt.resultId}:${args.owner}:${args.fence}:${randomUUID()}`;
    const stage = Object.freeze({
      resultId: args.receipt.resultId,
      owner: args.owner,
      fence: args.fence,
      receipt: args.receipt,
      token,
    });
    this.staged.set(token, { stage, body: args.body.slice() });
    return stage;
  }

  async commit(stage: RenderResultStage): Promise<MediaPackageRenderReceipt> {
    const value = this.staged.get(stage.token);
    if (!value || value.stage !== stage) {
      throw new RenderInteractionError(
        "RESULT_CONFLICT",
        "resultStore.stage",
        "render result stage is missing or does not belong to this store",
      );
    }
    const existing = this.committed.get(stage.resultId);
    if (existing) {
      this.staged.delete(stage.token);
      if (!sameReceipt(existing.receipt, stage.receipt)) {
        throw new RenderInteractionError(
          "RESULT_CONFLICT",
          "resultStore.commit",
          "a different result is already committed for this result id",
        );
      }
      return existing.receipt;
    }
    this.committed.set(stage.resultId, {
      receipt: stage.receipt,
      body: value.body,
    });
    this.staged.delete(stage.token);
    return stage.receipt;
  }

  async discard(stage: RenderResultStage): Promise<void> {
    this.staged.delete(stage.token);
  }

  async discardPartials(
    resultId: string,
    throughFence: number,
  ): Promise<Readonly<{ discarded: number; blocked: boolean }>> {
    let discarded = 0;
    let blocked = false;
    for (const [token, value] of this.staged) {
      if (value.stage.resultId !== resultId) continue;
      if (value.stage.fence > throughFence) {
        blocked = true;
        continue;
      }
      this.staged.delete(token);
      discarded += 1;
    }
    return { discarded, blocked };
  }
}

type FileStageMetadata = Readonly<{
  schemaVersion: 0;
  resultId: string;
  owner: string;
  fence: number;
}>;

export class FileSystemRenderResultStore implements RenderResultStore {
  readonly identityDigest: Sha256Digest;

  constructor(
    readonly rootDir: string,
    identityDigest: Sha256Digest,
  ) {
    if (!rootDir) throw new TypeError("result store rootDir is required");
    assertDigest(identityDigest, "resultStore.identityDigest");
    this.identityDigest = identityDigest;
  }

  async inspect(resultId: string): Promise<RenderResultInspection> {
    const paths = this.paths(resultId);
    try {
      const receipt = JSON.parse(await readFile(paths.receipt, "utf8")) as MediaPackageRenderReceipt;
      if (receipt.resultId !== resultId) {
        return { status: "conflict", reason: "committed receipt has a different result id" };
      }
      const bodyStat = await stat(paths.body);
      if (!bodyStat.isFile() || bodyStat.size !== receipt.byteLength) {
        return { status: "conflict", reason: "committed result length does not match its receipt" };
      }
      if ((await hashFile(paths.body)) !== receipt.sha256) {
        return { status: "conflict", reason: "committed result hash does not match its receipt" };
      }
      return { status: "committed", receipt };
    } catch (cause) {
      if (!isMissing(cause)) {
        return {
          status: "conflict",
          reason: cause instanceof Error ? cause.message : "committed result cannot be inspected",
        };
      }
    }

    let names: string[];
    try {
      names = await readdir(paths.shard);
    } catch (cause) {
      if (isMissing(cause)) return { status: "missing" };
      throw cause;
    }
    const prefix = `.${paths.hex}.`;
    const stageNames = names.filter((name) => name.startsWith(prefix));
    if (stageNames.length === 0) return { status: "missing" };
    const partials: RenderResultPartial[] = [];
    for (const name of stageNames) {
      try {
        const metadata = JSON.parse(
          await readFile(join(paths.shard, name, ".stage.json"), "utf8"),
        ) as FileStageMetadata;
        const known = metadata.schemaVersion === 0 && metadata.resultId === resultId &&
          typeof metadata.owner === "string" && Number.isSafeInteger(metadata.fence) &&
          metadata.fence >= 0;
        partials.push({
          owner: known ? metadata.owner : null,
          fence: known ? metadata.fence : null,
          known,
        });
      } catch {
        partials.push({ owner: null, fence: null, known: false });
      }
    }
    return { status: "partial", partials };
  }

  async open(resultId: string): Promise<ReadableStream<Uint8Array>> {
    const inspection = await this.inspect(resultId);
    if (inspection.status !== "committed") {
      throw new RenderInteractionError(
        "RESULT_CONFLICT",
        "resultStore.open",
        "render result is not committed or failed integrity verification",
      );
    }
    return Readable.toWeb(createReadStream(this.paths(resultId).body)) as ReadableStream<Uint8Array>;
  }

  async stage(args: Readonly<{
    receipt: MediaPackageRenderReceipt;
    body: Uint8Array;
    owner: string;
    fence: number;
  }>): Promise<RenderResultStage> {
    assertStageArgs(args);
    const paths = this.paths(args.receipt.resultId);
    await mkdir(paths.shard, { recursive: true });
    const stageDir = await mkdtemp(
      join(paths.shard, `.${paths.hex}.${safeSegment(args.owner)}.${args.fence}.`),
    );
    const stage = Object.freeze({
      resultId: args.receipt.resultId,
      owner: args.owner,
      fence: args.fence,
      receipt: args.receipt,
      token: stageDir,
    });
    try {
      const metadata: FileStageMetadata = {
        schemaVersion: 0,
        resultId: stage.resultId,
        owner: stage.owner,
        fence: stage.fence,
      };
      await writeFile(join(stageDir, ".stage.json"), `${JSON.stringify(metadata)}\n`, {
        flag: "wx",
      });
      await writeFile(join(stageDir, "result.bin"), args.body, { flag: "wx" });
      await writeFile(
        join(stageDir, "receipt.json"),
        `${JSON.stringify(args.receipt)}\n`,
        { flag: "wx" },
      );
      return stage;
    } catch (cause) {
      await rm(stageDir, { recursive: true, force: true });
      throw cause;
    }
  }

  async commit(stage: RenderResultStage): Promise<MediaPackageRenderReceipt> {
    const paths = this.paths(stage.resultId);
    if (join(paths.shard, stage.token.split("/").at(-1) ?? "") !== stage.token) {
      throw new RenderInteractionError(
        "RESULT_CONFLICT",
        "resultStore.stage",
        "render result stage does not belong to the expected result shard",
      );
    }
    try {
      await rename(stage.token, paths.finalDir);
      return stage.receipt;
    } catch (cause) {
      const existing = await this.inspect(stage.resultId);
      if (existing.status === "committed") {
        await this.discard(stage);
        if (sameReceipt(existing.receipt, stage.receipt)) return existing.receipt;
        throw new RenderInteractionError(
          "RESULT_CONFLICT",
          "resultStore.commit",
          "a different result is already committed for this result id",
          { cause },
        );
      }
      throw cause;
    }
  }

  async discard(stage: RenderResultStage): Promise<void> {
    const paths = this.paths(stage.resultId);
    if (stage.token.startsWith(`${paths.shard}/.${paths.hex}.`)) {
      await rm(stage.token, { recursive: true, force: true });
    }
  }

  async discardPartials(
    resultId: string,
    throughFence: number,
  ): Promise<Readonly<{ discarded: number; blocked: boolean }>> {
    const paths = this.paths(resultId);
    let names: string[];
    try {
      names = await readdir(paths.shard);
    } catch (cause) {
      if (isMissing(cause)) return { discarded: 0, blocked: false };
      throw cause;
    }
    let discarded = 0;
    let blocked = false;
    for (const name of names.filter((value) => value.startsWith(`.${paths.hex}.`))) {
      const dir = join(paths.shard, name);
      let metadata: FileStageMetadata;
      try {
        metadata = JSON.parse(await readFile(join(dir, ".stage.json"), "utf8")) as FileStageMetadata;
      } catch {
        blocked = true;
        continue;
      }
      if (
        metadata.schemaVersion !== 0 ||
        metadata.resultId !== resultId ||
        !Number.isSafeInteger(metadata.fence) ||
        metadata.fence < 0
      ) {
        blocked = true;
        continue;
      }
      if (metadata.fence > throughFence) {
        blocked = true;
        continue;
      }
      await rm(dir, { recursive: true, force: true });
      discarded += 1;
    }
    return { discarded, blocked };
  }

  private paths(resultId: string): Readonly<{
    hex: string;
    shard: string;
    finalDir: string;
    receipt: string;
    body: string;
  }> {
    const hex = resultHex(resultId);
    const shard = join(this.rootDir, hex.slice(0, 2));
    const finalDir = join(shard, hex);
    return {
      hex,
      shard,
      finalDir,
      receipt: join(finalDir, "receipt.json"),
      body: join(finalDir, "result.bin"),
    };
  }
}

function keyForPackage(sourceId: string, packageHash: string): string {
  return `${sourceId}\0${packageHash}`;
}

function resultHex(resultId: string): string {
  if (!isSha256Digest(resultId)) {
    throw new RenderInteractionError(
      "INVALID_INPUT",
      "resultId",
      "resultId must be a sha256 digest",
    );
  }
  return resultId.slice("sha256:".length);
}

function assertDigest(value: unknown, path: string): asserts value is Sha256Digest {
  if (!isSha256Digest(value)) {
    throw new RenderInteractionError(
      "INVALID_CONTROL_CONFIGURATION",
      path,
      `${path} must be a sha256 digest`,
    );
  }
}

function assertStageArgs(args: Readonly<{
  receipt: MediaPackageRenderReceipt;
  body: Uint8Array;
  owner: string;
  fence: number;
}>): void {
  resultHex(args.receipt.resultId);
  if (!args.owner || !Number.isSafeInteger(args.fence) || args.fence < 0) {
    throw new RenderInteractionError(
      "INVALID_INPUT",
      "resultStore.stage",
      "stage owner and non-negative integer fence are required",
    );
  }
  if (!bytesMatchReceipt(args.body, args.receipt)) {
    throw new RenderInteractionError(
      "RESULT_CONFLICT",
      "resultStore.stage",
      "rendered bytes do not match their receipt",
    );
  }
}

function bytesMatchReceipt(
  body: Uint8Array,
  receipt: MediaPackageRenderReceipt,
): boolean {
  return body.byteLength === receipt.byteLength && hashBytes(body) === receipt.sha256;
}

function hashBytes(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/gu, "_").slice(0, 80) || "owner";
}

function sameReceipt(
  left: MediaPackageRenderReceipt,
  right: MediaPackageRenderReceipt,
): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function isMissing(cause: unknown): boolean {
  return (cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}
