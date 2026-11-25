//! Optional host Preview Program. Registration remains the Boundary SDK's job.
import {
  b,
  bindAuthorizedProjection,
  bindProjection,
  compileInteractions,
  createBindingSlot,
  declaredInteractionError,
  defineInteraction,
  installInteractions,
  projectInteractions,
  realizeDirect,
  type Admission,
  type AuthorizedAdmission,
  type BindingSlot,
  type InvocationObserver,
  type ProjectionSelections,
  type SlotRebindResult,
} from "@foxworth/boundary";
import type { JsonObject } from "@foxworth/boundary/program";
import { PreviewInspectionError, type PreviewInspection } from "@superimg/player/inspection";

const nonNegInt = b.integer({ minimum: 0 });
const nonNegNum = b.number({ minimum: 0 });
const nonEmptyString = b.string({ minLength: 1 });
const nullableObject = b.nullable(b.record(b.json()));

const boundsSchema = b.object({
  x: b.number(),
  y: b.number(),
  width: b.number(),
  height: b.number(),
});

const sourceIdentitySchema = b.object({
  id: b.string(),
  revision: b.optional(b.string()),
});

const compilationSchema = b.object({
  status: b.enum(["pending", "succeeded", "failed"]),
  source: b.optional(sourceIdentitySchema),
  inputIdentity: b.optional(b.string()),
  projectionIdentity: b.optional(b.string()),
  hostGeneration: b.optional(nonNegInt),
  error: b.optional(
    b.object({
      code: b.optional(b.string()),
      message: b.string(),
    }),
  ),
});

const coordinatesSchema = b.object({
  entryId: b.nullable(b.string()),
  variantId: b.nullable(b.string()),
  editionId: b.nullable(b.string()),
});

const opaqueSchema = b.array(
  b.object({
    kind: b.string(),
    bounds: boundsSchema,
  }),
);

const observationsSchema = b.object({
  coordinateSpace: b.literal("document-viewport"),
  nodes: b.array(
    b.object({
      id: b.nullable(b.string()),
      occurrence: b.nullable(b.string()),
      tag: b.string(),
      bounds: boundsSchema,
      text: b.string(),
      parentIndex: b.optional(b.nullable(nonNegInt)),
      clipping: b.optional(b.record(b.string())),
      typography: b.nullable(b.record(b.string())),
      svg: b.nullable(
        b.object({
          coordinateSpace: b.literal("svg-user-space"),
          bounds: b.nullable(boundsSchema),
          textLength: b.nullable(nonNegNum),
        }),
      ),
    }),
  ),
  coverage: b.object({
    sampledNodes: nonNegInt,
    truncated: b.boolean(),
    maxNodes: nonNegInt,
    maxTextLength: nonNegInt,
    opaque: opaqueSchema,
  }),
});

const snapshotSchema = b.object({
  schemaVersion: b.literal(1),
  surfaceId: b.string(),
  generation: nonNegInt,
  source: nullableObject,
  compilation: b.optional(b.nullable(compilationSchema)),
  coordinates: b.optional(coordinatesSchema),
  observations: b.optional(b.nullable(observationsSchema)),
  requestedFrame: b.nullable(nonNegInt),
  presented: b.nullable(
    b.object({
      frame: nonNegInt,
      revision: nonNegInt,
    }),
  ),
  width: nonNegInt,
  height: nonNegInt,
  fps: nonNegNum,
  totalFrames: nonNegInt,
  clock: b.object({
    owner: b.enum(["inspection", "playback", "scroll", "pointer", "host"]),
    isPlaying: b.boolean(),
  }),
  currentPart: b.nullable(b.string()),
  parts: b.array(
    b.object({
      id: b.string(),
      label: b.optional(b.string()),
    }),
  ),
  routes: b.record(b.string()),
  activeOccurrences: b.array(
    b.object({
      path: b.string(),
      startFrame: nonNegInt,
      endFrame: nonNegInt,
      localFrame: nonNegInt,
      width: nonNegInt,
      height: nonNegInt,
    }),
  ),
  stepId: b.nullable(b.string()),
  semantic: nullableObject,
  nodes: b.array(
    b.object({
      id: b.string(),
      occurrence: b.nullable(b.string()),
      kind: b.string(),
      actions: b.array(b.string()),
      sceneId: b.nullable(b.string()),
      bounds: boundsSchema,
      authoredBounds: b.nullable(boundsSchema),
    }),
  ),
  geometry: b.object({
    coordinateSpace: b.literal("host-viewport"),
    iframePath: b.array(b.string()),
    dpr: nonNegNum,
    surface: boundsSchema,
    frame: b.nullable(boundsSchema),
    content: b.optional(b.nullable(boundsSchema)),
  }),
  readiness: b.object({
    status: b.enum(["unverified", "pending", "ready", "failed"]),
    error: b.nullable(b.string()),
  }),
  coverage: b.object({
    dom: b.enum(["measured", "unavailable"]),
    opaque: opaqueSchema,
  }),
  disposed: b.boolean(),
});

const failureSchema = b.object({
  schemaVersion: b.literal(1),
  code: b.string(),
  message: b.string(),
  surfaceId: b.string(),
});

const listOutputSchema = b.object({
  schemaVersion: b.literal(1),
  surfaces: b.array(
    b.object({
      surfaceId: b.string(),
      generation: nonNegInt,
      controls: b.array(b.string()),
    }),
  ),
});

const targetFields = {
  surfaceId: nonEmptyString,
  expectedGeneration: nonNegInt,
} as const;

export const PREVIEW_INTERACTION_DEFINITIONS = {
  list: defineInteraction({
    id: "media.preview.list",
    input: b.object({}),
    output: listOutputSchema,
    reads: ["preview"],
    changes: [],
    description: "List preview surfaces admitted by this host.",
  }),
  inspect: defineInteraction({
    id: "media.preview.inspect",
    input: b.object({ surfaceId: nonEmptyString }),
    output: snapshotSchema,
    errors: { PREVIEW_ERROR: failureSchema },
    reads: ["preview:{input.surfaceId}"],
    changes: [],
    description:
      "Inspect the accepted frame, named parts, semantic nodes and measured bounds of a preview surface.",
  }),
  setMode: defineInteraction({
    id: "media.preview.set-mode",
    input: b.object({
      ...targetFields,
      mode: b.enum(["inspection", "live"]),
    }),
    output: snapshotSchema,
    errors: { PREVIEW_ERROR: failureSchema },
    reads: ["preview:{input.surfaceId}"],
    changes: ["preview.clock:{input.surfaceId}"],
    description: "Enter persistent inspection mode or restore the host's live preview clock.",
  }),
  seekFrame: defineInteraction({
    id: "media.preview.seek-frame",
    input: b.object({
      ...targetFields,
      frame: nonNegInt,
    }),
    output: snapshotSchema,
    errors: { PREVIEW_ERROR: failureSchema },
    reads: ["preview:{input.surfaceId}"],
    changes: ["preview.frame:{input.surfaceId}"],
    description: "Select one exact authored frame and wait for its accepted display and resources.",
  }),
  selectPart: defineInteraction({
    id: "media.preview.select-part",
    input: b.object({
      ...targetFields,
      partId: nonEmptyString,
    }),
    output: snapshotSchema,
    errors: { PREVIEW_ERROR: failureSchema },
    reads: ["preview:{input.surfaceId}"],
    changes: ["preview.part:{input.surfaceId}"],
    description: "Select an absolute named part of a manual deck or timed program.",
  }),
  selectRoute: defineInteraction({
    id: "media.preview.select-route",
    input: b.object({
      ...targetFields,
      path: nonEmptyString,
      selection: nonEmptyString,
    }),
    output: snapshotSchema,
    errors: { PREVIEW_ERROR: failureSchema },
    reads: ["preview:{input.surfaceId}"],
    changes: ["preview.route:{input.surfaceId}"],
    description:
      "Prepare and select an absolute route, retaining the previous committed route on failure.",
  }),
  selectStep: defineInteraction({
    id: "media.preview.select-step",
    input: b.object({
      ...targetFields,
      stepId: nonEmptyString,
    }),
    output: snapshotSchema,
    errors: { PREVIEW_ERROR: failureSchema },
    reads: ["preview:{input.surfaceId}"],
    changes: ["preview.step:{input.surfaceId}"],
    description: "Select an absolute guide step on a host-enabled interactive preview.",
  }),
} as const;

export type PreviewInteractionAlias = keyof typeof PREVIEW_INTERACTION_DEFINITIONS;

let compiled:
  | ReturnType<typeof compileInteractions<typeof PREVIEW_INTERACTION_DEFINITIONS>>
  | undefined;

export function compilePreviewInteractions() {
  return (compiled ??= compileInteractions(PREVIEW_INTERACTION_DEFINITIONS));
}

function assertExpose(expose: readonly PreviewInteractionAlias[]): void {
  if (
    !expose.length ||
    new Set(expose).size !== expose.length ||
    expose.some((alias) => !Object.hasOwn(PREVIEW_INTERACTION_DEFINITIONS, alias))
  ) {
    throw new RangeError("expose must contain distinct Preview interaction aliases");
  }
}

function installPreview<Context>(
  inspection: PreviewInspection,
  installationId: string,
  revision: number | string,
  allowed: ReadonlySet<string> | null,
) {
  const definitions = PREVIEW_INTERACTION_DEFINITIONS;
  const program = compilePreviewInteractions();
  const json = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T;
  const invoke = async <T>(
    alias: Exclude<PreviewInteractionAlias, "list">,
    call: () => Promise<unknown>,
  ): Promise<T> => {
    try {
      return json<T>(await call());
    } catch (cause) {
      if (cause instanceof PreviewInspectionError) {
        throw declaredInteractionError(definitions[alias], "PREVIEW_ERROR", {
          schemaVersion: 1,
          code: cause.code,
          message: cause.message,
          surfaceId: cause.surfaceId,
        });
      }
      throw cause;
    }
  };
  const id = (alias: PreviewInteractionAlias) => `${installationId}:${alias}:${revision}`;
  return installInteractions(program, {
    installationId,
    realizations: {
      list: realizeDirect<Context>(
        () =>
          json({
            schemaVersion: 1,
            surfaces: inspection
              .list()
              .filter((surface) => !allowed || allowed.has(surface.surfaceId)),
          }),
        id("list"),
      ),
      inspect: realizeDirect<Context>(
        (input) => invoke("inspect", () => inspection.inspect(input)),
        id("inspect"),
      ),
      setMode: realizeDirect<Context>(
        (input) => invoke("setMode", () => inspection.setMode(input)),
        id("setMode"),
      ),
      seekFrame: realizeDirect<Context>(
        (input) => invoke("seekFrame", () => inspection.seek(input)),
        id("seekFrame"),
      ),
      selectPart: realizeDirect<Context>(
        (input) => invoke("selectPart", () => inspection.selectPart(input)),
        id("selectPart"),
      ),
      selectRoute: realizeDirect<Context>(
        (input) => invoke("selectRoute", () => inspection.selectRoute(input)),
        id("selectRoute"),
      ),
      selectStep: realizeDirect<Context>(
        (input) => invoke("selectStep", () => inspection.selectStep(input)),
        id("selectStep"),
      ),
    },
  });
}

function wrapSurfaceAdmission<Context>(
  admit: Admission<Context>,
  allowed: ReadonlySet<string> | null,
): Admission<Context> {
  if (!allowed) return admit;
  return (request) => {
    const input = request.input;
    if (
      input &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      typeof (input as JsonObject).surfaceId === "string" &&
      !allowed.has((input as JsonObject).surfaceId as string)
    ) {
      return { decision: "deny", reason: "Surface is outside this preview binding" };
    }
    return admit(request);
  };
}

function wrapAuthorizedSurfaceAdmission<CallerContext, AuthContext>(
  authorize: AuthorizedAdmission<CallerContext, AuthContext>,
  allowed: ReadonlySet<string> | null,
): AuthorizedAdmission<CallerContext, AuthContext> {
  if (!allowed) return authorize;
  return (request) => {
    const input = request.input;
    if (
      input &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      typeof (input as JsonObject).surfaceId === "string" &&
      !allowed.has((input as JsonObject).surfaceId as string)
    ) {
      return { decision: "deny", reason: "Surface is outside this preview binding" };
    }
    return authorize(request);
  };
}

function buildPreviewProjection(expose: readonly PreviewInteractionAlias[]) {
  const program = compilePreviewInteractions();
  const selections: ProjectionSelections = Object.fromEntries(
    expose.map((alias) => [alias, { interaction: program.handles[alias], modes: ["direct"] }]),
  );
  return projectInteractions(program, selections);
}

export type PreviewInteractionMountOptions<Context, AuthContext = Context> = Readonly<{
  inspection: PreviewInspection;
  installationId: string;
  expose: readonly PreviewInteractionAlias[];
  /** Restrict this caller binding's resource scope, including list results. */
  allowedSurfaces?: readonly string[];
  observation?: InvocationObserver<AuthContext>;
}> &
  (
    | Readonly<{ admit: Admission<Context>; authorize?: never }>
    | Readonly<{ authorize: AuthorizedAdmission<Context, AuthContext>; admit?: never }>
  );

/** Host explicitly chooses its caller surface and supplies trusted admission. */
export function createPreviewInteractionMount<Context, AuthContext = Context>(
  options: PreviewInteractionMountOptions<Context, AuthContext>,
) {
  assertExpose(options.expose);
  const allowed = options.allowedSurfaces ? new Set(options.allowedSurfaces) : null;
  const program = compilePreviewInteractions();
  const realized = installPreview<AuthContext>(
    options.inspection,
    options.installationId,
    1,
    allowed,
  );
  const projection = buildPreviewProjection(options.expose);
  const result =
    options.authorize !== undefined
      ? bindAuthorizedProjection(projection, realized.installation, {
          admit: wrapAuthorizedSurfaceAdmission(options.authorize, allowed),
          ...(options.observation === undefined ? {} : { observation: options.observation }),
        })
      : bindProjection(projection, realized.installation as never, {
          admit: wrapSurfaceAdmission(options.admit as Admission<Context>, allowed),
          ...(options.observation === undefined
            ? {}
            : { observation: options.observation as unknown as InvocationObserver<Context> }),
        });
  if (result.status !== "bound") {
    realized.controller.revoke();
    throw new Error("Preview projection could not be bound");
  }
  const caller = result.binding.connect();
  return {
    program: program.program,
    projection,
    ...realized,
    binding: result.binding,
    caller,
    try: caller.try,
    dispose: () => {
      result.controller.revoke();
      realized.controller.revoke();
    },
  };
}

export type PreviewInteractionSlot<Context> = Readonly<{
  program: ReturnType<typeof compilePreviewInteractions>["program"];
  slot: BindingSlot<Record<string, any>, Context>;
  readonly current: BindingSlot<Record<string, any>, Context>["current"];
  caller(): ReturnType<BindingSlot<Record<string, any>, Context>["current"]["connect"]>;
  try(): ReturnType<BindingSlot<Record<string, any>, Context>["current"]["connect"]>["try"];
  rebind(
    nextInspection: PreviewInspection,
    overrides?: Readonly<{
      installationId?: string;
      expose?: readonly PreviewInteractionAlias[];
      admit?: Admission<Context>;
      allowedSurfaces?: readonly string[];
      observation?: InvocationObserver<Context>;
    }>,
  ): SlotRebindResult;
  subscribe(listener: (slot: BindingSlot<Record<string, any>, Context>) => void): () => void;
  dispose(): void;
}>;

/**
 * Atomic hot-reload slot for preview hosts. On rebind, the live preview binding
 * stays active if the next installation fails contract verification; on success,
 * the previous binding and installation are revoked cleanly.
 */
export function createPreviewInteractionSlot<Context>(options: Readonly<{
  inspection: PreviewInspection;
  installationId: string;
  expose: readonly PreviewInteractionAlias[];
  admit: Admission<Context>;
  allowedSurfaces?: readonly string[];
  observation?: InvocationObserver<Context>;
}>): PreviewInteractionSlot<Context> {
  assertExpose(options.expose);
  const program = compilePreviewInteractions();
  let revision = 1;
  let currentInstallationId = options.installationId;
  let currentAdmit = options.admit;
  let currentAllowed = options.allowedSurfaces ? new Set(options.allowedSurfaces) : null;
  let currentObservation = options.observation;
  let currentRealized = installPreview<Context>(
    options.inspection,
    currentInstallationId,
    revision,
    currentAllowed,
  );
  const initialProjection = buildPreviewProjection(options.expose);
  const initialBound = bindProjection(initialProjection, currentRealized.installation, {
    admit: wrapSurfaceAdmission(currentAdmit, currentAllowed),
    ...(currentObservation === undefined ? {} : { observation: currentObservation }),
  });
  if (initialBound.status !== "bound") {
    currentRealized.controller.revoke();
    throw new Error("Preview projection could not be bound");
  }
  const slot = createBindingSlot(initialProjection, initialBound);

  return {
    program: program.program,
    slot,
    get current() {
      return slot.current;
    },
    caller() {
      return slot.current.connect();
    },
    try() {
      return slot.current.connect().try;
    },
    rebind(nextInspection, overrides = {}) {
      const nextInstallationId = overrides.installationId ?? currentInstallationId;
      const nextAdmit = overrides.admit ?? currentAdmit;
      const nextAllowed =
        overrides.allowedSurfaces !== undefined
          ? new Set(overrides.allowedSurfaces)
          : currentAllowed;
      const nextObservation =
        overrides.observation !== undefined ? overrides.observation : currentObservation;
      const nextRevision = revision + 1;
      const nextRealized = installPreview<Context>(
        nextInspection,
        nextInstallationId,
        nextRevision,
        nextAllowed,
      );
      const bindOptions = {
        admit: wrapSurfaceAdmission(nextAdmit, nextAllowed),
        ...(nextObservation === undefined ? {} : { observation: nextObservation }),
      };
      let outcome: SlotRebindResult;
      if (overrides.expose !== undefined) {
        assertExpose(overrides.expose);
        const nextProjection = buildPreviewProjection(overrides.expose);
        outcome = slot.rebindProjection(nextProjection, nextRealized.installation, bindOptions);
      } else {
        outcome = slot.rebind(nextRealized.installation, bindOptions);
      }
      if (outcome.status !== "rebound") {
        nextRealized.controller.revoke();
        return outcome;
      }
      const previous = currentRealized;
      revision = nextRevision;
      currentInstallationId = nextInstallationId;
      currentAdmit = nextAdmit;
      currentAllowed = nextAllowed;
      currentObservation = nextObservation;
      currentRealized = nextRealized;
      previous.controller.revoke();
      return outcome;
    },
    subscribe(listener) {
      return slot.subscribe(listener);
    },
    dispose() {
      slot.revoke();
      currentRealized.controller.revoke();
    },
  };
}
