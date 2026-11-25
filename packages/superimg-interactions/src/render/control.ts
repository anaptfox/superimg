import {
  controlled,
  type ControlHook,
  type ControlRequester,
  type MaybePromise,
  type ResolvedControl,
} from "@foxworth/boundary/control";
import { contributeControlRequests } from "@foxworth/boundary/control/host";
import type { RealizationId } from "@foxworth/boundary";
import type { JsonObject, Sha256Digest } from "@foxworth/boundary/program";
import { RENDER_COMPILED_INTERACTIONS } from "./compiled.js";
import {
  RenderInteractionError,
  type MediaPackageRenderInteractionInput,
  type MediaPackageRenderReceipt,
} from "./contracts.js";
import {
  PACKAGE_RENDER_CONTROL_PREVIEW_SCHEMA,
  PACKAGE_RENDER_CONTROL_STATE_SCHEMA,
} from "./schemas.js";
import {
  preparePackageRender,
  receiptMatchesPrepared,
  renderAndStage,
  type PackageRenderHostOptions,
  type PreparedPackageRender,
} from "./service.js";

export type PackageRenderControlState = Readonly<{
  input: MediaPackageRenderInteractionInput;
  resultId: Sha256Digest;
  profile: "browser" | "edge" | "node" | "node-media";
  dataDigest: Sha256Digest;
  capabilitiesDigest: Sha256Digest;
  packageStoreDigest: Sha256Digest;
  resultStoreDigest: Sha256Digest;
}>;

export type PackageRenderControlPreview = Readonly<{
  sourceId: string;
  packageHash: string;
  resultId: Sha256Digest;
  profile: "browser" | "edge" | "node" | "node-media";
  dataDigest: Sha256Digest;
  output: MediaPackageRenderInteractionInput["output"];
}>;

export type PackageRenderControlHook<Context> = ControlHook<
  MediaPackageRenderInteractionInput,
  MediaPackageRenderReceipt,
  PackageRenderControlState & JsonObject,
  PackageRenderControlPreview & JsonObject,
  typeof PACKAGE_RENDER_CONTROL_STATE_SCHEMA,
  typeof PACKAGE_RENDER_CONTROL_PREVIEW_SCHEMA,
  Context
>;

export function createPackageRenderControlHook<Context>(
  options: PackageRenderHostOptions<Context>,
): PackageRenderControlHook<Context> {
  return controlled({
    realizationDigest: options.realizationDigest,
    state: PACKAGE_RENDER_CONTROL_STATE_SCHEMA,
    preview: PACKAGE_RENDER_CONTROL_PREVIEW_SCHEMA,
    async plan({ input, context }) {
      const prepared = await preparePackageRender(options, input);
      const state = stateFor(prepared);
      return {
        subject: {
          kind: "media-package",
          id: `${input.sourceId}@${input.packageHash}`,
        },
        baseline: {
          packageHash: input.packageHash,
          packageStoreDigest: prepared.packageStoreDigest,
          resultStoreDigest: prepared.resultStoreDigest,
          capabilitiesDigest: prepared.capabilitiesDigest,
          existingResult: (await options.resultStore.inspect(prepared.resultId)).status,
        },
        baselineSummary: `Package ${input.sourceId}@${input.packageHash.slice(0, 12)} using ${prepared.profile}`,
        effects: [
          {
            kind: "media-render-result",
            action: "write",
            resource: prepared.resultId,
            description: `Render ${input.output.format} from ${input.sourceId}`,
            details: {
              packageHash: input.packageHash,
              profile: prepared.profile,
            },
          },
        ],
        state: state as PackageRenderControlState & JsonObject,
        preview: previewFor(prepared) as PackageRenderControlPreview & JsonObject,
      };
    },
    async apply(args) {
      const prepared = await preparePackageRender(options, args.input);
      assertStateMatches(args.state, prepared);
      const existing = await options.resultStore.inspect(prepared.resultId);
      if (existing.status === "committed") {
        if (receiptMatchesPrepared(existing.receipt, prepared)) return existing.receipt;
        throw new RenderInteractionError(
          "RESULT_CONFLICT",
          "resultStore",
          "a conflicting result is already committed",
        );
      }
      if (existing.status !== "missing") {
        throw new RenderInteractionError(
          "RESULT_CONFLICT",
          "resultStore",
          existing.status === "conflict"
            ? existing.reason
            : "an earlier partial result must be reconciled before execution",
        );
      }
      const staged = await renderAndStage(
        options,
        prepared,
        args.context,
        args.lease.owner,
        args.lease.fence,
      );
      try {
        const renewed = await args.lease.renew();
        if (renewed.fence !== args.lease.fence || renewed.owner !== args.lease.owner) {
          throw new RenderInteractionError(
            "RESULT_CONFLICT",
            "lease",
            "render lease identity changed before result commit",
          );
        }
        return await options.resultStore.commit(staged.stage);
      } catch (cause) {
        await options.resultStore.discard(staged.stage);
        throw cause;
      }
    },
    async verify(args) {
      const prepared = await preparePackageRender(options, args.input);
      if (!stateMatches(args.state, prepared) || !receiptMatchesPrepared(args.output, prepared)) {
        return { ok: false, message: "render output does not match the planned package state" };
      }
      const inspection = await options.resultStore.inspect(prepared.resultId);
      if (
        inspection.status !== "committed" ||
        !receiptMatchesPrepared(inspection.receipt, prepared) ||
        inspection.receipt.sha256 !== args.output.sha256 ||
        inspection.receipt.byteLength !== args.output.byteLength
      ) {
        return {
          ok: false,
          message: "committed render result failed receipt verification",
          evidence: { resultId: prepared.resultId, status: inspection.status },
        };
      }
      return {
        ok: true,
        evidence: {
          resultId: prepared.resultId,
          sha256: inspection.receipt.sha256,
          byteLength: inspection.receipt.byteLength,
        },
      };
    },
    async reconcile(args) {
      let prepared: PreparedPackageRender;
      try {
        prepared = await preparePackageRender(options, args.input);
      } catch {
        return { status: "uncertain" } as const;
      }
      if (!stateMatches(args.state, prepared)) return { status: "uncertain" } as const;
      let inspection = await options.resultStore.inspect(prepared.resultId);
      if (inspection.status === "committed") {
        return receiptMatchesPrepared(inspection.receipt, prepared)
          ? { status: "completed", value: inspection.receipt } as const
          : { status: "uncertain" } as const;
      }
      if (inspection.status === "conflict") return { status: "uncertain" } as const;
      if (inspection.status === "partial") {
        if (inspection.partials.some((partial) => !partial.known || partial.fence === null)) {
          return { status: "uncertain" } as const;
        }
        const discarded = await options.resultStore.discardPartials(
          prepared.resultId,
          args.lease.fence,
        );
        if (discarded.blocked) return { status: "uncertain" } as const;
        inspection = await options.resultStore.inspect(prepared.resultId);
        if (inspection.status !== "missing") return { status: "uncertain" } as const;
      }
      return {
        status: "not-applied",
        reason: "no committed render result exists for the planned result id",
      } as const;
    },
  }) as PackageRenderControlHook<Context>;
}

export type RenderControlRequestContribution<Actor, Context> = Readonly<{
  control: ResolvedControl<Context>;
  executionRealizationId: RealizationId;
  actor(context: Context): MaybePromise<Actor>;
}>;

export function contributeRenderControlRequests<Actor, Context>(
  requester: ControlRequester<Actor, Context>,
  contribution: RenderControlRequestContribution<Actor, Context>,
) {
  return contributeControlRequests(RENDER_COMPILED_INTERACTIONS, requester, {
    render: {
      interaction: RENDER_COMPILED_INTERACTIONS.handles.render,
      control: contribution.control,
      executionRealizationId: contribution.executionRealizationId,
      actor: contribution.actor,
    },
  });
}

function stateFor(prepared: PreparedPackageRender): PackageRenderControlState {
  return Object.freeze({
    input: prepared.input,
    resultId: prepared.resultId,
    profile: prepared.profile,
    dataDigest: prepared.dataDigest,
    capabilitiesDigest: prepared.capabilitiesDigest,
    packageStoreDigest: prepared.packageStoreDigest,
    resultStoreDigest: prepared.resultStoreDigest,
  });
}

function previewFor(prepared: PreparedPackageRender): PackageRenderControlPreview {
  return Object.freeze({
    sourceId: prepared.input.sourceId,
    packageHash: prepared.input.packageHash,
    resultId: prepared.resultId,
    profile: prepared.profile,
    dataDigest: prepared.dataDigest,
    output: prepared.input.output,
  });
}

function stateMatches(
  state: PackageRenderControlState,
  prepared: PreparedPackageRender,
): boolean {
  return state.resultId === prepared.resultId &&
    state.profile === prepared.profile &&
    state.dataDigest === prepared.dataDigest &&
    state.capabilitiesDigest === prepared.capabilitiesDigest &&
    state.packageStoreDigest === prepared.packageStoreDigest &&
    state.resultStoreDigest === prepared.resultStoreDigest;
}

function assertStateMatches(
  state: PackageRenderControlState,
  prepared: PreparedPackageRender,
): void {
  if (!stateMatches(state, prepared)) {
    throw new RenderInteractionError(
      "PACKAGE_CHANGED",
      "control.state",
      "package, capabilities, or backing stores changed after planning",
    );
  }
}
