//! Pure retained-composition validation and integer clock planning.

import type {
  CompositionContent,
  CompositionFit,
  CompositionMedia,
  InteractiveCompositionChild,
  InteractiveCompositionRuntime,
  CompositionLeafSchedule,
  CompositionPlacement,
  CompositionSchedule,
  JsonObject,
  Program,
  ResolvedTransition,
  Transition,
  Use,
} from "@superimg/types";
import { parseDuration } from "../shared/utils.js";
import { portableChildResourcesFor } from "./resources.js";
import { snapshotJsonObject } from "./scoped-data.js";

export interface CompositionProjectionOptions {
  readonly size: Readonly<{ width: number; height: number }>;
  readonly fps: number;
  /** Deterministic branch selections keyed by qualified choice occurrence path. */
  readonly routes?: Readonly<Record<string, string>>;
}

export interface PlannedLeaf extends CompositionLeafSchedule {
  readonly content: CompositionMedia;
  readonly interactiveRuntime?: InteractiveCompositionRuntime;
  readonly data?: JsonObject;
}

export interface CompositionPlan extends CompositionSchedule {
  readonly selectedRoutes: Readonly<Record<string, string>>;
  readonly leaves: readonly PlannedLeaf[];
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function fail(message: string): never {
  throw new TypeError(`composition: ${message}`);
}

function assertFinitePositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0)
    fail(`${field} must be a positive finite number`);
}

function assertId(id: string, path: string): void {
  if (!SAFE_ID.test(id) || id === "." || id === "..") {
    fail(`${path}: id must be a non-empty safe path segment`);
  }
}

function durationFrames(
  duration: string | number,
  fps: number,
  path: string,
): number {
  // Preserve authored frame units as integers instead of round-tripping through
  // binary seconds (for example (7 / 25) * 25 is 7.000000000000001).
  const frameUnit =
    typeof duration === "string" ? duration.match(/^(\d+)f$/) : undefined;
  if (frameUnit) {
    const frames = Number(frameUnit[1]);
    if (!Number.isSafeInteger(frames) || frames < 1) {
      fail(
        `${path}: duration must resolve to a whole positive safe output-frame count at ${fps} fps`,
      );
    }
    return frames;
  }
  const seconds = parseDuration(duration, `${path}.duration`, fps);
  assertFinitePositive(seconds, `${path}.duration`);
  const frames = seconds * fps;
  const rounded = Math.round(frames);
  if (Math.abs(frames - rounded) > 1e-9 || rounded < 1) {
    fail(
      `${path}: duration must resolve to a whole positive output-frame count at ${fps} fps`,
    );
  }
  return rounded;
}

function animatedDurationFrames(
  duration: string | number,
  sourceFps: number,
  outputFps: number,
  path: string,
): number {
  if (sourceFps === outputFps) return durationFrames(duration, outputFps, path);
  const frameUnit =
    typeof duration === "string" ? duration.match(/^(\d+)f$/) : undefined;
  const seconds = frameUnit
    ? Number(frameUnit[1]) / sourceFps
    : parseDuration(duration, `${path}.duration`, sourceFps);
  assertFinitePositive(seconds, `${path}.duration`);
  const frames = Math.ceil(seconds * outputFps - 1e-9);
  if (!Number.isSafeInteger(frames) || frames < 1)
    fail(
      `${path}: duration must resolve to a positive safe output-frame count`,
    );
  return frames;
}

function isProgram(value: CompositionContent): value is Program {
  return typeof value === "object" && value !== null && "op" in value;
}

function isInteractiveChild(
  value: CompositionContent,
): value is InteractiveCompositionChild {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "interactive" &&
    "createCompositionRuntime" in value &&
    typeof value.createCompositionRuntime === "function"
  );
}

function rejectUnsupportedMedia(
  media: CompositionMedia,
  options: CompositionProjectionOptions,
  path: string,
): void {
  if (media.composition)
    fail(
      `${path}: a time() projection cannot be used as a child; nest its Program instead`,
    );
  const config = media.config;
  if (!config) fail(`${path}: child must declare a config with matching size`);
  if (config.assets && Object.keys(config.assets).length > 0)
    portableChildResourcesFor(media, path);
  if (config.background || config.watermark || config.readiness) {
    fail(
      `${path}: child background, watermark, and readiness settings are not supported by this projection`,
    );
  }
  const unsupportedConfig = Object.keys(config).filter(
    (key) =>
      ![
        "width",
        "height",
        "fps",
        "duration",
        "temporal",
        "assets",
        "audio",
        "fonts",
        "nativeModuleSets",
        "inlineCss",
        "stylesheets",
        "tailwind",
      ].includes(key),
  );
  if (unsupportedConfig.length > 0) {
    fail(`${path}: unsupported child config (${unsupportedConfig.join(", ")})`);
  }
  if (
    media.animated &&
    (config.fps === undefined ||
      !Number.isInteger(config.fps) ||
      config.fps <= 0)
  )
    fail(`${path}: animated child requires a positive integer fps`);
}

type ChildEdition = Readonly<{
  size: Readonly<{ width: number; height: number }>;
  render?: CompositionMedia["render"];
}>;

function objectRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

/** A selected occurrence rendition, reusable by per-job preparation before resolve(). */
export interface SelectedChildMedia {
  readonly media: CompositionMedia;
  readonly variantId?: string;
  readonly editionId?: string;
}

// A prepared occurrence has already applied its rendition before resolve().
// Planning it again must preserve the selected IDs without replaying the
// variant patch over data returned by resolve().
const preparedSelections = new WeakMap<CompositionMedia, SelectedChildMedia>();

export function bindPreparedChildSelection(
  media: CompositionMedia,
  selected: SelectedChildMedia,
): CompositionMedia {
  preparedSelections.set(media, {
    media,
    ...(selected.variantId === undefined
      ? {}
      : { variantId: selected.variantId }),
    ...(selected.editionId === undefined
      ? {}
      : { editionId: selected.editionId }),
  });
  return media;
}

/** Select a child rendition once during planning or preparation. */
export function selectChildMedia(use: Use, path: string): SelectedChildMedia {
  const source = use.content as CompositionMedia;
  const prepared = preparedSelections.get(source);
  if (prepared !== undefined) return prepared;
  const variantId = use.variant;
  const editionId = use.edition;
  const variants = objectRecord(source.variants);
  const editions = objectRecord(source.editions);
  const variant = variantId === undefined ? undefined : variants?.[variantId];
  if (variantId !== undefined && variant === undefined)
    fail(`${path}: unknown child variant ${JSON.stringify(variantId)}`);
  const edition = editionId === undefined ? undefined : editions?.[editionId];
  if (editionId !== undefined && edition === undefined)
    fail(`${path}: unknown child edition ${JSON.stringify(editionId)}`);
  const patch = variant === undefined ? undefined : objectRecord(variant);
  if (variant !== undefined && patch === undefined)
    fail(
      `${path}: child variant ${JSON.stringify(variantId)} must be a JSON object`,
    );
  const selectedEdition =
    edition === undefined ? undefined : (edition as ChildEdition);
  if (
    selectedEdition !== undefined &&
    (!selectedEdition.size ||
      !Number.isInteger(selectedEdition.size.width) ||
      !Number.isInteger(selectedEdition.size.height) ||
      selectedEdition.size.width <= 0 ||
      selectedEdition.size.height <= 0 ||
      (selectedEdition.render !== undefined &&
        typeof selectedEdition.render !== "function"))
  ) {
    fail(
      `${path}: child edition ${JSON.stringify(editionId)} must declare an integer positive size and optional render`,
    );
  }
  if (variant === undefined && selectedEdition === undefined)
    return { media: source };
  const sample = objectRecord(source.sample) ?? {};
  return {
    media: Object.freeze({
      ...source,
      ...(selectedEdition === undefined
        ? {}
        : {
            config: {
              ...source.config!,
              width: selectedEdition.size.width,
              height: selectedEdition.size.height,
            },
            ...(selectedEdition.render === undefined
              ? {}
              : { render: selectedEdition.render }),
          }),
      ...(patch === undefined
        ? {}
        : { sample: Object.freeze({ ...sample, ...patch }) }),
    }) as CompositionMedia,
    ...(variantId === undefined ? {} : { variantId }),
    ...(editionId === undefined ? {} : { editionId }),
  };
}

function assertData(data: Use["data"], path: string): JsonObject | undefined {
  if (data === undefined) return undefined;
  return snapshotJsonObject(data, `${path}.data`) as JsonObject;
}

function resolveFit(
  use: Use,
  media: CompositionMedia,
  options: CompositionProjectionOptions,
  path: string,
  placement?: CompositionPlacement,
): CompositionFit | undefined {
  const config = media.config!;
  const target = placement?.rect ?? options.size;
  const requestedFit = placement?.fit ?? use.fit;
  const matchesOutput =
    config.width === target.width && config.height === target.height;
  if (
    requestedFit !== undefined &&
    requestedFit !== "contain" &&
    requestedFit !== "cover" &&
    requestedFit !== "reflow"
  ) {
    fail(`${path}: fit must be contain, cover, or reflow`);
  }
  if (matchesOutput) {
    return requestedFit;
  }
  if (!requestedFit)
    fail(
      `${path}: child canvas ${config.width}x${config.height} requires an explicit fit`,
    );
  return requestedFit;
}

function resolveLeafTransition(
  transition: Transition | undefined,
  fps: number,
  leafFrames: number,
  path: string,
  edge: "enter" | "exit",
): ResolvedTransition | undefined {
  if (!transition || transition.type === "none") return undefined;
  const seconds = parseDuration(transition.duration, `${path}.${edge}.duration`, fps);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const frames = Math.max(1, Math.min(leafFrames, Math.round(seconds * fps)));
  return Object.freeze({
    type: transition.type,
    durationSeconds: frames / fps,
    durationFrames: frames,
    ...(transition.easing !== undefined ? { easing: transition.easing } : {}),
  });
}

function planUse(
  use: Use,
  options: CompositionProjectionOptions,
  path: string,
  startFrame: number,
  stack: Set<object>,
  selectedRoutes: Record<string, string>,
  placementChain: readonly CompositionPlacement[] = [],
): PlannedLeaf[] {
  if (isProgram(use.content)) {
    const placement = placementChain.at(-1);
    if (use.variant !== undefined || use.edition !== undefined) {
      fail(`${path}: a nested Program cannot have variant or edition`);
    }
    if (use.trim !== undefined) {
      fail(`${path}: trim is supported on animated leaf children, not nested Programs`);
    }
    if (
      use.fit !== undefined &&
      !placement &&
      (use.content.op !== "together" || !use.content.size)
    ) {
      fail(
        `${path}: an unplaced Program fit requires a together() group with an explicit size`,
      );
    }
    const fittedChain =
      use.fit !== undefined && !placement
        ? [
            Object.freeze({
              groupPath: path,
              rect: Object.freeze({ x: 0, y: 0, ...options.size }),
              groupSize: options.size,
              fit: use.fit,
              end: "hide" as const,
            }),
          ]
        : placementChain;
    const descendants = planProgram(
      use.content,
      options,
      path,
      startFrame,
      stack,
      selectedRoutes,
      fittedChain,
    );
    const parentData = assertData(use.data, path);
    const contentEnd = Math.max(...descendants.map((leaf) => leaf.endFrame));
    const requestedEnd =
      use.hold === undefined
        ? contentEnd
        : startFrame + durationFrames(use.hold, options.fps, path);
    if (requestedEnd < contentEnd)
      fail(`${path}: Program hold cannot be shorter than its content`);
    return descendants.map((leaf) => {
      const extended =
        requestedEnd > contentEnd && leaf.endFrame === contentEnd;
      return Object.freeze({
        ...leaf,
        ...(parentData
          ? {
              data: snapshotJsonObject(
                { ...parentData, ...(leaf.data ?? {}) },
                `${leaf.path}.data`,
              ) as JsonObject,
            }
          : {}),
        ...(extended
          ? {
              contentEndFrame: leaf.contentEndFrame ?? leaf.endFrame,
              endFrame: requestedEnd,
            }
          : {}),
      });
    });
  }

  const interactiveRuntime = isInteractiveChild(use.content)
    ? use.content.createCompositionRuntime()
    : undefined;
  const selected: SelectedChildMedia = interactiveRuntime
    ? { media: interactiveRuntime.media }
    : selectChildMedia(use, path);
  const media = selected.media;
  rejectUnsupportedMedia(media, options, path);
  const config = media.config!;
  const placement = placementChain.at(-1);
  const fit = resolveFit(use, media, options, path, placement);
  const data = assertData(use.data, path);
  if (media.animated && use.hold !== undefined)
    fail(`${path}: animated children cannot have a hold`);
  if (!media.animated && use.trim !== undefined)
    fail(`${path}: trim is only supported on animated children`);
  const duration = media.animated ? config.duration : use.hold;
  if (duration === undefined)
    fail(`${path}: still children require an explicit hold`);

  let totalFrames: number;
  let trimInFrames: number | undefined;
  let sourceTotalFrames: number | undefined;

  if (media.animated && use.trim !== undefined) {
    const childFps = config.fps!;
    const sourceSeconds = parseDuration(duration, `${path}.duration`, childFps);
    assertFinitePositive(sourceSeconds, `${path}.duration`);
    const trimInSeconds =
      use.trim.in === undefined
        ? 0
        : parseDuration(use.trim.in, `${path}.trim.in`, childFps);
    const trimOutSeconds =
      use.trim.out === undefined
        ? sourceSeconds
        : parseDuration(use.trim.out, `${path}.trim.out`, childFps);
    if (!Number.isFinite(trimInSeconds) || trimInSeconds < 0) {
      fail(`${path}: trim.in must be a non-negative finite duration`);
    }
    if (!Number.isFinite(trimOutSeconds) || trimOutSeconds <= trimInSeconds) {
      fail(`${path}: trim.out must be greater than trim.in`);
    }
    if (trimOutSeconds > sourceSeconds + 1e-9) {
      fail(`${path}: trim.out (${trimOutSeconds}s) exceeds child duration (${sourceSeconds}s)`);
    }
    const clampedOut = Math.min(trimOutSeconds, sourceSeconds);
    const trimmedSeconds = clampedOut - trimInSeconds;
    const rawInFrames = trimInSeconds * childFps;
    const roundedInFrames = Math.round(rawInFrames);
    if (Math.abs(rawInFrames - roundedInFrames) > 1e-9) {
      fail(`${path}: trim.in must align to a whole source frame at ${childFps} fps`);
    }
    sourceTotalFrames = Math.max(1, Math.round(sourceSeconds * childFps));
    trimInFrames = roundedInFrames;
    totalFrames = animatedDurationFrames(trimmedSeconds, childFps, options.fps, path);
  } else {
    totalFrames = media.animated
      ? animatedDurationFrames(duration, config.fps!, options.fps, path)
      : durationFrames(duration, options.fps, path);
  }
  const enter = resolveLeafTransition(use.enter, options.fps, totalFrames, path, "enter");
  const exit = resolveLeafTransition(use.exit, options.fps, totalFrames, path, "exit");
  return [
    {
      path,
      startFrame,
      endFrame: startFrame + totalFrames,
      totalFrames,
      kind: media.media,
      width: config.width!,
      height: config.height!,
      ...(fit !== undefined ? { fit } : {}),
      ...(placement !== undefined ? { placement } : {}),
      ...(placementChain.length > 0
        ? { placementChain: Object.freeze([...placementChain]) }
        : {}),
      ...(media.animated ? { fps: config.fps } : {}),
      ...(trimInFrames !== undefined ? { trimInFrames } : {}),
      ...(sourceTotalFrames !== undefined ? { sourceTotalFrames } : {}),
      ...(enter !== undefined ? { enter } : {}),
      ...(exit !== undefined ? { exit } : {}),
      ...(selected.variantId !== undefined
        ? { variantId: selected.variantId }
        : {}),
      ...(selected.editionId !== undefined
        ? { editionId: selected.editionId }
        : {}),
      content: media,
      ...(interactiveRuntime ? { interactiveRuntime } : {}),
      ...(data !== undefined ? { data } : {}),
    },
  ];
}

function planTogether(
  program: Extract<Program, { op: "together" }>,
  options: CompositionProjectionOptions,
  parentPath: string,
  startFrame: number,
  stack: Set<object>,
  selectedRoutes: Record<string, string>,
  inheritedPlacements: readonly CompositionPlacement[],
): PlannedLeaf[] {
  if (!Array.isArray(program.parts) || program.parts.length === 0)
    fail(`${parentPath || "root"}: together requires at least one part`);
  if (program.end !== "hold" && program.end !== "hide")
    fail(
      `${parentPath || "root"}: together requires an explicit end of hold or hide`,
    );
  const groupSize =
    program.size ?? inheritedPlacements.at(-1)?.rect ?? options.size;
  if (
    !Number.isInteger(groupSize.width) ||
    !Number.isInteger(groupSize.height) ||
    groupSize.width <= 0 ||
    groupSize.height <= 0
  )
    fail(
      `${parentPath || "root"}: together size must use positive integer pixels`,
    );
  const ids = new Set<string>();
  const children: PlannedLeaf[][] = [];
  for (const use of program.parts) {
    if (!use || typeof use !== "object" || typeof use.id !== "string")
      fail(`${parentPath || "root"}: every together part requires an id`);
    assertId(use.id, parentPath || "root");
    if (ids.has(use.id))
      fail(`${parentPath || "root"}: duplicate sibling id "${use.id}"`);
    ids.add(use.id);
    const { rect } = use;
    if (
      !rect ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height) ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      fail(
        `${parentPath || "root"}/${use.id}: together rect must be finite with positive width and height`,
      );
    }
    if (use.fit !== "contain" && use.fit !== "cover" && use.fit !== "reflow")
      fail(
        `${parentPath || "root"}/${use.id}: together fit must be contain, cover, or reflow`,
      );
    const placement: CompositionPlacement = Object.freeze({
      groupPath: parentPath || "root",
      rect: Object.freeze({ ...rect }),
      groupSize: Object.freeze({
        width: groupSize.width,
        height: groupSize.height,
      }),
      fit: use.fit,
      end: program.end,
    });
    const path = parentPath ? `${parentPath}/${use.id}` : use.id;
    const placementChain = [...inheritedPlacements, placement];
    children.push(
      planUse(
        use,
        options,
        path,
        startFrame,
        stack,
        selectedRoutes,
        placementChain,
      ),
    );
  }
  const groupEndFrame = Math.max(
    ...children.flatMap((leaves) => leaves.map((leaf) => leaf.endFrame)),
  );
  return children.flatMap((leaves) => {
    if (program.end === "hide") return leaves;
    const childEndFrame = Math.max(...leaves.map((leaf) => leaf.endFrame));
    return leaves.map((leaf) =>
      leaf.endFrame === childEndFrame
        ? Object.freeze({
            ...leaf,
            contentEndFrame: leaf.endFrame,
            endFrame: groupEndFrame,
          })
        : leaf,
    );
  });
}

function planProgram(
  program: Program,
  options: CompositionProjectionOptions,
  parentPath: string,
  startFrame: number,
  stack: Set<object>,
  selectedRoutes: Record<string, string>,
  inheritedPlacements: readonly CompositionPlacement[] = [],
): PlannedLeaf[] {
  if (stack.has(program)) fail(`${parentPath || "root"}: cyclic Program graph`);
  if (program.op === "choose") {
    const choicePath = parentPath || "root";
    const branch = options.routes?.[choicePath];
    if (!branch) fail(`${choicePath}: time() requires an explicit route`);
    if (!Object.hasOwn(program.paths, branch))
      fail(`${choicePath}: route "${branch}" is not a declared path`);
    selectedRoutes[choicePath] = branch;
    stack.add(program);
    try {
      const selected = program.paths[branch]!;
      const selectedPath = parentPath ? `${parentPath}/${branch}` : branch;
      if (isProgram(selected))
        return planProgram(
          selected,
          options,
          selectedPath,
          startFrame,
          stack,
          selectedRoutes,
          inheritedPlacements,
        );
      return planUse(
        { id: branch, content: selected },
        options,
        selectedPath,
        startFrame,
        stack,
        selectedRoutes,
        inheritedPlacements,
      );
    } finally {
      stack.delete(program);
    }
  }
  if (program.op === "together") {
    stack.add(program);
    try {
      return planTogether(
        program,
        options,
        parentPath,
        startFrame,
        stack,
        selectedRoutes,
        inheritedPlacements,
      );
    } finally {
      stack.delete(program);
    }
  }
  if (!Array.isArray(program.parts) || program.parts.length === 0)
    fail(`${parentPath || "root"}: sequence requires at least one part`);
  stack.add(program);
  try {
    const ids = new Set<string>();
    const leaves: PlannedLeaf[] = [];
    let cursor = startFrame;
    for (const use of program.parts) {
      if (!use || typeof use !== "object" || typeof use.id !== "string")
        fail(`${parentPath || "root"}: every part requires an id`);
      assertId(use.id, parentPath || "root");
      if (ids.has(use.id))
        fail(`${parentPath || "root"}: duplicate sibling id "${use.id}"`);
      ids.add(use.id);
      const path = parentPath ? `${parentPath}/${use.id}` : use.id;
      const childLeaves = planUse(
        use,
        options,
        path,
        cursor,
        stack,
        selectedRoutes,
        inheritedPlacements,
      );
      leaves.push(...childLeaves);
      cursor = Math.max(...childLeaves.map((leaf) => leaf.endFrame));
    }
    return leaves;
  } finally {
    stack.delete(program);
  }
}

/** Validate a retained Program and produce its selected, linear integer schedule. */
export function planComposition(
  program: Program,
  options: CompositionProjectionOptions,
): CompositionPlan {
  assertFinitePositive(options.fps, "fps");
  if (!Number.isInteger(options.fps)) fail("fps must be an integer");
  assertFinitePositive(options.size.width, "size.width");
  assertFinitePositive(options.size.height, "size.height");
  if (
    !Number.isInteger(options.size.width) ||
    !Number.isInteger(options.size.height)
  )
    fail("size must use integer pixels");
  const selectedRoutes: Record<string, string> = {};
  const leaves = planProgram(
    program,
    options,
    "",
    0,
    new Set<object>(),
    selectedRoutes,
  );
  for (const path of Object.keys(options.routes ?? {})) {
    if (!Object.hasOwn(selectedRoutes, path))
      fail(`${path}: route does not target a choice in this Program`);
  }
  // together({ end: "hide" }) retains its source order, which need not be
  // ordered by duration. A projection ends at the farthest selected leaf.
  const totalFrames = Math.max(...leaves.map((leaf) => leaf.endFrame));
  return Object.freeze({
    fps: options.fps,
    totalFrames,
    selectedRoutes: Object.freeze({ ...selectedRoutes }),
    leaves: Object.freeze(leaves.map((leaf) => Object.freeze(leaf))),
  });
}

/** JSON-safe schedule retained on the projected MediaDefinition. */
export function compositionSchedule(
  plan: CompositionPlan,
): CompositionSchedule {
  return Object.freeze({
    fps: plan.fps,
    totalFrames: plan.totalFrames,
    selectedRoutes: plan.selectedRoutes,
    leaves: Object.freeze(
      plan.leaves.map((leaf) =>
        Object.freeze({
          path: leaf.path,
          startFrame: leaf.startFrame,
          endFrame: leaf.endFrame,
          totalFrames: leaf.totalFrames,
          kind: leaf.kind,
          width: leaf.width,
          height: leaf.height,
          ...(leaf.contentEndFrame !== undefined
            ? { contentEndFrame: leaf.contentEndFrame }
            : {}),
          ...(leaf.fit !== undefined ? { fit: leaf.fit } : {}),
          ...(leaf.placement !== undefined
            ? { placement: leaf.placement }
            : {}),
          ...(leaf.placementChain !== undefined
            ? { placementChain: leaf.placementChain }
            : {}),
          ...(leaf.variantId !== undefined
            ? { variantId: leaf.variantId }
            : {}),
          ...(leaf.editionId !== undefined
            ? { editionId: leaf.editionId }
            : {}),
          ...(leaf.fps !== undefined ? { fps: leaf.fps } : {}),
          ...(leaf.trimInFrames !== undefined
            ? { trimInFrames: leaf.trimInFrames }
            : {}),
          ...(leaf.sourceTotalFrames !== undefined
            ? { sourceTotalFrames: leaf.sourceTotalFrames }
            : {}),
          ...(leaf.enter !== undefined ? { enter: leaf.enter } : {}),
          ...(leaf.exit !== undefined ? { exit: leaf.exit } : {}),
        }),
      ),
    ),
  });
}
