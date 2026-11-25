import { randomUUID } from "node:crypto";
import {
  negotiateRenderPath,
  validateJobDataAgainstSchema,
  validateTemplatePackage,
} from "@superimg/core";
import type {
  JsonObject,
  RenderLimits,
  RuntimeCapabilities,
  RuntimeProfileName,
} from "@superimg/types";
import type { JsonValue, Sha256Digest } from "@foxworth/boundary/program";
import {
  RenderInteractionError,
  type MediaPackageRenderInteractionInput,
  type MediaPackageRenderReceipt,
} from "./contracts.js";
import {
  executePackageRender,
  type PackageRenderExecutor,
} from "./executor.js";
import { renderDigest } from "./identity.js";
import type {
  RenderPackageRecord,
  RenderPackageStore,
  RenderResultStage,
  RenderResultStore,
} from "./stores.js";

export type PackageRenderHostOptions<Context> = Readonly<{
  packageStore: RenderPackageStore;
  resultStore: RenderResultStore;
  capabilities: RuntimeCapabilities;
  realizationDigest: Sha256Digest;
  executor?: PackageRenderExecutor;
  maxDataBytes?: number;
  limits?: RenderLimits;
  signal?(context: Context): AbortSignal | undefined;
  deadlineMs?(context: Context): number | undefined;
}>;

export type PreparedPackageRender = Readonly<{
  input: MediaPackageRenderInteractionInput;
  record: RenderPackageRecord;
  resultId: Sha256Digest;
  dataDigest: Sha256Digest;
  capabilitiesDigest: Sha256Digest;
  packageStoreDigest: Sha256Digest;
  resultStoreDigest: Sha256Digest;
  profile: RuntimeProfileName;
}>;

export type StagedPackageRender = Readonly<{
  prepared: PreparedPackageRender;
  receipt: MediaPackageRenderReceipt;
  stage: RenderResultStage;
}>;

export async function preparePackageRender<Context>(
  options: PackageRenderHostOptions<Context>,
  input: MediaPackageRenderInteractionInput,
): Promise<PreparedPackageRender> {
  const dataBytes = new TextEncoder().encode(JSON.stringify(input.data)).byteLength;
  if (options.maxDataBytes !== undefined && dataBytes > options.maxDataBytes) {
    throw new RenderInteractionError(
      "INVALID_INPUT",
      "input.data",
      `render data exceeds the configured ${options.maxDataBytes} byte limit`,
    );
  }
  const record = await options.packageStore.get(input.sourceId, input.packageHash);
  if (!record) {
    throw new RenderInteractionError(
      "PACKAGE_NOT_FOUND",
      "input.packageHash",
      `no deployed package matches ${input.sourceId}@${input.packageHash.slice(0, 12)}`,
    );
  }
  const pkg = validateTemplatePackage(record.package, {
    expectedPackageHash: input.packageHash,
  });
  if (pkg.sourceId !== input.sourceId) {
    throw new RenderInteractionError(
      "PACKAGE_CHANGED",
      "input.sourceId",
      "the deployed package source id does not match the request",
    );
  }
  validateJobDataAgainstSchema(input.data, pkg.inputSchema);
  if (!supportsRequestedFormat(pkg.requirements, input.output.format)) {
    throw new RenderInteractionError(
      "UNSUPPORTED_RENDER_PATH",
      "input.output.format",
      `the package does not support ${input.output.format} output`,
    );
  }
  assertCompatibleProfile(input.output.profile, options.capabilities.profile);
  const negotiation = negotiateRenderPath(pkg.requirements, options.capabilities, {
    ...(input.output.profile === undefined
      ? {}
      : { preferredProfile: input.output.profile }),
    requestedOutputs: [input.output.format],
  });
  if (!negotiation.ok) {
    throw new RenderInteractionError(
      "UNSUPPORTED_RENDER_PATH",
      "input.output",
      negotiation.unsupported.map((value) => value.message).join("; "),
      { detail: { unsupported: negotiation.unsupported } as unknown as JsonValue },
    );
  }
  const dataDigest = renderDigest(
    "superimg.package-render-data/v1",
    input.data as JsonValue,
  );
  const capabilitiesDigest = renderDigest(
    "superimg.package-render-capabilities/v1",
    options.capabilities as unknown as JsonValue,
  );
  const resultId = renderDigest(
    "superimg.package-render-result/v1",
    {
      sourceId: input.sourceId,
      packageHash: input.packageHash,
      data: input.data,
      output: input.output,
      profile: negotiation.path.profile,
      realizationDigest: options.realizationDigest,
      capabilitiesDigest,
    },
  );
  return Object.freeze({
    input,
    record: Object.freeze({ packageDir: record.packageDir, package: pkg }),
    resultId,
    dataDigest,
    capabilitiesDigest,
    packageStoreDigest: options.packageStore.identityDigest,
    resultStoreDigest: options.resultStore.identityDigest,
    profile: negotiation.path.profile,
  });
}

export async function renderAndStage<Context>(
  options: PackageRenderHostOptions<Context>,
  prepared: PreparedPackageRender,
  context: Context,
  owner: string,
  fence: number,
): Promise<StagedPackageRender> {
  const signal = options.signal?.(context);
  const deadlineMs = options.deadlineMs?.(context);
  const execution = await (options.executor ?? executePackageRender)({
    packageDir: prepared.record.packageDir,
    package: prepared.record.package,
    input: prepared.input,
    profile: prepared.profile,
    ...(signal === undefined ? {} : { signal }),
    ...(deadlineMs === undefined ? {} : { deadlineMs }),
    ...(options.limits === undefined ? {} : { limits: options.limits }),
  });
  const receipt = receiptFor(prepared, execution);
  const stage = await options.resultStore.stage({
    receipt,
    body: execution.body,
    owner,
    fence,
  });
  return Object.freeze({ prepared, receipt, stage });
}

export async function executeDirectPackageRender<Context>(
  options: PackageRenderHostOptions<Context>,
  input: MediaPackageRenderInteractionInput,
  context: Context,
): Promise<MediaPackageRenderReceipt> {
  const prepared = await preparePackageRender(options, input);
  const inspection = await options.resultStore.inspect(prepared.resultId);
  if (inspection.status === "committed") {
    if (receiptMatchesPrepared(inspection.receipt, prepared)) return inspection.receipt;
    throw resultConflict("the committed result does not match the exact render request");
  }
  if (inspection.status !== "missing") {
    throw resultConflict(
      inspection.status === "conflict"
        ? inspection.reason
        : "an unfinished render result already exists; reconcile it before direct execution",
    );
  }
  const staged = await renderAndStage(
    options,
    prepared,
    context,
    `direct-${randomUUID()}`,
    0,
  );
  try {
    return await options.resultStore.commit(staged.stage);
  } catch (cause) {
    await options.resultStore.discard(staged.stage);
    throw cause;
  }
}

export function receiptMatchesPrepared(
  receipt: MediaPackageRenderReceipt,
  prepared: PreparedPackageRender,
): boolean {
  return receipt.schemaVersion === 0 &&
    receipt.kind === "media-render-result" &&
    receipt.resultId === prepared.resultId &&
    receipt.sourceId === prepared.input.sourceId &&
    receipt.packageHash === prepared.input.packageHash &&
    receipt.profile === prepared.profile &&
    JSON.stringify(receipt.output) === JSON.stringify(prepared.input.output) &&
    Number.isSafeInteger(receipt.byteLength) && receipt.byteLength >= 0 &&
    /^[a-f0-9]{64}$/u.test(receipt.sha256) && receipt.mimeType.length > 0;
}

function receiptFor(
  prepared: PreparedPackageRender,
  execution: Readonly<{
    mimeType: string;
    byteLength: number;
    sha256: string;
  }>,
): MediaPackageRenderReceipt {
  return Object.freeze({
    schemaVersion: 0,
    kind: "media-render-result",
    resultId: prepared.resultId,
    sourceId: prepared.input.sourceId,
    packageHash: prepared.input.packageHash,
    profile: prepared.profile,
    mimeType: execution.mimeType,
    byteLength: execution.byteLength,
    sha256: execution.sha256,
    output: Object.freeze({ ...prepared.input.output }),
  });
}

function supportsRequestedFormat(
  requirements: Readonly<{ medium: string; outputs: readonly string[] }>,
  requested: string,
): boolean {
  if (requirements.outputs.includes(requested)) return true;
  if (requested === "html" && requirements.medium === "html") return true;
  return (requested === "webp" || requested === "jpeg") &&
    requirements.outputs.includes("png");
}

function assertCompatibleProfile(
  requested: RuntimeProfileName | undefined,
  actual: RuntimeProfileName,
): void {
  if (
    requested !== undefined && requested !== actual &&
    !(actual === "node-media" && requested === "node")
  ) {
    throw new RenderInteractionError(
      "UNSUPPORTED_RENDER_PATH",
      "input.output.profile",
      `requested ${requested} profile is not provided by the mounted ${actual} renderer`,
    );
  }
}

function resultConflict(message: string): RenderInteractionError {
  return new RenderInteractionError(
    "RESULT_CONFLICT",
    "resultStore",
    message,
  );
}
