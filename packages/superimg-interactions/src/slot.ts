import {
  bindAuthorizedProjection,
  bindProjection,
  createBindingSlot,
  directRealizationIds,
  type Admission,
  type AuthorizedAdmission,
  type BindingSlot,
  type InstallationId,
  type InvocationObserver,
  type Projection,
  type ProjectionBinding,
  type RealizationIds,
  type SlotRebindResult,
} from "@foxworth/boundary";
import { preflightPlan, type Plan, type PreflightReport } from "@foxworth/boundary/plan";
import { MEDIA_COMPILED_INTERACTIONS } from "./compiled.js";
import {
  installMediaInteractions,
  type InstallMediaInteractionsOptions,
} from "./install.js";
import type { MediaInteractionExposure, MediaInteractionMount } from "./mount.js";
import { projectMediaInteractions } from "./projection.js";

export type CreateMediaInteractionSlotOptions<CallerContext, AuthContext = CallerContext> = Readonly<{
  mount: MediaInteractionMount<AuthContext>;
  installationId: InstallationId;
  /** Explicit realization IDs, or omit and provide `revision` to derive direct IDs. */
  realizationIds?: RealizationIds;
  revision?: string;
  requests?: InstallMediaInteractionsOptions<AuthContext>["requests"];
  /** Explicit Projection or exposure map (defaults to all direct media interactions). */
  projection?: Projection<any>;
  expose?: MediaInteractionExposure;
  observation?: InvocationObserver<AuthContext>;
}> &
  (
    | Readonly<{ admit: Admission<CallerContext>; authorize?: never }>
    | Readonly<{ authorize: AuthorizedAdmission<CallerContext, AuthContext>; admit?: never }>
  );

export type MediaInteractionSlotRebindOptions<CallerContext, AuthContext = CallerContext> = Readonly<{
  installationId?: InstallationId;
  realizationIds?: RealizationIds;
  revision?: string;
  requests?: InstallMediaInteractionsOptions<AuthContext>["requests"];
  projection?: Projection<any>;
  expose?: MediaInteractionExposure;
  admit?: Admission<CallerContext>;
  authorize?: AuthorizedAdmission<CallerContext, AuthContext>;
  observation?: InvocationObserver<AuthContext>;
}>;

export type MediaInteractionSlot<CallerContext, AuthContext = CallerContext> = Readonly<{
  readonly slot: BindingSlot<any, CallerContext>;
  readonly current: ProjectionBinding<any, CallerContext>;
  readonly projection: Projection<any>;
  caller(): ReturnType<ProjectionBinding<any, CallerContext>["connect"]>;
  try(): ReturnType<ProjectionBinding<any, CallerContext>["connect"]>["try"];
  preflight(plan: Plan): PreflightReport;
  rebind(
    nextMount: MediaInteractionMount<AuthContext>,
    overrides?: MediaInteractionSlotRebindOptions<CallerContext, AuthContext>,
  ): SlotRebindResult;
  subscribe(listener: (slot: BindingSlot<any, CallerContext>) => void): () => void;
  dispose(): void;
}>;

function resolveProjection(
  projection?: Projection<any>,
  expose?: MediaInteractionExposure,
): Projection<any> {
  if (projection) return projection;
  if (expose) return projectMediaInteractions(expose);
  return MEDIA_COMPILED_INTERACTIONS.projectAll("direct");
}

function resolveRealizationIds(
  realizationIds: RealizationIds | undefined,
  revision: string,
): RealizationIds {
  return realizationIds ?? directRealizationIds(MEDIA_COMPILED_INTERACTIONS, revision);
}

/**
 * Atomic hot-reloadable BindingSlot for Media interaction hosts.
 *
 * Supports both direct admission (`admit`) and unified authorized-context
 * admission (`authorize` via `bindAuthorizedProjection`). On `rebind()`, the
 * existing live binding stays active if the replacement installation or
 * projection fails contract verification; on success, the previous installation
 * is revoked cleanly.
 */
export function createMediaInteractionSlot<CallerContext, AuthContext = CallerContext>(
  options: CreateMediaInteractionSlotOptions<CallerContext, AuthContext>,
): MediaInteractionSlot<CallerContext, AuthContext> {
  let revisionCounter = 1;
  let currentInstallationId = options.installationId;
  let currentAdmit = options.admit;
  let currentAuthorize = options.authorize;
  let currentObservation = options.observation;
  let currentRequests = options.requests;
  const initialRevision = options.revision ?? `rev-${revisionCounter}`;
  let currentInstalled = installMediaInteractions(options.mount, {
    installationId: currentInstallationId,
    realizationIds: resolveRealizationIds(options.realizationIds, initialRevision),
    ...(currentRequests === undefined ? {} : { requests: currentRequests }),
  });
  const initialProjection = resolveProjection(options.projection, options.expose);
  const initialBound =
    currentAuthorize !== undefined
      ? bindAuthorizedProjection(initialProjection, currentInstalled.installation, {
          admit: currentAuthorize,
          ...(currentObservation === undefined ? {} : { observation: currentObservation }),
        })
      : bindProjection(initialProjection, currentInstalled.installation as never, {
          admit: currentAdmit as Admission<CallerContext>,
          ...(currentObservation === undefined
            ? {}
            : { observation: currentObservation as unknown as InvocationObserver<CallerContext> }),
        });

  if (initialBound.status !== "bound") {
    currentInstalled.controller.revoke();
    throw new Error(
      `Media interaction slot could not bind projection (${initialBound.report.issues.map((issue) => issue.message).join("; ")})`,
    );
  }

  const slot = createBindingSlot(initialProjection, initialBound);

  return {
    slot,
    get current() {
      return slot.current;
    },
    get projection() {
      return slot.projection;
    },
    caller() {
      return slot.current.connect();
    },
    try() {
      return slot.current.connect().try;
    },
    preflight(plan) {
      return preflightPlan(plan, slot.current, MEDIA_COMPILED_INTERACTIONS.program);
    },
    rebind(nextMount, overrides = {}) {
      const nextInstallationId = overrides.installationId ?? currentInstallationId;
      const nextRequests = overrides.requests !== undefined ? overrides.requests : currentRequests;
      const nextObservation =
        overrides.observation !== undefined ? overrides.observation : currentObservation;
      const nextAdmit = overrides.admit ?? currentAdmit;
      const nextAuthorize = overrides.authorize ?? currentAuthorize;
      const nextCounter = revisionCounter + 1;
      const nextRevision = overrides.revision ?? `rev-${nextCounter}`;
      const nextInstalled = installMediaInteractions(nextMount, {
        installationId: nextInstallationId,
        realizationIds: resolveRealizationIds(overrides.realizationIds, nextRevision),
        ...(nextRequests === undefined ? {} : { requests: nextRequests }),
      });

      const nextProjection =
        overrides.projection !== undefined || overrides.expose !== undefined
          ? resolveProjection(overrides.projection, overrides.expose)
          : undefined;

      const bindOptions = {
        admit: (nextAuthorize ?? nextAdmit) as Admission<CallerContext>,
        ...(nextObservation === undefined
          ? {}
          : { observation: nextObservation as unknown as InvocationObserver<CallerContext> }),
      };

      const outcome =
        nextProjection !== undefined
          ? slot.rebindProjection(nextProjection, nextInstalled.installation as never, bindOptions)
          : slot.rebind(nextInstalled.installation as never, bindOptions);

      if (outcome.status !== "rebound") {
        nextInstalled.controller.revoke();
        return outcome;
      }

      const previous = currentInstalled;
      revisionCounter = nextCounter;
      currentInstallationId = nextInstallationId;
      currentRequests = nextRequests;
      currentObservation = nextObservation;
      currentAdmit = nextAdmit;
      currentAuthorize = nextAuthorize;
      currentInstalled = nextInstalled;
      previous.controller.revoke();
      return outcome;
    },
    subscribe(listener) {
      return slot.subscribe(listener);
    },
    dispose() {
      slot.revoke();
      currentInstalled.controller.revoke();
    },
  };
}
