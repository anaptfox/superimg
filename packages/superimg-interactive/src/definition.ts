import { sceneProjectionInput } from "@superimg/stdlib/scene-semantic";
import { isMediaElement } from "@superimg/types";
import { resolveSceneTree, collectSceneSnapshots } from "@superimg/stdlib/tree";
//! Omakase authoring for one live, explorable media experience.

import type {
  CanvasSize,
  CompileResult,
  JsonObject,
  MediaDefinition,
  RenderContext,
  InteractiveCompositionRuntime,
} from "@superimg/types";
import { Frame, Html, h } from "@superimg/stdlib/tree";
import { lower } from "@superimg/stdlib/tree/lower";
import type {
  DefineInteractiveInput,
  InteractiveDefinition,
  SceneGuide,
  SceneRuntimeInput,
  SceneSnapshot,
  SceneStyleRenderer,
} from "./contracts.js";
import {
  interactiveSceneAtFrame,
  layoutInteractiveGuide,
  parseInteractiveDuration,
} from "./guide-controller.js";
import {
  createInteractiveSceneAuthoring,
  projectInteractiveSceneHtml,
  projectInteractiveSceneTree,
} from "./semantic.js";

export const INTERACTIVE_DEFAULT_FPS = 30;
export const INTERACTIVE_DEFAULT_SIZE = Object.freeze({
  width: 1920,
  height: 1080,
});

/** The clock derived from the guide. Interactive authors do not repeat it. */
export interface InteractiveClock {
  readonly fps: number;
  readonly durationSeconds: number;
  readonly totalFrames: number;
}

/**
 * Define one interactive experience. Live data belongs to the host, while
 * `sample` is only the optional offline/preview value.
 */
export function resolveInteractiveSize(
  size: CanvasSize | undefined = undefined,
): CanvasSize {
  if (size === undefined) return { ...INTERACTIVE_DEFAULT_SIZE };
  assertInteractiveSize(size);
  return Object.freeze({ width: size.width, height: size.height });
}

export function defineInteractive<TData = JsonObject>(
  input: DefineInteractiveInput<TData>,
): InteractiveDefinition<TData> {
  assertInteractiveInput(input);
  // Validate the complete guide at definition time, including duplicate ids,
  // positive durations, and the minimum one-frame-per-step invariant.
  resolveInteractiveClock(input.guide);
  const size =
    input.size !== undefined ? resolveInteractiveSize(input.size) : undefined;
  const definition: InteractiveDefinition<TData> &
    NonNullable<CompileResult["interactive"]> = Object.freeze({
    kind: "interactive" as const,
    guide: input.guide,
    ...(size !== undefined ? { size } : {}),
    ...(input.sample !== undefined ? { sample: input.sample } : {}),
    render: input.render,
    createCompositionRuntime(
      this: InteractiveDefinition<TData> | void,
    ): InteractiveCompositionRuntime {
      // Hosts may stamp a clone of this frozen definition. Detached factory
      // calls retain the original definition as their source.
      const source = isInteractiveDefinition<TData>(this) ? this : definition;
      const runtime: InteractiveRuntimeTemplate<TData> =
        lowerInteractiveDefinition(source);
      return {
        media: runtime,
        setScene: (value: unknown) =>
          runtime.setInteractiveScene(value as SceneRuntimeInput),
        getSnapshot: () => runtime.getInteractiveSnapshot(),
        subscribe: (listener: (snapshot: unknown) => void) =>
          runtime.subscribeInteractiveScene(listener),
        attachActions: (
          container: HTMLElement,
          getFrame: () => number,
          listener: (event: {
            readonly action: string;
            readonly nodeId: string;
            readonly frame: number;
          }) => void,
        ) => runtime.attachActions(container, getFrame, listener),
      } satisfies import("@superimg/types").InteractiveCompositionRuntime;
    },
  });
  return definition;
}

export function resolveInteractiveClock(
  guide: SceneGuide,
  fps = INTERACTIVE_DEFAULT_FPS,
): InteractiveClock {
  if (!Number.isInteger(fps) || fps <= 0) {
    throw new RangeError("Interactive fps must be a positive integer");
  }
  let durationSeconds = 0;
  for (const step of guide.steps) {
    durationSeconds += parseInteractiveDuration(step.duration, fps);
  }
  const layout = layoutInteractiveGuide(guide, durationSeconds, fps);
  return Object.freeze({
    fps,
    durationSeconds,
    totalFrames: layout.totalFrames,
  });
}

/**
 * Lower an interactive definition to the existing browser media engine.
 * This is an integration seam, not a second authoring API.
 */
export interface InteractiveRuntimeTemplate<TData> extends MediaDefinition<
  TData,
  "video",
  RenderContext<TData>
> {
  setInteractiveScene(value: SceneRuntimeInput): void;
  getInteractiveSnapshot(): SceneSnapshot;
  subscribeInteractiveScene(
    listener: (snapshot: SceneSnapshot) => void,
  ): () => void;
  attachActions(
    container: HTMLElement,
    getFrame: () => number,
    listener: (event: {
      readonly action: string;
      readonly nodeId: string;
      readonly frame: number;
    }) => void,
  ): () => void;
}

export interface LowerInteractiveOptions {
  sceneRenderer?: SceneStyleRenderer;
  sceneStyle?: string;
}

export function lowerInteractiveDefinition<TData>(
  definition: InteractiveDefinition<TData>,
  options: LowerInteractiveOptions = {},
): InteractiveRuntimeTemplate<TData> {
  return lowerInteractiveRuntime(definition, options);
}

/** @internal One complete immutable request, never exposed as authored data. */
export interface InteractiveEvaluationInput<TData> {
  readonly hostData: TData;
  readonly scene: SceneRuntimeInput;
  readonly size?: CanvasSize;
  readonly sceneStyle?: string | undefined;
}

/** @internal Controller-only data shape; whole input replaces atomically. */
export interface InteractiveControllerData<TData> {
  input: InteractiveEvaluationInput<TData>;
}

/** @internal Runtime adapter. Public lowering retains its original data contract. */
export function lowerInteractiveControllerDefinition<TData>(
  definition: InteractiveDefinition<TData>,
  options: LowerInteractiveOptions,
  initial: InteractiveEvaluationInput<TData>,
  onAccepted: (input: InteractiveEvaluationInput<TData>) => void,
): InteractiveRuntimeTemplate<InteractiveControllerData<TData>> {
  let evaluatedInput = initial;
  const runtime = lowerInteractiveRuntime(definition, options, (value) => {
    evaluatedInput = (value as unknown as InteractiveControllerData<TData>).input;
    return evaluatedInput;
  });
  return {
    ...runtime,
    sample: { input: initial },
    // Captured synchronously with evaluation, carried only on private frames.
    // A later request cannot change which input acceptance commits.
    captureFrameAcceptance() {
      const input = evaluatedInput;
      return () => onAccepted(input);
    },
  } as unknown as InteractiveRuntimeTemplate<InteractiveControllerData<TData>>;
}

function lowerInteractiveRuntime<TData>(
  definition: InteractiveDefinition<TData>,
  options: LowerInteractiveOptions,
  readInput?: (data: TData) => InteractiveEvaluationInput<TData>,
): InteractiveRuntimeTemplate<TData> {
  assertInteractiveDefinition<TData>(definition);
  const clock = resolveInteractiveClock(definition.guide);
  const size = resolveInteractiveSize(definition.size);
  const layout = layoutInteractiveGuide(
    definition.guide,
    clock.durationSeconds,
    clock.fps,
  );
  let hostScene: SceneRuntimeInput = {};
  let latestSnapshot = createInteractiveSceneAuthoring().snapshot();
  let latestSceneId = "scene";
  const listeners = new Set<(snapshot: SceneSnapshot) => void>();
  const mediaCapabilities = definition.mediaCapabilities;
  return {
    kind: "media",
    media: "video",
    fallbackFormat: "mp4",
    medium: "html",
    animated: true,
    ...(mediaCapabilities?.version === 0 ? { mediaCapabilities } : {}),
    // Retain the authored callback for core's unstamped capability fallback.
    // Enumerable symbol metadata survives Player clones and render wrappers,
    // without importing the compiler/detector into the pure authoring graph.
    [Symbol.for("superimg.stdlib-capability-source")]: definition,
    config: {
      width: size.width,
      height: size.height,
      fps: clock.fps,
      duration: `${clock.durationSeconds}s`,
      temporal: "once",
    },
    ...(definition.sample !== undefined ? { sample: definition.sample } : {}),
    render(ctx) {
      const input = readInput?.(ctx.data);
      if (input) ctx = { ...ctx, data: { ...input.hostData } };
      const sceneStyle = input ? input.sceneStyle : options.sceneStyle;
      latestSceneId = ctx.sceneId;
      const guideScene = interactiveSceneAtFrame(layout, ctx.timeline.frame);
      const runtimeScene = mergeSceneInput(guideScene, input ? input.scene : hostScene);
      const scene = createInteractiveSceneAuthoring(ctx.sceneId, runtimeScene);
      const authoredTree = definition.render({ ...ctx, scene });
      const tree = resolveSceneTree(authoredTree, {
        runtime: sceneProjectionInput(scene),
      });
      const retargetScene = (
        node: import("@superimg/types").MediaElement,
      ): import("@superimg/types").MediaElement => {
        if (node.props["data-si-scene-id"] === undefined && !spatial.length) return node;
        const mapChildren = (children: readonly import("@superimg/types").MediaChild[]): readonly import("@superimg/types").MediaChild[] => {
          let changed: import("@superimg/types").MediaChild[] | undefined;
          for (let index = 0; index < children.length; index++) {
            const child = children[index];
            const next = Array.isArray(child) ? mapChildren(child) : isMediaElement(child) ? retargetScene(child) : child;
            if (!changed && next !== child) changed = children.slice(0, index);
            changed?.push(next);
          }
          return changed ?? children;
        };
        const children = mapChildren(node.children);
        const changesId = node.props["data-si-scene-id"] !== undefined && node.props["data-si-scene-id"] !== ctx.sceneId;
        if (!changesId && children === node.children) return node;
        return { ...node, props: changesId ? { ...node.props, "data-si-scene-id": ctx.sceneId } : node.props, children };
      };
      const spatial = collectSceneSnapshots(tree);
      for (const packet of spatial) {
        const instances = new Map<string, (typeof packet.instances)[number]>();
        for (const instance of packet.instances) if (!instances.has(instance.id)) instances.set(instance.id, instance);
        for (const node of packet.nodes)
          scene.register({
            id: node.id,
            kind: node.kind,
            ...(node.role ? { role: node.role } : {}),
            ...(node.label ? { label: node.label } : {}),
            parent: node.parentId,
            space: node.space,
            actions: node.actions,
            tags: node.tags,
            initial: { visible: node.visible, opacity: node.opacity },
            metadata: {
              ...node.metadata,
              ...(instances.get(node.id)
                ? {
                    visual: JSON.parse(
                      JSON.stringify(
                        instances.get(node.id),
                      ),
                    ),
                  }
                : {}),
            },
          });
      }
      const registerOrdinary = (
        node: import("@superimg/types").MediaElement,
      ) => {
        if (node.props.semantic) {
          const { hit: _hit, ...semantic } = node.props.semantic;
          const id = node.props["data-si-node"];
          if (typeof id === "string") scene.register({ ...semantic, id });
        }
        const walk = (child: import("@superimg/types").MediaChild): void => {
          if (Array.isArray(child)) child.forEach(walk);
          else if (isMediaElement(child)) registerOrdinary(child);
        };
        node.children.forEach(walk);
      };
      registerOrdinary(tree);
      latestSnapshot = {
        ...scene.snapshot(),
        ...(spatial.length ? { spatial } : {}),
      };
      for (const listener of listeners) listener(latestSnapshot);
      // Listeners can observe/mutate the public snapshot before projection.
      const spatialIds = new Set(spatial.flatMap(packet => packet.nodes.map(node => node.id)));
      const projectionSnapshot = { ...latestSnapshot, nodes: latestSnapshot.nodes.filter(node => !spatialIds.has(node.id)) };
      // lower() uses an explicitly sized root as its typography canvas. A new
      // fill wrapper would otherwise change that existing authoring behavior.
      const ownsDifferentCanvas =
        (typeof tree.props.width === "number" &&
          tree.props.width !== ctx.width) ||
        (typeof tree.props.height === "number" &&
          tree.props.height !== ctx.height);
      const projectedTree =
        options.sceneRenderer || ownsDifferentCanvas
          ? null
          : projectInteractiveSceneTree(tree, projectionSnapshot);
      if (projectedTree) {
        return Frame(
          { width: "fill", height: "fill" },
          h(
            "div",
            {
              "data-si-scene-id": ctx.sceneId,
              style: "position:relative;width:100%;height:100%",
            },
            retargetScene(projectedTree),
          ),
        );
      }
      const html = lower(retargetScene(tree), {
        medium: "html",
        width: ctx.width,
        height: ctx.height,
      });
      const projected = options.sceneRenderer
        ? options.sceneRenderer.render({
            html,
            scene: latestSnapshot,
            medium: "html",
            ...(sceneStyle !== undefined
              ? { style: sceneStyle }
              : {}),
          })
        : projectInteractiveSceneHtml(html, projectionSnapshot);
      return Html({
        width: "fill",
        height: "fill",
        html: `<div data-si-scene-id="${escapeAttribute(ctx.sceneId)}" style="position:relative;width:100%;height:100%">${projected}</div>`,
      });
    },
    setInteractiveScene(value) {
      hostScene = value;
    },
    getInteractiveSnapshot() {
      return latestSnapshot;
    },
    subscribeInteractiveScene(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    attachActions(container, getFrame, listener) {
      return attachInteractiveActions(
        container,
        () => latestSceneId,
        getFrame,
        listener,
      );
    },
  };
}

/** Install the semantic action bridge after a host has mounted this runtime's iframe. */
export function attachInteractiveActions(
  container: HTMLElement,
  getSceneId: string | (() => string),
  getFrame: () => number,
  listener: (event: {
    readonly action: string;
    readonly nodeId: string;
    readonly frame: number;
  }) => void,
): () => void {
  const iframe = interactiveFrame(container);
  if (!(iframe instanceof HTMLIFrameElement)) return () => undefined;
  iframe.style.pointerEvents = "auto";
  const documentRoot = iframe.contentDocument;
  if (!documentRoot) return () => undefined;
  ensureInteractiveActionPolicy(documentRoot);
  const handler = (event: Event) => {
    const target = event.target as Element | null;
    const node = target?.closest?.("[data-si-node][data-si-actions]");
    const sceneId =
      typeof getSceneId === "function" ? getSceneId() : getSceneId;
    if (
      !node ||
      node.closest("[data-si-scene-id]")?.getAttribute("data-si-scene-id") !==
        sceneId
    )
      return;
    const nodeId = node.getAttribute("data-si-node");
    const actions = (node.getAttribute("data-si-actions") ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const explicit =
      target?.closest?.("[data-si-action]")?.getAttribute("data-si-action") ??
      null;
    const action =
      explicit && actions.includes(explicit)
        ? explicit
        : actions.length === 1
          ? actions[0]
          : null;
    if (nodeId && action) listener({ action, nodeId, frame: getFrame() });
  };
  documentRoot.addEventListener("click", handler, true);
  return () => documentRoot.removeEventListener("click", handler, true);
}

const actionPolicies = new WeakMap<Document, HTMLStyleElement>();

/** @internal A maintained rule enables new/replaced targets without frame scans. */
export function ensureInteractiveActionPolicy(documentRoot: Document): void {
  const current = actionPolicies.get(documentRoot);
  if (current?.isConnected || !documentRoot.head) return;
  const style = documentRoot.createElement("style");
  style.setAttribute("data-superimg-action-policy", "1");
  // Explicit semantic actions own pointer eligibility. Scene visibility and
  // accepted presentation identity still guard dispatch in the controller.
  style.textContent = "[data-si-actions]{pointer-events:auto!important}";
  documentRoot.head.appendChild(style);
  actionPolicies.set(documentRoot, style);
}

/** @internal Candidate loads may leave hidden iframes beside the committed surface. */
export function interactiveFrame(container: Element): HTMLIFrameElement | null {
  for (const iframe of container.querySelectorAll("iframe")) {
    const stage = iframe.closest<HTMLElement>("[data-superimg-player-stage]");
    if (stage?.style.visibility !== "hidden") return iframe;
  }
  return null;
}

function escapeAttribute(value: string): string {
  return value.replace(
    /[&"<>]/g,
    (char) =>
      ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[char]!,
  );
}

function mergeSceneInput(
  guide: SceneRuntimeInput | undefined,
  host: SceneRuntimeInput,
): SceneRuntimeInput {
  return {
    ...(host.state !== undefined
      ? { state: host.state }
      : guide?.state !== undefined
        ? { state: guide.state }
        : {}),
    ...(guide?.operations?.length || host.operations?.length
      ? {
          operations: [
            ...(guide?.operations ?? []),
            ...(host.operations ?? []),
          ],
        }
      : {}),
    ...(guide?.camera || host.camera
      ? { camera: { ...(guide?.camera ?? {}), ...(host.camera ?? {}) } }
      : {}),
  };
}

export function isInteractiveDefinition<TData = unknown>(
  value: unknown,
): value is InteractiveDefinition<TData> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InteractiveDefinition<unknown>>;
  return (
    candidate.kind === "interactive" &&
    typeof candidate.render === "function" &&
    !!candidate.guide &&
    typeof candidate.guide === "object"
  );
}

export function assertInteractiveDefinition<TData = unknown>(
  value: unknown,
): asserts value is InteractiveDefinition<TData> {
  if (!isInteractiveDefinition<TData>(value)) {
    throw new TypeError("Expected a definition created by defineInteractive()");
  }
}

function assertInteractiveInput<TData>(
  input: DefineInteractiveInput<TData>,
): void {
  if (!input || typeof input !== "object") {
    throw new TypeError("defineInteractive() requires an options object");
  }
  if (!input.guide || typeof input.guide !== "object") {
    throw new TypeError("defineInteractive() requires a guide");
  }
  if (typeof input.render !== "function") {
    throw new TypeError("defineInteractive() requires render(ctx)");
  }
  if ("entries" in input) {
    throw new TypeError(
      "Interactive media is singular; collection entries are not supported",
    );
  }
  if (input.size !== undefined) {
    assertInteractiveSize(input.size);
  }
}

function assertInteractiveSize(size: CanvasSize): void {
  if (!size || typeof size !== "object") {
    throw new TypeError("defineInteractive() size must be { width, height }");
  }
  const { width, height } = size;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError(
      "defineInteractive() size width/height must be positive integers",
    );
  }
}
