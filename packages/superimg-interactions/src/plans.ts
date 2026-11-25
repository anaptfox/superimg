import type {
  InteractionMode,
  Projection,
  ProjectionBinding,
  ProjectionBindingManifest,
} from "@foxworth/boundary";
import {
  createPlan,
  planAggregateFootprints,
  planParallelWaves,
  planRequiredProjection,
  planRequiredSelections,
  preflightPlan,
  validatePlan,
  type Plan,
  type PlanFootprints,
  type PlanInputBinding,
  type PlanRequiredSelections,
  type PlanSource,
  type PlanStep,
  type PreflightReport,
} from "@foxworth/boundary/plan";
import { composePrograms, type JsonObject, type Program } from "@foxworth/boundary/program";
import { MEDIA_COMPILED_INTERACTIONS } from "./compiled.js";
import { MEDIA_INTERACTION_IDS, type MediaArtifactTarget, type MediaPublicationTarget } from "./contracts.js";
import { EDIT_COMPILED_INTERACTIONS } from "./edit/compiled.js";
import { RENDER_COMPILED_INTERACTIONS } from "./render/compiled.js";
import { SCRIPT_COMPILED_INTERACTIONS } from "./script/compiled.js";

export {
  createPlan,
  validatePlan,
  planAggregateFootprints,
  planParallelWaves,
  planRequiredProjection,
  planRequiredSelections,
  preflightPlan,
  type Plan,
  type PlanFootprints,
  type PlanInputBinding,
  type PlanRequiredSelections,
  type PlanSource,
  type PlanStep,
  type PreflightReport,
};

/** Combined handler-free Program across Media, Edit, Render, and Script surfaces. */
export const SUPERIMG_COMBINED_PROGRAM: Program = composePrograms([
  MEDIA_COMPILED_INTERACTIONS.program,
  EDIT_COMPILED_INTERACTIONS.program,
  RENDER_COMPILED_INTERACTIONS.program,
  SCRIPT_COMPILED_INTERACTIONS.program,
]);

export type MediaCheckPlanOptions = Readonly<{
  id?: string;
  craft?: boolean;
  includeInspect?: boolean;
  includeIR?: boolean;
  renderedLayout?: boolean;
}>;

/**
 * Build a handler-free Plan that checks (and optionally inspects) multiple media
 * sources. Because every step only reads its scoped source footprint, Boundary's
 * `planParallelWaves()` places independent checks in the same parallel wave.
 */
export function createMediaCheckPlan(
  sources: readonly string[],
  options: MediaCheckPlanOptions = {},
): Plan {
  if (sources.length === 0) {
    throw new RangeError("createMediaCheckPlan requires at least one source");
  }
  const steps: PlanSource["steps"][number][] = [];
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index]!;
    const checkInputs: Record<string, PlanInputBinding> = {
      source: { kind: "literal", value: source },
      ...(options.craft === undefined ? {} : { craft: { kind: "literal", value: options.craft } }),
      ...(options.renderedLayout === undefined
        ? {}
        : { renderedLayout: { kind: "literal", value: options.renderedLayout } }),
    };
    const checkId = `check-${index + 1}`;
    steps.push({
      id: checkId,
      alias: "check",
      interactionId: MEDIA_INTERACTION_IDS.check,
      mode: "direct",
      inputs: checkInputs,
    });
    if (options.includeInspect) {
      const inspectInputs: Record<string, PlanInputBinding> = {
        source: { kind: "literal", value: source },
        ...(options.includeIR === undefined
          ? {}
          : { includeIR: { kind: "literal", value: options.includeIR } }),
        ...(options.renderedLayout === undefined
          ? {}
          : { renderedLayout: { kind: "literal", value: options.renderedLayout } }),
      };
      steps.push({
        id: `inspect-${index + 1}`,
        alias: "inspect",
        interactionId: MEDIA_INTERACTION_IDS.inspect,
        mode: "direct",
        inputs: inspectInputs,
      });
    }
  }
  return createPlan({
    id: options.id ?? "superimg.media.check-batch",
    steps,
  });
}

export type MediaPublishPlanOptions = Readonly<{
  id?: string;
  source: string;
  /** When true, freeze a deterministic collection snapshot before compile/export. */
  collection?: boolean;
  /** Interaction mode for mutating/provider steps (`direct` or `request`). */
  effectMode?: InteractionMode;
  craft?: boolean;
  compile?: Readonly<{
    target: MediaArtifactTarget;
    verify?: boolean;
    strict?: boolean;
    artifactSchemaVersion?: 0 | 1;
  }>;
  export?: Readonly<{
    publication: MediaPublicationTarget;
    destinations: readonly string[];
    entryIds?: readonly string[];
    variantIds?: readonly string[];
    editionIds?: readonly string[];
    stillFrame?:
      | Readonly<{ kind: "poster" }>
      | Readonly<{ kind: "at"; at: number | string }>;
    encoding?: JsonObject;
  }>;
}>;

/**
 * Build a handler-free publish Plan: `check` -> optional `snapshot` -> optional
 * `compile` and/or `export`. Dependent steps wire the snapshot output explicitly
 * so hosts and agents can derive the minimal Projection and preflight the whole
 * workflow before step 1 runs.
 */
export function createMediaPublishPlan(options: MediaPublishPlanOptions): Plan {
  if (!options.compile && !options.export) {
    throw new RangeError("createMediaPublishPlan requires compile and/or export configuration");
  }
  const mode: InteractionMode = options.effectMode ?? "direct";
  const steps: PlanSource["steps"][number][] = [
    {
      id: "check",
      alias: "check",
      interactionId: MEDIA_INTERACTION_IDS.check,
      mode: "direct",
      inputs: {
        source: { kind: "literal", value: options.source },
        ...(options.craft === undefined ? {} : { craft: { kind: "literal", value: options.craft } }),
      },
    },
  ];

  const downstreamDeps: string[] = ["check"];
  if (options.collection) {
    steps.push({
      id: "snapshot",
      alias: "snapshot",
      interactionId: MEDIA_INTERACTION_IDS.snapshot,
      mode,
      inputs: {
        source: { kind: "literal", value: options.source },
      },
      dependsOn: ["check"],
    });
    downstreamDeps.push("snapshot");
  }

  if (options.compile) {
    const compileInputs: Record<string, PlanInputBinding> = {
      source: { kind: "literal", value: options.source },
      target: { kind: "literal", value: options.compile.target },
      ...(options.collection ? { snapshot: { kind: "step-output", stepId: "snapshot" } } : {}),
      ...(options.compile.verify === undefined
        ? {}
        : { verify: { kind: "literal", value: options.compile.verify } }),
      ...(options.compile.strict === undefined
        ? {}
        : { strict: { kind: "literal", value: options.compile.strict } }),
      ...(options.compile.artifactSchemaVersion === undefined
        ? {}
        : {
            artifactSchemaVersion: {
              kind: "literal",
              value: options.compile.artifactSchemaVersion,
            },
          }),
    };
    steps.push({
      id: "compile",
      alias: "compile",
      interactionId: MEDIA_INTERACTION_IDS.compile,
      mode,
      inputs: compileInputs,
      dependsOn: [...downstreamDeps],
    });
  }

  if (options.export) {
    const exportInputs: Record<string, PlanInputBinding> = {
      source: { kind: "literal", value: options.source },
      publication: { kind: "literal", value: options.export.publication },
      destinations: { kind: "literal", value: [...options.export.destinations] },
      ...(options.collection ? { snapshot: { kind: "step-output", stepId: "snapshot" } } : {}),
      ...(options.export.entryIds === undefined
        ? {}
        : { entryIds: { kind: "literal", value: [...options.export.entryIds] } }),
      ...(options.export.variantIds === undefined
        ? {}
        : { variantIds: { kind: "literal", value: [...options.export.variantIds] } }),
      ...(options.export.editionIds === undefined
        ? {}
        : { editionIds: { kind: "literal", value: [...options.export.editionIds] } }),
      ...(options.export.stillFrame === undefined
        ? {}
        : { stillFrame: { kind: "literal", value: options.export.stillFrame } }),
      ...(options.export.encoding === undefined
        ? {}
        : { encoding: { kind: "literal", value: options.export.encoding } }),
    };
    steps.push({
      id: "export",
      alias: "export",
      interactionId: MEDIA_INTERACTION_IDS.export,
      mode,
      inputs: exportInputs,
      dependsOn: [...downstreamDeps],
    });
  }

  return createPlan({
    id: options.id ?? `superimg.media.publish:${options.source}`,
    steps,
  });
}

export type MediaPlanAnalysis = Readonly<{
  plan: Plan;
  footprints: PlanFootprints;
  waves: readonly (readonly string[])[];
  requiredSelections: PlanRequiredSelections;
  /** Derived minimal Media Projection when all plan steps belong to the Media Program. */
  requiredMediaProjection?: Projection<any>;
  /** Present when a live Binding or manifest was provided for atomic preflight. */
  preflight?: PreflightReport;
}>;

const MEDIA_INTERACTION_ID_SET = new Set<string>(Object.values(MEDIA_INTERACTION_IDS));

/**
 * Inspect a static Plan against SuperImg's Program(s): compute aggregate
 * footprints, parallel execution waves, minimal required selections/projection,
 * and optional atomic preflight against a live Binding or manifest.
 */
export function analyzeMediaPlan(
  plan: Plan,
  options: Readonly<{
    program?: Program;
    binding?: ProjectionBinding<any, any> | ProjectionBindingManifest;
  }> = {},
): MediaPlanAnalysis {
  const isMediaOnly = plan.steps.every((step) => MEDIA_INTERACTION_ID_SET.has(step.interactionId));
  const program =
    options.program ??
    (isMediaOnly ? MEDIA_COMPILED_INTERACTIONS.program : SUPERIMG_COMBINED_PROGRAM);
  const footprints = planAggregateFootprints(plan, program);
  const waves = planParallelWaves(plan, program);
  const requiredSelections = planRequiredSelections(plan, program);
  const requiredMediaProjection = isMediaOnly
    ? planRequiredProjection(plan, MEDIA_COMPILED_INTERACTIONS)
    : undefined;
  const preflight = options.binding
    ? preflightPlan(plan, options.binding, program)
    : undefined;

  return Object.freeze({
    plan,
    footprints,
    waves,
    requiredSelections,
    ...(requiredMediaProjection === undefined ? {} : { requiredMediaProjection }),
    ...(preflight === undefined ? {} : { preflight }),
  });
}
